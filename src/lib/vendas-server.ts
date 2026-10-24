// Leitura das vendas reais no Supabase. SÓ roda no servidor.
import type {
  Cesta,
  PainelProdutos,
  PainelVendas,
  ProdutoDetalhe,
  Situacao,
} from "@/lib/vendas";
import { SupabaseNaoConfigurado, supabaseRpc } from "@/lib/supabase-server";

export class VendasNaoConfiguradas extends Error {
  constructor() {
    super("Conexão com o banco de vendas não configurada no servidor.");
    this.name = "VendasNaoConfiguradas";
  }
}

// Cache curto por instância: os dados chegam do BMWeb a cada ~30 min, então
// 2 min evitam consultas repetidas sem atrasar a atualização.
const TTL_MS = 120_000;
const MAX_ENTRIES = 80;
const cache = new Map<string, { expires: number; data: unknown }>();

async function cached<T>(
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const empresa = process.env.SUPABASE_EMPRESA_ID;
  if (!empresa) throw new VendasNaoConfiguradas();
  const params = { p_empresa: empresa, ...args };
  const key = `${fn}|${JSON.stringify(params)}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.data as T;
  let data: T;
  try {
    data = await supabaseRpc<T>(fn, params);
  } catch (error) {
    if (error instanceof SupabaseNaoConfigurado)
      throw new VendasNaoConfiguradas();
    throw error;
  }
  for (const [entry, value] of cache)
    if (value.expires <= now) cache.delete(entry);
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { expires: now + TTL_MS, data });
  return data;
}

export function painelVendas(ini: string, fim: string, situacao: Situacao) {
  return cached<PainelVendas>("painel_vendas", {
    p_ini: ini,
    p_fim: fim,
    p_situacao: situacao,
  });
}

export function painelProdutos(ini: string, fim: string, situacao: Situacao) {
  return cached<PainelProdutos>("painel_produtos", {
    p_ini: ini,
    p_fim: fim,
    p_situacao: situacao,
  });
}

export function produtoDetalhe(
  codigo: string,
  ini: string,
  fim: string,
  situacao: Situacao,
) {
  return cached<ProdutoDetalhe>("produto_detalhe", {
    p_codigo: codigo,
    p_ini: ini,
    p_fim: fim,
    p_situacao: situacao,
  });
}

export function cestasCompras(ini: string, fim: string, situacao: Situacao) {
  return cached<Cesta[]>("cestas_compras", {
    p_ini: ini,
    p_fim: fim,
    p_situacao: situacao,
    p_limite: 15,
  });
}
