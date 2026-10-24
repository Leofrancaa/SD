-- CifrAI · carga via HTTPS (usada pelo Coletor Superdeli).
-- Mesma lógica do carregar_supabase.py, numa transação só, sem precisar de
-- conexão direta ao Postgres (porta 5432) a partir da loja.

create or replace function public.ingest_bmweb(
  p_empresa     uuid,
  p_arquivo     text,
  p_sha256      text,
  p_periodo_ini date,
  p_periodo_fim date,
  p_total       numeric,
  p_pedidos     jsonb,
  p_itens       jsonb,
  p_pagamentos  jsonb
) returns jsonb
language plpgsql
volatile
set search_path = public, staging
as $$
declare
  v_pedidos   int;
  v_itens     int;
  v_removidos int := 0;
  v_total     numeric;
  v_existentes int;
begin
  if p_periodo_ini is null or p_periodo_fim is null or p_periodo_fim < p_periodo_ini
     or (p_periodo_fim - p_periodo_ini) > 400 then
    raise exception 'periodo invalido';
  end if;
  if exists (select 1 from staging.ingest_log where sha256 = p_sha256) then
    return jsonb_build_object('ja_importado', true);
  end if;

  drop table if exists t_ped, t_itn, t_pag;
  create temp table t_ped on commit drop as
  select * from jsonb_to_recordset(coalesce(p_pedidos, '[]')) as x(
    numero bigint, data date, hora time, cliente text, situacao text,
    qtd_produtos int, total numeric(12,2), diferenca_itens numeric(12,2));
  create temp table t_itn on commit drop as
  select * from jsonb_to_recordset(coalesce(p_itens, '[]')) as x(
    numero bigint, seq int, codigo text, nome text, unidade text,
    qtd numeric(12,3), preco numeric(12,2), desconto numeric(12,2), total numeric(12,2));
  create temp table t_pag on commit drop as
  select * from jsonb_to_recordset(coalesce(p_pagamentos, '[]')) as x(
    numero bigint, seq int, codigo_forma text, forma text, valor numeric(12,2));

  select count(*), coalesce(sum(total), 0) into v_pedidos, v_total from t_ped;
  select count(*) into v_itens from t_itn;
  -- Conferência: o total enviado precisa bater com o total do relatório.
  if v_total <> coalesce(p_total, 0) then
    raise exception 'total dos pedidos (%) diferente do total do relatorio (%)', v_total, p_total;
  end if;
  if exists (select 1 from t_ped where data not between p_periodo_ini and p_periodo_fim) then
    raise exception 'pedido fora do periodo do relatorio';
  end if;

  select count(*) into v_existentes from staging.bmweb_pedidos
   where empresa_id = p_empresa and data between p_periodo_ini and p_periodo_fim;

  insert into staging.bmweb_pedidos as d
    (empresa_id, numero, data, hora, cliente, situacao, qtd_produtos, total, diferenca_itens, arquivo)
  select p_empresa, numero, data, hora, cliente, situacao, qtd_produtos, total,
         coalesce(diferenca_itens, 0), p_arquivo
  from t_ped
  on conflict (empresa_id, numero) do update set
    data = excluded.data, hora = excluded.hora, cliente = excluded.cliente,
    situacao = excluded.situacao, qtd_produtos = excluded.qtd_produtos,
    total = excluded.total, diferenca_itens = excluded.diferenca_itens,
    arquivo = excluded.arquivo, atualizado_em = now();

  delete from staging.bmweb_itens i using t_ped t
   where i.empresa_id = p_empresa and i.numero = t.numero;
  delete from staging.bmweb_pagamentos g using t_ped t
   where g.empresa_id = p_empresa and g.numero = t.numero;

  insert into staging.bmweb_itens
  select p_empresa, numero, seq, codigo, nome, unidade, qtd, preco, desconto, total from t_itn;
  insert into staging.bmweb_pagamentos
  select p_empresa, numero, seq, nullif(codigo_forma, ''), forma, valor from t_pag;

  -- Pedido que sumiu do relatório no mesmo período (cancelado no BMWeb).
  delete from staging.bmweb_pedidos d
   where d.empresa_id = p_empresa and d.data between p_periodo_ini and p_periodo_fim
     and not exists (select 1 from t_ped t where t.numero = d.numero);
  get diagnostics v_removidos = row_count;
  -- Trava: relatório incompleto não pode apagar boa parte do período.
  if v_removidos > 10 and v_removidos > 0.2 * v_existentes then
    raise exception 'remocao suspeita: % de % pedidos do periodo sumiriam', v_removidos, v_existentes;
  end if;

  -- Resumos diários do painel (006_resumos.sql) para o período recebido.
  perform staging.atualizar_resumos(p_empresa, p_periodo_ini, p_periodo_fim);

  insert into staging.ingest_log (sha256, empresa_id, arquivo, periodo_ini, periodo_fim, pedidos, itens, total)
  values (p_sha256, p_empresa, p_arquivo, p_periodo_ini, p_periodo_fim, v_pedidos, v_itens, v_total);

  return jsonb_build_object('ja_importado', false, 'pedidos', v_pedidos,
                            'itens', v_itens, 'removidos', v_removidos, 'total', v_total);
end;
$$;

revoke all on function public.ingest_bmweb(uuid, text, text, date, date, numeric, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.ingest_bmweb(uuid, text, text, date, date, numeric, jsonb, jsonb, jsonb)
  to service_role;
grant insert, update, delete on staging.bmweb_pedidos, staging.bmweb_itens, staging.bmweb_pagamentos to service_role;
grant insert on staging.ingest_log to service_role;
