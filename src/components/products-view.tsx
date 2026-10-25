"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Download,
  PackageX,
  Search,
  Sparkle,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { ApiErrorBanner, SalesToolbar, filterQuery } from "./sales-filters";
import { ProductDetail } from "./product-detail";
import { downloadFile } from "@/lib/download";
import {
  integer,
  money,
  moneyShort,
  percent,
  share,
  shortDate,
  signedPercent,
  titleCase,
} from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { useSalesFilters } from "@/lib/use-sales-filters";
import {
  abc,
  formatQuantity,
  movimentos,
  variation,
  type Classe,
  type Movimento,
  type PainelProdutos,
  type ProdutoLinha,
  horaCurta,
} from "@/lib/vendas";

type Filtro = "todos" | Classe | "alta" | "queda" | "parados" | "novos";
type Ordem =
  "faturamento" | "variacao" | "qtd" | "vendas" | "preco" | "dias_vendidos";

const classeInfo: Record<Classe, { nome: string; texto: string }> = {
  A: { nome: "Classe A", texto: "fazem 80% do faturamento" },
  B: { nome: "Classe B", texto: "os próximos 15%" },
  C: { nome: "Classe C", texto: "os últimos 5%" },
};

export function ProductsView({
  onMessage,
}: {
  onMessage: (t: string) => void;
}) {
  const filters = useSalesFilters();
  const url = filters.ready ? `/api/produtos?${filterQuery(filters)}` : null;
  const { data, error, loading } = useApi<PainelProdutos>(url, filters.nonce);
  const [aberto, setAberto] = useState<ProdutoLinha | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const analise = useMemo(() => {
    if (!data) return null;
    return { curva: abc(data.produtos), mov: movimentos(data.produtos) };
  }, [data]);

  function exportCsv() {
    if (!data || !analise) return;
    const lines = [
      "codigo;produto;classe;unidade;quantidade;faturamento;faturamento_anterior;variacao_pct;vendas;dias_vendidos",
    ];
    for (const item of data.produtos) {
      const v = variation(item.faturamento, item.faturamento_anterior);
      lines.push(
        [
          item.codigo,
          `"${item.produto.replaceAll('"', '""')}"`,
          analise.curva.classes.get(item.codigo) ?? "",
          item.unidade,
          String(item.qtd).replace(".", ","),
          item.faturamento.toFixed(2).replace(".", ","),
          item.faturamento_anterior.toFixed(2).replace(".", ","),
          v === null ? "" : v.toFixed(1).replace(".", ","),
          item.vendas,
          item.dias_vendidos,
        ].join(";"),
      );
    }
    downloadFile(
      `﻿${lines.join("\n")}\n`,
      `superdeli-produtos-${data.periodo.ini}-a-${data.periodo.fim}.csv`,
      "text/csv;charset=utf-8",
    );
    onMessage(`Lista de ${data.produtos.length} produtos exportada.`);
  }

  return (
    <div className="rs" aria-busy={loading}>
      <SalesToolbar
        filters={filters}
        loading={loading}
        label="Filtros dos produtos"
      >
        <button
          className="button secondary"
          onClick={exportCsv}
          disabled={!data || loading}
        >
          <Download size={15} />
          Exportar
        </button>
      </SalesToolbar>
      {error && <ApiErrorBanner error={error} onRetry={filters.refresh} />}
      {!data && loading && !error && (
        <p className="rs-loading" role="status">
          Carregando os produtos…
        </p>
      )}
      {data && analise && (
        <div className={`rs-content ${loading ? "rs-stale" : ""}`}>
          <p className="rs-lead">
            Comparando {shortDate(data.periodo.ini)} a{" "}
            {shortDate(data.periodo.fim)} com {shortDate(data.periodo.ant_ini)}{" "}
            a {shortDate(data.periodo.ant_fim)}
            {data.periodo.ant_corte
              ? ` até ${horaCurta(data.periodo.ant_corte)}`
              : ""}
            .
          </p>
          <section
            className="metrics rs-metrics"
            aria-label="Resumo dos produtos"
          >
            <Stat
              icon={Boxes}
              title="Produtos vendidos"
              value={integer(analise.curva.vendidos)}
              foot={`${integer(data.produtos.filter((p) => p.faturamento_anterior > 0).length)} no período anterior`}
            />
            <Stat
              icon={Sparkle}
              title="Fazem 80% do faturamento"
              value={`${integer(analise.curva.resumo[0].produtos)} produtos`}
              foot={`${percent(analise.curva.resumo[0].shareProdutos)} do catálogo vendido`}
              featured
            />
            <Stat
              icon={TrendingUp}
              title="Em alta"
              value={integer(analise.mov.alta.length)}
              foot="cresceram em faturamento"
              tone="positive"
              onClick={() => setFiltro("alta")}
            />
            <Stat
              icon={PackageX}
              title="Pararam de vender"
              value={integer(analise.mov.parados.length)}
              foot="vendiam antes e zeraram agora"
              tone="caution"
              onClick={() => setFiltro("parados")}
            />
          </section>

          <Chapter
            n={1}
            title="Poucos produtos sustentam a loja"
            caption={`${integer(analise.curva.resumo[0].produtos)} produtos (${percent(analise.curva.resumo[0].shareProdutos, 0)} dos vendidos) trazem 80% do faturamento. São esses que não podem faltar.`}
          />
          <AbcPanel curva={analise.curva} onPick={(c) => setFiltro(c)} />

          <Chapter
            n={2}
            title="O que está subindo e o que está caindo"
            caption="Diferença em reais contra o período de comparação. Itens pequenos (menos de R$ 150) ficam de fora para não confundir."
          />
          <div className="rs-two">
            <MovesPanel
              title="Em alta"
              icon={TrendingUp}
              tone="positive"
              items={analise.mov.alta}
              onOpen={setAberto}
              empty="Nenhum produto relevante cresceu."
            />
            <MovesPanel
              title="Em queda"
              icon={TrendingDown}
              tone="caution"
              items={analise.mov.queda}
              onOpen={setAberto}
              empty="Nenhum produto relevante caiu."
            />
          </div>

          {(analise.mov.parados.length > 0 || analise.mov.novos.length > 0) && (
            <>
              <Chapter
                n={3}
                title="Quem sumiu e quem chegou"
                caption="Produtos que vendiam e zeraram neste período merecem uma conferência: falta no estoque, troca de fornecedor ou saiu do cardápio?"
              />
              <div className="rs-two">
                <SimpleList
                  title="Pararam de vender"
                  icon={PackageX}
                  items={analise.mov.parados.slice(0, 8).map((p) => ({
                    produto: p,
                    valor: `antes ${moneyShort(p.faturamento_anterior)}`,
                  }))}
                  onOpen={setAberto}
                  empty="Nenhum produto relevante parou de vender."
                />
                <SimpleList
                  title="Novidades"
                  icon={Sparkle}
                  items={analise.mov.novos.slice(0, 8).map((p) => ({
                    produto: p,
                    valor: moneyShort(p.faturamento),
                  }))}
                  onOpen={setAberto}
                  empty="Nenhum produto novo relevante."
                />
              </div>
            </>
          )}

          <Chapter
            n={analise.mov.parados.length || analise.mov.novos.length ? 4 : 3}
            title="Todos os produtos"
            caption="Clique em um produto para ver a ficha completa: ritmo de vendas, horários, preços e o que os clientes levam junto."
          />
          <ProductsTable
            data={data}
            classes={analise.curva.classes}
            mov={analise.mov}
            filtro={filtro}
            setFiltro={setFiltro}
            onOpen={setAberto}
          />
        </div>
      )}
      {aberto && (
        <ProductDetail
          produto={aberto}
          classe={analise?.curva.classes.get(aberto.codigo)}
          query={filterQuery(filters)}
          onClose={() => setAberto(null)}
        />
      )}
    </div>
  );
}

