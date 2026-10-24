"use client";

import { Dialog } from "radix-ui";
import { Clock3, Link2, Tag, TrendingUp, X } from "lucide-react";
import { ApiErrorBanner } from "./sales-filters";
import {
  dateBr,
  integer,
  money,
  moneyShort,
  percent,
  shortDate,
  titleCase,
} from "@/lib/format";
import { useApi } from "@/lib/use-api";
import {
  bucketSeries,
  formatQuantity,
  weekdayLong,
  weekdayShort,
  type Classe,
  type ProdutoDetalhe,
  type ProdutoLinha,
} from "@/lib/vendas";

const heat = ["#f7ece3", "#f0cfb2", "#e3a173", "#cc6c33", "#9c3c0a"];

export function ProductDetail({
  produto,
  classe,
  query,
  onClose,
}: {
  produto: ProdutoLinha;
  classe?: Classe;
  query: string;
  onClose: () => void;
}) {
  const { data, error, loading } = useApi<ProdutoDetalhe>(
    `/api/produtos/${encodeURIComponent(produto.codigo)}?${query}`,
  );
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="rs-drawer-overlay" />
        <Dialog.Content className="rs-drawer" aria-describedby={undefined}>
          <header className="rs-drawer-head">
            <div>
              <span className="rs-drawer-code">
                Código {produto.codigo.replace(/^0+/, "")}
                {classe && (
                  <span className={`rs-badge abc-${classe}`}>
                    Classe {classe}
                  </span>
                )}
              </span>
              <Dialog.Title>{titleCase(produto.produto)}</Dialog.Title>
            </div>
            <Dialog.Close className="rs-drawer-close" aria-label="Fechar ficha">
              <X size={20} />
            </Dialog.Close>
          </header>
          {error && <ApiErrorBanner error={error} onRetry={onClose} />}
          {loading && !data && (
            <p className="rs-loading" role="status">
              Carregando a ficha…
            </p>
          )}
          {data && <Body data={data} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Body({ data }: { data: ProdutoDetalhe }) {
  const r = data.resumo;
  const unidade = data.unidade ?? "UN";
  const penetracao = r.total_pedidos
    ? (r.pedidos_com / r.total_pedidos) * 100
    : 0;
  const { pontos, granularidade } = bucketSeries(
    data.serie.map((s) => ({
      data: s.data,
      pedidos: s.vendas,
      faturamento: s.faturamento,
    })),
    data.periodo.ini,
    data.periodo.fim,
    null,
  );
  const max = Math.max(...pontos.map((p) => p.faturamento), 1);
  const horas = data.semana_hora.map((h) => h.hora);
  const hMin = horas.length ? Math.min(...horas) : 6;
  const hMax = horas.length ? Math.max(...horas) : 20;
  const gradeHoras = Array.from(
    { length: hMax - hMin + 1 },
    (_, i) => hMin + i,
  );
  const valores = data.semana_hora.map((h) => h.vendas).sort((a, b) => a - b);
  const cut = (q: number) =>
    valores[Math.min(valores.length - 1, Math.floor(q * valores.length))] ?? 0;
  const limites = [cut(0.2), cut(0.4), cut(0.6), cut(0.8)];
  const nivel = (v: number) => limites.filter((t) => v >= t).length;
  const pico = [...data.semana_hora].sort((a, b) => b.vendas - a.vendas)[0];
  const ticketCom = data.ticket.com ?? 0;
  const ticketSem = data.ticket.sem ?? 0;
  const combo = data.juntos.find(
    (j) => (j.lift ?? 0) >= 1.3 && j.confianca >= 0.05,
  );

  if (!r.vendas)
    return (
      <p className="rs-empty-text rs-drawer-pad">
        Sem vendas deste produto no período selecionado.
      </p>
    );

  return (
    <div className="rs-drawer-body">
      <section className="rs-drawer-kpis">
        <div>
          <span>Faturamento</span>
          <strong>{money(r.faturamento)}</strong>
        </div>
        <div>
          <span>Quantidade</span>
          <strong>{formatQuantity(r.qtd, unidade)}</strong>
        </div>
        <div>
          <span>Está em</span>
          <strong>{percent(penetracao)}</strong>
          <small>dos pedidos ({integer(r.pedidos_com)})</small>
        </div>
        <div>
          <span>Ticket de quem leva</span>
          <strong>{money(ticketCom)}</strong>
          <small>quem não leva: {money(ticketSem)}</small>
        </div>
      </section>

      <section className="rs-drawer-section">
        <h3>
          <TrendingUp size={17} /> Ritmo de vendas
          <small>
            faturamento por {granularidade === "mes" ? "mês" : granularidade}
          </small>
        </h3>
        <div
          className="rs-mini-bars"
          role="img"
          aria-label={`Faturamento por ${granularidade}: ${pontos.map((p) => `${shortDate(p.start)} ${money(p.faturamento)}`).join("; ")}`}
        >
          {pontos.map((p) => (
            <span
              key={p.key}
              title={`${shortDate(p.start)}: ${money(p.faturamento)}`}
            >
              <i
                style={{
                  height: `${Math.max(p.faturamento ? 2 : 0, (p.faturamento / max) * 100)}%`,
                }}
              />
            </span>
          ))}
        </div>
        <div className="rs-mini-axis">
          <span>{shortDate(data.periodo.ini)}</span>
          <span>{shortDate(data.periodo.fim)}</span>
        </div>
      </section>

      {data.semana_hora.length > 0 && (
        <section className="rs-drawer-section">
          <h3>
            <Clock3 size={17} /> Quando sai mais
            {pico && (
              <small>
                pico: {weekdayLong[pico.dia_semana - 1]} às {pico.hora}h
              </small>
            )}
          </h3>
          <div className="rs-mini-heat-scroll">
            <table className="rs-mini-heat">
              <thead>
                <tr>
                  <th />
                  {gradeHoras.map((h) => (
                    <th key={h}>{h}h</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weekdayShort.map((dia, i) => (
                  <tr key={dia}>
                    <th>{dia}</th>
                    {gradeHoras.map((h) => {
                      const cel = data.semana_hora.find(
                        (x) => x.dia_semana === i + 1 && x.hora === h,
                      );
                      return (
                        <td
                          key={h}
                          style={{
                            background: cel
                              ? heat[nivel(cel.vendas)]
                              : undefined,
                          }}
                          title={
                            cel
                              ? `${weekdayLong[i]} ${h}h: ${integer(cel.vendas)} vendas`
                              : undefined
                          }
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.juntos.length > 0 && (
        <section className="rs-drawer-section">
          <h3>
            <Link2 size={17} /> Quem leva também leva
          </h3>
          {combo && (
            <p className="rs-combo">
              <strong>Ideia de combo:</strong> {titleCase(data.produto ?? "")} +{" "}
              {titleCase(combo.produto)}. {percent(combo.confianca * 100, 0)} de
              quem leva este produto já leva {titleCase(combo.produto)},{" "}
              {combo.lift?.toLocaleString("pt-BR")}× mais que a média da loja.
            </p>
          )}
          <ul className="rs-juntos">
            {data.juntos.slice(0, 8).map((j) => (
              <li key={j.codigo}>
                <span>{titleCase(j.produto)}</span>
                <span className="rs-juntos-bar" aria-hidden="true">
                  <i
                    style={{
                      width: `${Math.min(100, j.confianca * 100 * 2)}%`,
                    }}
                  />
                </span>
                <strong>{percent(j.confianca * 100, 1)}</strong>
                <small>
                  {j.lift && j.lift >= 1.3
                    ? `${j.lift.toLocaleString("pt-BR")}× acima da média`
                    : "comum em qualquer pedido"}
                </small>
              </li>
            ))}
          </ul>
          <p className="rs-note">
            % = parte dos pedidos com este produto que também têm o outro.
          </p>
        </section>
      )}

      {data.precos.length > 0 && (
        <section className="rs-drawer-section">
          <h3>
            <Tag size={17} /> Preços praticados
          </h3>
          <ul className="rs-precos">
            {data.precos.map((p) => (
              <li key={`${p.preco}-${p.de}`}>
                <strong>{money(p.preco)}</strong>
                <span>
                  {p.de === p.ate
                    ? dateBr(p.de, { day: "2-digit", month: "short" })
                    : `${dateBr(p.de, { day: "2-digit", month: "short" })} a ${dateBr(p.ate, { day: "2-digit", month: "short" })}`}
                </span>
                <small>{integer(p.vendas)} vendas</small>
              </li>
            ))}
          </ul>
          {data.precos.length > 1 && (
            <p className="rs-note">
              O preço mudou {data.precos.length - 1}{" "}
              {data.precos.length - 1 === 1 ? "vez" : "vezes"} no período.
              Compare o ritmo antes e depois no gráfico acima.
            </p>
          )}
        </section>
      )}
      <p className="rs-note rs-drawer-pad">
        {moneyShort(r.faturamento)} em {integer(r.vendas)} vendas entre{" "}
        {r.primeira_venda ? shortDate(r.primeira_venda) : "—"} e{" "}
        {r.ultima_venda ? shortDate(r.ultima_venda) : "—"}.
      </p>
    </div>
  );
}