export function Chapter({
  n,
  title,
  caption,
}: {
  n: number;
  title: string;
  caption: string;
}) {
  return (
    <header className="rs-chapter">
      <span className="rs-chapter-n">{String(n).padStart(2, "0")}</span>
      <div>
        <h2>{title}</h2>
        <p>{caption}</p>
      </div>
    </header>
  );
}

function Stat({
  icon: Icon,
  title,
  value,
  foot,
  featured,
  tone,
  onClick,
}: {
  icon: typeof Boxes;
  title: string;
  value: string;
  foot: string;
  featured?: boolean;
  tone?: "positive" | "caution";
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="metric-heading">
        <span>{title}</span>
        <Icon size={19} />
      </div>
      <strong>{value}</strong>
      <span className={`metric-footer ${tone ?? ""}`}>{foot}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      className={`metric rs-metric-button ${featured ? "rs-featured" : ""}`}
      onClick={onClick}
    >
      {body}
    </button>
  ) : (
    <article className={`metric ${featured ? "rs-featured" : ""}`}>
      {body}
    </article>
  );
}

function AbcPanel({
  curva,
  onPick,
}: {
  curva: ReturnType<typeof abc>;
  onPick: (c: Classe) => void;
}) {
  return (
    <section className="panel rs-abc" aria-label="Curva ABC">
      <div className="rs-abc-bars" aria-hidden="true">
        <div className="rs-abc-row">
          <span>Faturamento</span>
          <div>
            {curva.resumo.map((c) => (
              <i
                key={c.classe}
                className={`abc-${c.classe}`}
                style={{ width: `${c.shareFaturamento}%` }}
              />
            ))}
          </div>
        </div>
        <div className="rs-abc-row">
          <span>Produtos</span>
          <div>
            {curva.resumo.map((c) => (
              <i
                key={c.classe}
                className={`abc-${c.classe}`}
                style={{ width: `${c.shareProdutos}%` }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="rs-abc-cards">
        {curva.resumo.map((c) => (
          <button
            type="button"
            key={c.classe}
            className="rs-abc-card"
            onClick={() => onPick(c.classe)}
          >
            <span className={`rs-badge abc-${c.classe}`}>{c.classe}</span>
            <strong>{integer(c.produtos)} produtos</strong>
            <span>
              {classeInfo[c.classe].texto} · {moneyShort(c.faturamento)}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function MovesPanel({
  title,
  icon: Icon,
  tone,
  items,
  onOpen,
  empty,
}: {
  title: string;
  icon: typeof Boxes;
  tone: "positive" | "caution";
  items: Movimento[];
  onOpen: (p: ProdutoLinha) => void;
  empty: string;
}) {
  const max = Math.max(...items.map((i) => Math.abs(i.diferenca)), 1);
  return (
    <section className={`panel analytics-panel rs-moves ${tone}`}>
      <div className="inline-title">
        <Icon size={19} />
        <h2>{title}</h2>
      </div>
      {items.length ? (
        <ol className="rs-move-list">
          {items.map((item) => (
            <li key={item.codigo}>
              <button type="button" onClick={() => onOpen(item)}>
                <span className="rs-move-name">{titleCase(item.produto)}</span>
                <span className="rs-move-value">
                  {item.diferenca > 0 ? "+" : "−"}
                  {moneyShort(Math.abs(item.diferenca))}
                  {item.variacao !== null && (
                    <small>{signedPercent(item.variacao, 0)}</small>
                  )}
                </span>
                <span className="rs-move-track" aria-hidden="true">
                  <i
                    style={{
                      width: `${(Math.abs(item.diferenca) / max) * 100}%`,
                    }}
                  />
                </span>
                <span className="rs-move-detail">
                  {moneyShort(item.faturamento_anterior)} →{" "}
                  {moneyShort(item.faturamento)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rs-empty-text">{empty}</p>
      )}
    </section>
  );
}

function SimpleList({
  title,
  icon: Icon,
  items,
  onOpen,
  empty,
}: {
  title: string;
  icon: typeof Boxes;
  items: { produto: ProdutoLinha; valor: string }[];
  onOpen: (p: ProdutoLinha) => void;
  empty: string;
}) {
  return (
    <section className="panel analytics-panel">
      <div className="inline-title">
        <Icon size={19} />
        <h2>{title}</h2>
      </div>
      {items.length ? (
        <ul className="rs-simple-list">
          {items.map(({ produto, valor }) => (
            <li key={produto.codigo}>
              <button type="button" onClick={() => onOpen(produto)}>
                <span>{titleCase(produto.produto)}</span>
                <strong>{valor}</strong>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rs-empty-text">{empty}</p>
      )}
    </section>
  );
}

function ProductsTable({
  data,
  classes,
  mov,
  filtro,
  setFiltro,
  onOpen,
}: {
  data: PainelProdutos;
  classes: Map<string, Classe>;
  mov: ReturnType<typeof movimentos>;
  filtro: Filtro;
  setFiltro: (f: Filtro) => void;
  onOpen: (p: ProdutoLinha) => void;
}) {
  const [query, setQuery] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("faturamento");
  const [limite, setLimite] = useState(30);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalize = (text: string) =>
    text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const sets = useMemo(
    () => ({
      alta: new Set(mov.alta.map((p) => p.codigo)),
      queda: new Set(mov.queda.map((p) => p.codigo)),
      parados: new Set(mov.parados.map((p) => p.codigo)),
      novos: new Set(mov.novos.map((p) => p.codigo)),
    }),
    [mov],
  );
  const rows = data.produtos
    .map((p) => ({
      ...p,
      variacao: variation(p.faturamento, p.faturamento_anterior),
      preco: p.qtd ? p.faturamento / p.qtd : 0,
      classe: classes.get(p.codigo),
    }))
    .filter((p) => {
      if (filtro === "todos")
        return p.faturamento > 0 || p.faturamento_anterior > 0;
      if (filtro === "A" || filtro === "B" || filtro === "C")
        return p.classe === filtro;
      return sets[filtro].has(p.codigo);
    })
    .filter(
      (p) =>
        !query ||
        normalize(`${p.produto} ${p.codigo}`).includes(normalize(query)),
    )
    .sort((a, b) => {
      if (ordem === "variacao")
        return (b.variacao ?? -Infinity) - (a.variacao ?? -Infinity);
      return b[ordem] - a[ordem];
    });
  const visible = rows.slice(0, limite);
  const chips: { key: Filtro; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "A", label: "Classe A" },
    { key: "B", label: "Classe B" },
    { key: "C", label: "Classe C" },
    { key: "alta", label: "Em alta" },
    { key: "queda", label: "Em queda" },
    { key: "parados", label: "Pararam" },
    { key: "novos", label: "Novidades" },
  ];
  const headers: { key: Ordem; label: string }[] = [
    { key: "faturamento", label: "Faturamento" },
    { key: "variacao", label: "Variação" },
    { key: "qtd", label: "Quantidade" },
    { key: "vendas", label: "Vendas" },
    { key: "preco", label: "Preço médio" },
    { key: "dias_vendidos", label: "Dias com venda" },
  ];
  return (
    <section
      className="panel products-panel rs-products"
      aria-label="Todos os produtos"
    >
      <div className="panel-heading">
        <div className="rs-chips" role="group" aria-label="Filtrar produtos">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-pressed={filtro === chip.key}
              className={filtro === chip.key ? "selected" : ""}
              onClick={() => {
                setFiltro(chip.key);
                setLimite(30);
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="search-field rs-search">
          <Search size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            placeholder="Buscar produto ou código"
            aria-label="Buscar produto"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              aria-label="Limpar busca"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Produto</th>
              <th scope="col">Classe</th>
              {headers.map((header) => (
                <th
                  scope="col"
                  key={header.key}
                  aria-sort={ordem === header.key ? "descending" : "none"}
                  className="rs-num"
                >
                  <button
                    className={`rs-sort ${ordem === header.key ? "active" : ""}`}
                    onClick={() => setOrdem(header.key)}
                  >
                    {header.label}
                    {ordem === header.key && (
                      <ArrowDownRight size={12} aria-hidden="true" />
                    )}
                  </button>
                </th>
              ))}
              <th scope="col" className="rs-num">
                % do total
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.codigo} className="rs-row-click">
                <th scope="row">
                  <button
                    type="button"
                    className="rs-row-link"
                    onClick={() => onOpen(row)}
                  >
                    {titleCase(row.produto)}
                  </button>
                  <small className="rs-code">
                    {row.codigo.replace(/^0+/, "")}
                  </small>
                </th>
                <td>
                  {row.classe ? (
                    <span className={`rs-badge abc-${row.classe}`}>
                      {row.classe}
                    </span>
                  ) : (
                    <span className="rs-muted">—</span>
                  )}
                </td>
                <td className="rs-num rs-strong">{money(row.faturamento)}</td>
                <td
                  className={`rs-num ${row.variacao === null ? "" : row.variacao >= 0 ? "rs-up" : "rs-down"}`}
                >
                  {row.variacao === null ? (
                    row.faturamento > 0 ? (
                      "novo"
                    ) : (
                      "—"
                    )
                  ) : (
                    <>
                      {row.variacao >= 0 ? (
                        <ArrowUpRight size={13} />
                      ) : (
                        <ArrowDownRight size={13} />
                      )}
                      {signedPercent(row.variacao, 0)}
                    </>
                  )}
                </td>
                <td className="rs-num">
                  {formatQuantity(row.qtd, row.unidade)}
                </td>
                <td className="rs-num">{integer(row.vendas)}</td>
                <td className="rs-num">
                  {row.qtd ? money(row.preco) : "—"}
                  {row.qtd > 0 && (
                    <small className="rs-code">
                      /{row.unidade.toLowerCase()}
                    </small>
                  )}
                </td>
                <td className="rs-num">
                  {row.dias_vendidos}/{data.periodo.dias}
                </td>
                <td className="rs-num">
                  {percent(share(row.faturamento, data.totais.faturamento))}
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr>
                <td colSpan={9} className="rs-empty-row">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="rs-table-footer">
        <span>
          {integer(rows.length)} produtos neste filtro. Quantidade em kg
          recalculada pelo valor ÷ preço (o relatório arredonda o peso).
        </span>
        {rows.length > limite && (
          <button
            className="text-button"
            onClick={() => setLimite((l) => l + 50)}
          >
            Mostrar mais {Math.min(50, rows.length - limite)}
          </button>
        )}
      </div>
    </section>
  );
}
