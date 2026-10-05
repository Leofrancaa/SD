"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  Download,
  LayoutDashboard,
  Leaf,
  MapPin,
  MessageCircle,
  Package,
  ShoppingBasket,
  FileText,
  Plus,
  Search,
  Settings2,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Wheat,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  addDays,
  dateLabel,
  DEMO_END,
  leftoverDestinations,
  money,
  inventorySummary,
  number,
  periodRecords,
  products,
  productSummary,
  recommendations,
  summarize,
  toCsv,
  validateRecord,
  type DailyRecord,
  type Decision,
} from "@/lib/demo";
import { useDemoStore } from "@/lib/use-demo-store";
import { AnalyticsCharts } from "./analytics-charts";
import { BakeryChat } from "./bakery-chat";
import { OwnerBriefing } from "./owner-briefing";
import { PurchasePlanner } from "./purchase-planner";
import { OwnerReport } from "./owner-report";
import { ownerSummary } from "@/lib/operations";
import { downloadFile } from "@/lib/download";

type View =
  | "purchases"
  | "report"
  | "inventory"
  | "overview"
  | "production"
  | "products"
  | "insights"
  | "chat"
  | "settings";
const navigation: { id: View; title: string; icon: LucideIcon }[] = [
  { id: "overview", title: "Visão geral", icon: LayoutDashboard },
  { id: "production", title: "Produção e vendas", icon: ClipboardList },
  { id: "inventory", title: "Estoque e reposição", icon: Package },
  { id: "purchases", title: "Lista de compras", icon: ShoppingBasket },
  { id: "report", title: "Resumo do dono", icon: FileText },
  { id: "products", title: "Produtos", icon: Package },
  { id: "insights", title: "Sugestões eia", icon: Sparkles },
  { id: "chat", title: "Conversar com a eia", icon: MessageCircle },
  { id: "settings", title: "Sobre o piloto", icon: Settings2 },
];

export function Dashboard() {
  const store = useDemoStore();
  const [view, setView] = useState<View>("overview");
  const [days, setDays] = useState(7);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      const section = params.get("view") as View;
      setView(
        navigation.some((item) => item.id === section) ? section : "overview",
      );
      const range = Number(params.get("days"));
      setDays([7, 14, 30].includes(range) ? range : 7);
      setQuery(params.get("q") ?? "");
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    const navigation = navigationRef.current;
    const selected = navigation?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );
    if (
      navigation &&
      selected &&
      window.matchMedia("(max-width: 760px)").matches
    ) {
      navigation.scrollTo({
        left:
          selected.offsetLeft -
          navigation.offsetLeft -
          (navigation.clientWidth - selected.clientWidth) / 2,
        behavior: "instant",
      });
    }
  }, [view]);

  function updateUrl(next: { view?: View; days?: number; query?: string }) {
    const params = new URLSearchParams({
      view: next.view ?? view,
      days: String(next.days ?? days),
    });
    const search = next.query ?? query;
    if (search) params.set("q", search);
    window.history.pushState({}, "", `?${params}`);
  }
  function navigate(next: View, focusForm = false) {
    setView(next);
    setMessage("");
    updateUrl({ view: next });
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => {
      if (focusForm) {
        formRef.current?.scrollIntoView({
          behavior: "instant",
          block: "center",
        });
        formRef.current?.querySelector<HTMLElement>("select")?.focus();
      } else headingRef.current?.focus();
    });
  }
  const records = periodRecords(store.state.records, days);
  const totals = summarize(records);
  const owner = ownerSummary(store.state.records, days);
  const comparisonAvailable = owner.revenueChange !== null;
  const revenueChange = owner.revenueChange ?? 0;
  const suggestions = recommendations(records, store.state.records);
  const pending = suggestions.filter(
    (item) => !store.state.decisions[item.id],
  ).length;
  const title = navigation.find((item) => item.id === view)!.title;
  useEffect(() => {
    document.title = `${title} · Superdeli`;
  }, [title]);

  function exportRecords() {
    downloadFile(
      toCsv(records),
      `superdeli-demo-${days}-days.csv`,
      "text/csv;charset=utf-8",
    );
    setMessage(
      `Relatório de ${days} dias exportado. Os valores são sintéticos.`,
    );
  }
  function decide(id: string, decision: Decision) {
    try {
      store.save({
        ...store.state,
        decisions: { ...store.state.decisions, [id]: decision },
      });
      setMessage(
        decision === "approved"
          ? "Sugestão aprovada para o planejamento. A produção deve ser ajustada pela equipe."
          : "Sugestão adiada. Você pode revisar essa decisão depois.",
      );
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  const filterProducts = products.filter((p) =>
    `${p.name} ${p.category}`
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .includes(
        query
          .toLocaleLowerCase("pt-BR")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, ""),
      ),
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Superdeli, início">
          <span className="brand-symbol">
            <Wheat size={27} />
          </span>
          <span>
            superdeli<span className="brand-description">DELICATESSEN</span>
          </span>
        </Link>
        <div className="workspace">
          <span className="workspace-icon">S</span>
          <div>
            <strong>Superdeli</strong>
            <span>Conceição do Jacuípe, BA</span>
          </div>
        </div>
        <span className="nav-label">PADARIA E MINIMERCADO</span>
        <nav ref={navigationRef} aria-label="Menu principal">
          {navigation.map(({ id, title, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              aria-current={view === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{title}</span>
              {id === "insights" && pending > 0 && (
                <span
                  className="nav-count"
                  aria-label={`${pending} sugestões pendentes`}
                >
                  {pending}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="pilot-note">
            <span className="pilot-dot" />
            Projeto piloto
            <span>
              Pequenos ajustes.
              <br />
              Menos desperdício.
            </span>
          </div>
          <div className="powered">
            <span className="eia-logo">
              eia
              <Sparkles size={18} />
            </span>
            <span>
              Dados que ajudam
              <br />a decidir melhor.
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Superdeli <ChevronRight size={14} />
            <span>{title}</span>
          </div>
          <div className="topbar-right">
            <span className="demo-badge">
              <span />
              Dados sintéticos
            </span>
            <div className="avatar" aria-label="Perfil de demonstração">
              SD
            </div>
          </div>
        </header>
        <main id="main" className="page-content">
          <div className="page-heading">
            <div>
              <h1 ref={headingRef} tabIndex={-1}>
                {view === "overview" ? "Sua Superdeli, por inteiro." : title}
              </h1>
              <p>
                {view === "overview"
                  ? "Da fornada às prateleiras: vendas, produção e estoque em um só lugar."
                  : view === "production"
                    ? "Registre a produção da padaria e as entradas e vendas do minimercado."
                    : view === "inventory"
                      ? "Acompanhe as mercadorias, confira o giro e planeje as compras."
                      : view === "products"
                        ? "Compare o retorno da produção própria e dos itens de revenda."
                        : view === "insights"
                          ? "Os dados apontam caminhos. A decisão continua com você."
                          : view === "purchases"
                            ? "Transforme a reposição em uma lista para revisar com o fornecedor."
                            : view === "report"
                              ? "Os resultados e as prioridades, prontos para conversar e guardar."
                              : view === "chat"
                                ? "Pergunte, entenda os números e planeje seu próximo passo."
                                : "Uma base para começar pequeno e aprender com a rotina."}
              </p>
            </div>
            <div className="heading-actions">
              <button className="button secondary" onClick={exportRecords}>
                <Download size={17} />
                Exportar
              </button>
              <button
                className="button primary"
                onClick={() => navigate("production", true)}
              >
                <Plus size={18} />
                Registrar dia
              </button>
            </div>
          </div>
          <div className="period-row">
            <div className="period-control" aria-label="Período de análise">
              {[7, 14, 30].map((range) => (
                <button
                  key={range}
                  className={days === range ? "selected" : ""}
                  aria-pressed={days === range}
                  onClick={() => {
                    setDays(range);
                    updateUrl({ days: range });
                  }}
                >
                  {range} dias
                </button>
              ))}
            </div>
            <span className="date-range">
              {dateLabel(addDays(DEMO_END, -(days - 1)))} —{" "}
              {dateLabel(DEMO_END, {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
            <span className="period-note">Período de demonstração</span>
          </div>
          {store.error && (
            <p className="error-banner" role="alert">
              {store.error}
            </p>
          )}
          <div
            className={`status-banner ${message ? "visible" : ""}`}
            role="status"
            aria-live="polite"
          >
            {message}
          </div>

          {view === "overview" && (
            <>
              <section className="metrics" aria-label="Resumo do período">
                <Metric
                  title="Vendas no período"
                  value={money(totals.revenue)}
                  icon={TrendingUp}
                  footer={
                    comparisonAvailable
                      ? `${Math.abs(revenueChange).toFixed(1).replace(".", ",")}% ${revenueChange >= 0 ? "acima" : "abaixo"} do período anterior`
                      : "Sem comparação completa disponível"
                  }
                  positive={revenueChange >= 0}
                  showChange={comparisonAvailable}
                />
                <Metric
                  title="Produtos vendidos"
                  value={number(totals.sold)}
                  icon={Package}
                  footer={"Produção própria + itens de revenda"}
                />
                <Metric
                  title="Perda por descarte"
                  value={money(totals.loss)}
                  icon={Leaf}
                  footer={`${number(totals.discarded)} unidades descartadas · ao custo`}
                  warning
                />
                <Metric
                  title="Registros de falta"
                  value={String(totals.stockouts).padStart(2, "0")}
                  icon={TriangleAlert}
                  footer="Dias/produtos que acabaram cedo"
                  warning={totals.stockouts > 0}
                />
              </section>
              <OwnerBriefing
                records={store.state.records}
                days={days}
                onNavigate={navigate}
              />
              <div className="analysis-grid">
                <RevenueChart records={records} />
                <section className="panel insights-preview">
                  <div className="panel-heading">
                    <div className="inline-title">
                      <Sparkles size={19} />
                      <h2>O que merece atenção</h2>
                    </div>
                    <span className="count-badge">{pending}</span>
                  </div>
                  <p className="section-description">
                    Sugestões a partir dos registros do piloto.
                  </p>
                  <div className="preview-list">
                    {suggestions.slice(0, 2).map((item, index) => (
                      <article className="preview-item" key={item.id}>
                        <div
                          className={`suggestion-icon ${index === 0 ? "amber" : "green"}`}
                        >
                          {index === 0 ? (
                            <Leaf size={19} />
                          ) : (
                            <TrendingUp size={19} />
                          )}
                        </div>
                        <div>
                          <span className="small-label">
                            {index === 0 ? "REDUZIR SOBRAS" : "EVITAR FALTAS"}
                          </span>
                          <h3>{item.title}</h3>
                          <p>{item.description}</p>
                          <button
                            className="text-button"
                            onClick={() => navigate("insights")}
                          >
                            {item.action}
                            <ArrowRight size={14} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  <button
                    className="all-suggestions"
                    onClick={() => navigate("insights")}
                  >
                    Ver todas as sugestões
                    <ArrowRight size={16} />
                  </button>
                  <span className="rule-note">
                    Sugestões por regras · consulte a IA no chat
                  </span>
                </section>
              </div>
              <AnalyticsCharts records={records} />
              <InventoryPanel
                records={store.state.records}
                days={days}
                onExpand={() => navigate("inventory")}
              />
              <ProductTable
                records={records}
                filteredProducts={products}
                compact
                onExpand={() => navigate("products")}
              />
              <div className="daily-note">
                <span className="daily-icon">
                  <Wheat size={24} />
                </span>
                <div>
                  <strong>Uma boa fornada começa com bons registros.</strong>
                  <p>
                    Registre produção, vendas e sobras. A eia ajuda a enxergar
                    os padrões.
                  </p>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("production", true)}
                >
                  Registrar o dia
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}

          {view === "purchases" && (
            <PurchasePlanner
              key={days}
              records={store.state.records}
              days={days}
              ready={store.ready && !store.error}
              onNotice={setMessage}
            />
          )}
          {view === "report" && (
            <OwnerReport records={store.state.records} days={days} />
          )}
          {view === "inventory" && (
            <InventoryPanel records={store.state.records} days={days} />
          )}
          {view === "products" && (
            <>
              <div className="search-row">
                <div className="search-field">
                  <Search size={18} />
                  <input
                    ref={searchRef}
                    aria-label="Buscar produtos"
                    placeholder="Buscar produto ou categoria"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      updateUrl({ query: e.target.value });
                    }}
                  />
                  {query && (
                    <button
                      aria-label="Limpar busca"
                      onClick={() => {
                        setQuery("");
                        updateUrl({ query: "" });
                        searchRef.current?.focus();
                      }}
                    >
                      <X size={17} />
                    </button>
                  )}
                </div>
                <span>
                  {filterProducts.length} de {products.length} produtos
                </span>
              </div>
              <ProductTable
                records={records}
                filteredProducts={filterProducts}
              />
              <p className="table-footnote">
                Custos e preços ilustrativos. O retorno considera vendas menos
                custo das unidades vendidas e descartadas; não inclui despesas
                fixas.
              </p>
            </>
          )}

          {view === "production" && (
            <>
              <div className="production-grid">
                <section className="panel record-panel">
                  <div className="panel-heading">
                    <h2>Registro diário</h2>
                    <span className="tag">Piloto</span>
                  </div>
                  <RecordForm
                    formRef={formRef}
                    ready={store.ready && !store.error}
                    records={store.state.records}
                    onSave={(record) => {
                      store.save({
                        ...store.state,
                        records: [
                          ...store.state.records.filter(
                            (r) =>
                              !(
                                r.date === record.date &&
                                r.productId === record.productId
                              ),
                          ),
                          record,
                        ],
                      });
                      setMessage(
                        "Registro salvo neste navegador. Os indicadores foram atualizados.",
                      );
                    }}
                  />
                </section>
                <section className="record-guidance">
                  <div className="guidance-symbol">
                    <ClipboardList size={32} />
                  </div>
                  <h2>O que aconteceu com a fornada?</h2>
                  <p>
                    Produção e vendas contam parte da história. As sobras e as
                    faltas completam o registro.
                  </p>
                  <ul>
                    <li>
                      <Check size={17} />
                      Conte as unidades produzidas no dia.
                    </li>
                    <li>
                      <Check size={17} />
                      Use as vendas registradas no caixa.
                    </li>
                    <li>
                      <Check size={17} />
                      Separe descarte de doação ou reaproveitamento.
                    </li>
                    <li>
                      <Check size={17} />
                      Anote se o produto acabou antes de fechar.
                    </li>
                  </ul>
                  <div className="storage-note">
                    Dados guardados apenas neste navegador. Faça uma exportação
                    para manter uma cópia.
                  </div>
                </section>
              </div>
              <section className="panel ledger">
                <div className="panel-heading">
                  <h2>Registros do período</h2>
                  <span className="muted">{records.length} registros</span>
                </div>
                <div className="table-scroll">
                  <table>
                    <caption className="sr-only">
                      Produção e vendas no período selecionado
                    </caption>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Produto</th>
                        <th className="numeric">Produzido / disponível</th>
                        <th className="numeric">Vendido</th>
                        <th className="numeric">Saldo antes do descarte</th>
                        <th className="numeric">Descartado</th>
                        <th>Destino da sobra</th>
                        <th>Falta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...records]
                        .sort(
                          (a, b) =>
                            b.date.localeCompare(a.date) ||
                            a.productId.localeCompare(b.productId),
                        )
                        .map((record) => (
                          <tr key={`${record.date}-${record.productId}`}>
                            <td>{dateLabel(record.date)}</td>
                            <th scope="row">
                              {
                                products.find((p) => p.id === record.productId)!
                                  .name
                              }
                            </th>
                            <td className="numeric">
                              {number(record.produced)}
                            </td>
                            <td className="numeric">{number(record.sold)}</td>
                            <td className="numeric">
                              {number(record.produced - record.sold)}
                            </td>
                            <td className="numeric">
                              {number(record.discarded)}
                            </td>
                            <td>
                              {record.produced -
                                record.sold -
                                record.discarded >
                              0
                                ? leftoverDestinations[
                                    record.leftoverDestination ?? "unspecified"
                                  ]
                                : "Sem outras sobras"}
                            </td>
                            <td>
                              {record.stockout ? (
                                <span className="badge warning">
                                  Às {record.stockout}
                                </span>
                              ) : (
                                "Sem falta"
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {view === "insights" && (
            <>
              <div className="insights-explanation">
                <Sparkles size={22} />
                <div>
                  <strong>Uma conversa com os seus dados.</strong>
                  <p>
                    Estas sugestões usam regras simples sobre os dados
                    sintéticos. Confira encomendas, feriados e eventos antes de
                    aprovar. Nenhuma ação é executada automaticamente.
                  </p>
                </div>
              </div>
              <div className="suggestions-list">
                {suggestions.map((item) => {
                  const decision = store.state.decisions[item.id];
                  return (
                    <article key={item.id} className="panel suggestion-detail">
                      <div
                        className={`suggestion-icon ${item.tone === "warning" ? "amber" : "green"}`}
                      >
                        <Sparkles size={22} />
                      </div>
                      <div className="suggestion-body">
                        <div className="suggestion-meta">
                          <span>
                            {
                              products.find((p) => p.id === item.productId)!
                                .name
                            }
                          </span>
                          <span
                            className={`badge ${decision === "approved" ? "success" : "warning"}`}
                          >
                            {decision === "approved"
                              ? "Aprovada para planejar"
                              : decision === "deferred"
                                ? "Adiada"
                                : "Aguardando sua revisão"}
                          </span>
                        </div>
                        <h2>{item.title}</h2>
                        <p>{item.description}</p>
                        <div className="suggestion-actions">
                          <button
                            disabled={
                              !store.ready ||
                              !!store.error ||
                              decision === "approved"
                            }
                            className="button primary"
                            onClick={() => decide(item.id, "approved")}
                          >
                            <CheckCheck size={17} />
                            {decision === "approved"
                              ? "Aprovada"
                              : "Aprovar para planejar"}
                          </button>
                          <button
                            className="button secondary"
                            disabled={
                              !store.ready ||
                              !!store.error ||
                              decision === "deferred"
                            }
                            onClick={() => decide(item.id, "deferred")}
                          >
                            Revisar depois
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {!suggestions.length && (
                  <div className="empty-state">
                    <h2>Nenhum padrão para revisar</h2>
                    <p>Registre mais dias ou selecione um período maior.</p>
                  </div>
                )}
              </div>
              <div className="promotion-panel">
                <div>
                  <h2>Uma ideia para divulgar</h2>
                  <p>Texto de exemplo para você adaptar e revisar.</p>
                </div>
                <blockquote>
                  “Seu café da tarde fica melhor com uma pausa na Superdeli.
                  Passe por aqui e confira os sabores do dia!”
                </blockquote>
                <button
                  className="button secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        "Seu café da tarde fica melhor com uma pausa na Superdeli. Passe por aqui e confira os sabores do dia!",
                      );
                      setMessage("Texto copiado. Revise antes de publicar.");
                    } catch {
                      setMessage(
                        "Não foi possível copiar. Selecione o texto e copie manualmente.",
                      );
                    }
                  }}
                >
                  Copiar texto
                </button>
              </div>
            </>
          )}

          {view === "settings" && (
            <section className="panel pilot-info">
              <span className="brand-symbol">
                <Wheat size={30} />
              </span>
              <h2>Superdeli + eia</h2>
              <p>
                O primeiro passo é entender a rotina. Esta demonstração
                acompanha {products.length} produtos e 30 dias de produção,
                vendas e estoque para testar como os dados podem ajudar a
                padaria e o minimercado.
              </p>
              <dl>
                <div>
                  <dt>Empresa</dt>
                  <dd>Superdeli · Delicatessen</dd>
                </div>
                <div>
                  <dt>Localização</dt>
                  <dd>
                    <MapPin size={15} />
                    Conceição do Jacuípe, Bahia
                  </dd>
                </div>
                <div>
                  <dt>Objetivo</dt>
                  <dd>Reduzir perdas, evitar faltas e melhorar as compras</dd>
                </div>
                <div>
                  <dt>Dados</dt>
                  <dd>Sintéticos · 6 set. a 5 out. 2026</dd>
                </div>
                <div>
                  <dt>Armazenamento</dt>
                  <dd>Apenas neste navegador</dd>
                </div>
                <div>
                  <dt>Sugestões</dt>
                  <dd>Regras demonstrativas e chat com IA via Groq</dd>
                </div>
              </dl>
              <h3>Um piloto que cabe na rotina</h3>
              <ol className="pilot-steps">
                <li>
                  <strong>Escolher o foco</strong>
                  <span>
                    Comece pelos produtos que mais sobram ou acabam cedo.
                    Confirme custos e unidades com a equipe.
                  </span>
                </li>
                <li>
                  <strong>Registrar por duas semanas</strong>
                  <span>
                    Anote produção, entradas, vendas, descartes e faltas.
                    Acompanhe também a facilidade do registro.
                  </span>
                </li>
                <li>
                  <strong>Testar um ajuste pequeno</strong>
                  <span>
                    O dono aprova. Confira encomendas, compras em andamento e
                    validade antes de agir.
                  </span>
                </li>
                <li>
                  <strong>Mostrar o resultado</strong>
                  <span>
                    Compare descarte ao custo e faltas em períodos equivalentes.
                    Gere o resumo para decidir o próximo passo.
                  </span>
                </li>
              </ol>
              <button
                className="button secondary"
                onClick={() => navigate("report")}
              >
                Ver resumo do dono <ArrowRight size={16} />
              </button>
              <h3>Para usar dados reais</h3>
              <p>
                Confirme os produtos, custos, responsáveis pelo registro e
                relatórios disponíveis no caixa. Esta demonstração ainda usa
                salvamento local: acesso da equipe, banco compartilhado,
                integração com o caixa e acompanhamento por lote/validade
                precisam ser configurados para a operação real.
              </p>
              <a
                className="text-button"
                href="https://www.jacuipenoticias.com/guia/panificadoras/superdeli/superdeli.htm"
                target="_blank"
                rel="noreferrer"
              >
                Referência pública da Superdeli
                <ArrowUpRight size={16} />
              </a>
            </section>
          )}
          <div hidden={view !== "chat"}>
            <BakeryChat
              records={store.state.records}
              days={days as 7 | 14 | 30}
              active={view === "chat"}
            />
          </div>
          <footer className="page-footer">
            <span>
              Superdeli <span className="footer-dot">·</span> Feito para a
              rotina da padaria e do minimercado.
            </span>
            <span>Demonstração eia · todos os valores são fictícios</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
  footer,
  positive,
  warning,
  showChange,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  footer: string;
  positive?: boolean;
  warning?: boolean;
  showChange?: boolean;
}) {
  return (
    <article className="metric">
      <div className="metric-heading">
        <span>{title}</span>
        <Icon size={19} />
      </div>
      <strong>{value}</strong>
      <span
        className={`metric-footer ${showChange && positive ? "positive" : warning ? "caution" : ""}`}
      >
        {showChange &&
          (positive ? (
            <ArrowUpRight size={14} />
          ) : (
            <ArrowDownRight size={14} />
          ))}
        {footer}
      </span>
    </article>
  );
}

function RevenueChart({ records }: { records: DailyRecord[] }) {
  const [metric, setMetric] = useState<"revenue" | "loss">("revenue");
  const dates = [...new Set(records.map((r) => r.date))].sort();
  const series = dates.map((date) => ({
    date,
    value: summarize(records.filter((r) => r.date === date))[metric],
  }));
  const peak = Math.max(...series.map((day) => day.value), 1);
  const total = summarize(records)[metric];
  const max =
    Math.ceil(peak / (metric === "revenue" ? 500 : 25)) *
    (metric === "revenue" ? 500 : 25);
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>O ritmo da Superdeli</h2>
          <p className="section-description">
            {metric === "revenue"
              ? "Vendas por dia, em reais"
              : "Valor descartado por dia, ao custo"}
          </p>
        </div>
        <div className="chart-toggle">
          <button
            aria-pressed={metric === "revenue"}
            className={metric === "revenue" ? "selected" : ""}
            onClick={() => setMetric("revenue")}
          >
            Vendas
          </button>
          <button
            aria-pressed={metric === "loss"}
            className={metric === "loss" ? "selected" : ""}
            onClick={() => setMetric("loss")}
          >
            Perdas
          </button>
        </div>
      </div>
      <div className="chart-summary">
        <strong>{money(total)}</strong>
        <span>no período selecionado</span>
      </div>
      <div
        className="chart"
        role="img"
        aria-label={`${metric === "revenue" ? "Vendas" : "Perdas"} diárias: ${series.map((item) => `${dateLabel(item.date)}: ${money(item.value)}`).join("; ")}`}
      >
        <div className="chart-axis">
          {[max, max * 0.75, max * 0.5, max * 0.25, 0].map((value) => (
            <span key={value}>{number(Math.round(value))}</span>
          ))}
        </div>
        <div className="plot">
          <div className="grid-lines">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div
            className="bars"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, series.length)}, minmax(0, 1fr))`,
              gap: series.length > 14 ? "3px" : undefined,
            }}
          >
            {series.map((day, index) => (
              <div className="bar-column" key={day.date}>
                <div
                  className={`bar ${index === series.length - 1 ? "current" : ""}`}
                  style={{ height: `${Math.max(1, (day.value / max) * 100)}%` }}
                >
                  <span className="chart-tooltip">
                    {dateLabel(day.date)}
                    <strong>{money(day.value)}</strong>
                  </span>
                </div>
                <span className="bar-label">
                  {series.length <= 7
                    ? dateLabel(day.date, { weekday: "short" }).replace(".", "")
                    : index % (series.length > 14 ? 5 : 2) === 0
                      ? dateLabel(day.date, { day: "2-digit" })
                      : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="chart-bottom">
        <span>
          <i className="legend-marker" />
          {metric === "revenue" ? "Receita de vendas" : "Descarte ao custo"}
        </span>
        <span>Valores ilustrativos</span>
      </div>
    </section>
  );
}

function ProductTable({
  records,
  filteredProducts,
  compact = false,
  onExpand,
}: {
  records: DailyRecord[];
  filteredProducts: typeof products;
  compact?: boolean;
  onExpand?: () => void;
}) {
  const inventory = inventorySummary(records);
  return (
    <section className="panel products-panel">
      <div className="panel-heading">
        <div>
          <h2>
            {compact ? "Da produção ao balcão" : "Desempenho por produto"}
          </h2>
          <p className="section-description">
            {compact
              ? "Como os produtos do piloto se comportaram no período."
              : "Vendas, sobras e retorno calculados a partir dos registros."}
          </p>
        </div>
        {onExpand && (
          <button className="text-button" onClick={onExpand}>
            Ver produtos
            <ArrowRight size={16} />
          </button>
        )}
      </div>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">
            Desempenho dos produtos do piloto
          </caption>
          <thead>
            <tr>
              <th>Produto</th>
              <th className="numeric">Vendido</th>
              <th className="numeric">Receita</th>
              <th>Destino da produção</th>
              {!compact && <th className="numeric">Retorno estimado</th>}
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product, index) => {
              const data = productSummary(records, product.id);
              const rate = data.produced ? data.leftover / data.produced : 0;
              const discarded = data.produced
                ? data.discarded / data.produced
                : 0;
              const sold = data.produced ? data.sold / data.produced : 0;
              const stock = inventory.find(
                (item) => item.product.id === product.id,
              );
              const status = stock
                ? stock.status
                : data.stockouts > 0
                  ? "Faltou no balcão"
                  : rate > 0.16
                    ? "Revisar sobras"
                    : "Em equilíbrio";
              return (
                <tr key={product.id}>
                  <th scope="row">
                    <div className="product-name">
                      <span className={`product-avatar avatar-${index % 3}`}>
                        <Wheat size={20} />
                      </span>
                      <div>
                        <strong>{product.name}</strong>
                        <span>{product.category}</span>
                      </div>
                    </div>
                  </th>
                  <td className="numeric">
                    {number(data.sold)}
                    <span className="cell-detail">{product.unit}</span>
                  </td>
                  <td className="numeric">{money(data.revenue)}</td>
                  <td className="balance-cell">
                    {stock ? (
                      <>
                        <strong>
                          {stock.stock === null
                            ? "Sem registro"
                            : `${number(stock.stock)} ${product.unit}`}
                        </strong>
                        <span className="cell-detail">
                          Estoque final · mínimo {product.minimumStock}
                        </span>
                      </>
                    ) : (
                      <>
                        <div
                          className="balance-strip"
                          aria-label={`${number(data.sold)} vendidas, ${number(data.leftover - data.discarded)} de outras sobras, ${number(data.discarded)} descartadas`}
                        >
                          <span
                            className="balance-sold"
                            style={{ width: `${sold * 100}%` }}
                          />
                          <span
                            className="balance-retained"
                            style={{
                              width: `${Math.max(0, rate - discarded) * 100}%`,
                            }}
                          />
                          <span
                            className="balance-discarded"
                            style={{ width: `${discarded * 100}%` }}
                          />
                        </div>
                        <span className="cell-detail">
                          {number(data.leftover)} de sobra ·{" "}
                          {number(data.discarded)} descartadas
                        </span>
                      </>
                    )}
                  </td>
                  {!compact && (
                    <td className="numeric">
                      {money(data.revenue - data.cost - data.loss)}
                    </td>
                  )}
                  <td>
                    <span
                      className={`badge ${status === "Em equilíbrio" ? "success" : "warning"}`}
                    >
                      <span />
                      {status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filteredProducts.length && (
          <div className="empty-state">
            <Search size={26} />
            <h3>Nenhum produto encontrado</h3>
            <p>Tente outro nome ou limpe a busca.</p>
          </div>
        )}
      </div>
      <div className="table-legend">
        <span>
          <i className="sold-key" />
          Vendido
        </span>
        <span>
          <i className="retained-key" />
          Outras sobras
        </span>
        <span>
          <i className="discarded-key" />
          Descartado
        </span>
      </div>
    </section>
  );
}

function RecordForm({
  formRef,
  ready,
  records,
  onSave,
}: {
  formRef: React.RefObject<HTMLFormElement | null>;
  ready: boolean;
  records: DailyRecord[];
  onSave: (record: DailyRecord) => void;
}) {
  const [productId, setProductId] = useState(products[0].id);
  const [date, setDate] = useState(DEMO_END);
  const [produced, setProduced] = useState("");
  const [openingStock, setOpeningStock] = useState("");
  const retail =
    products.find((p) => p.id === productId)?.operation === "retail";
  const available = retail
    ? Number(openingStock) + Number(produced)
    : Number(produced);
  const [sold, setSold] = useState("");
  const [discarded, setDiscarded] = useState("");
  const [stockout, setStockout] = useState("");
  const [leftoverDestination, setLeftoverDestination] =
    useState<keyof typeof leftoverDestinations>("unspecified");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const existing = records.find(
    (r) => r.date === date && r.productId === productId,
  );
  const leftover =
    produced !== "" && sold !== "" ? available - Number(sold) : null;
  function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    if (
      [produced, sold, discarded, ...(retail ? [openingStock] : [])].some(
        (v) => !v.trim(),
      )
    ) {
      setError(
        "Preencha produção, vendas e descartes. Use 0 quando não houver unidades.",
      );
      formRef.current
        ?.querySelector<HTMLInputElement>('input[data-quantity][value=""]')
        ?.focus();
      return;
    }
    const record = {
      date,
      productId,
      produced: available,
      ...(retail
        ? { openingStock: Number(openingStock), received: Number(produced) }
        : {}),
      sold: Number(sold),
      discarded: Number(discarded),
      stockout,
      leftoverDestination: retail ? ("stock" as const) : leftoverDestination,
    };
    const issue = validateRecord(record);
    if (issue) {
      setError(issue);
      const field = issue.includes("data")
        ? "record-date"
        : issue.includes("horário") || issue.includes("falta")
          ? "record-stockout"
          : "record-produced";
      formRef.current?.querySelector<HTMLInputElement>(`#${field}`)?.focus();
      return;
    }
    try {
      onSave(record);
      setError("");
      setSaved(true);
    } catch (error) {
      setError((error as Error).message);
    }
  }
  function loadExisting() {
    if (!existing) return;
    setProduced(String(retail ? existing.received : existing.produced));
    setOpeningStock(String(existing.openingStock ?? ""));
    setSold(String(existing.sold));
    setDiscarded(String(existing.discarded));
    setStockout(existing.stockout);
    setLeftoverDestination(existing.leftoverDestination ?? "unspecified");
    setError("");
    setSaved(false);
  }
  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={submit}
      onChange={() => setSaved(false)}
    >
      <div className="form-row">
        <div className="field">
          <label htmlFor="record-product">Produto</label>
          <select
            id="record-product"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setProduced("");
              setOpeningStock("");
              setSold("");
              setDiscarded("");
              setStockout("");
              setError("");
            }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="record-date">Data</label>
          <input
            id="record-date"
            type="date"
            value={date}
            min={addDays(DEMO_END, -29)}
            max={DEMO_END}
            aria-invalid={!!error}
            aria-describedby={error ? "record-error" : undefined}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
      {retail && (
        <div className="field">
          <label htmlFor="record-opening-stock">Estoque inicial</label>
          <input
            id="record-opening-stock"
            type="number"
            min="0"
            max="100000"
            step="1"
            value={openingStock}
            onChange={(e) => setOpeningStock(e.target.value)}
          />
          <p className="field-help">
            Conte o estoque no início do dia. Entradas são as unidades
            recebidas; saldo final fica em estoque para o próximo dia. Cada
            registro é uma contagem independente.
          </p>
        </div>
      )}
      <div className="form-row quantities">
        {[
          {
            id: "produced",
            label: retail ? "Entradas" : "Produzido",
            value: produced,
            setter: setProduced,
          },
          { id: "sold", label: "Vendido", value: sold, setter: setSold },
          {
            id: "discarded",
            label: "Descartado",
            value: discarded,
            setter: setDiscarded,
          },
        ].map((field) => (
          <div className="field" key={field.id}>
            <label htmlFor={`record-${field.id}`}>{field.label}</label>
            <input
              data-quantity
              id={`record-${field.id}`}
              type="number"
              inputMode="numeric"
              min="0"
              max="100000"
              step="1"
              placeholder="0"
              value={field.value}
              onChange={(e) => field.setter(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? "record-error" : "balance-help"}
            />
          </div>
        ))}
      </div>
      <p id="balance-help" className="field-help">
        {retail
          ? `Disponível: ${number(available)} · estoque final: ${number(Math.max(0, available - Number(sold) - Number(discarded)))}. Estoque não vendido não é desperdício.`
          : leftover !== null && leftover >= 0
            ? `${number(leftover)} unidades de sobra${discarded ? ` · ${number(Math.max(0, leftover - Number(discarded)))} não descartadas` : ""}.`
            : "Sobra = produção − vendas. Descarte é parte da sobra."}
      </p>
      {!retail && (
        <div className="field destination-field">
          <label htmlFor="record-destination">
            Destino da sobra não descartada
          </label>
          <select
            id="record-destination"
            value={leftoverDestination}
            onChange={(e) =>
              setLeftoverDestination(
                e.target.value as keyof typeof leftoverDestinations,
              )
            }
          >
            {Object.entries(leftoverDestinations).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="record-stockout">
          Acabou antes de fechar? <span>Opcional</span>
        </label>
        <input
          id="record-stockout"
          type="time"
          value={stockout}
          aria-invalid={!!error}
          aria-describedby={
            error ? "record-error stockout-help" : "stockout-help"
          }
          onChange={(e) => setStockout(e.target.value)}
        />
        <span id="stockout-help" className="field-help">
          Informe o horário apenas se todas as unidades foram vendidas.
        </span>
      </div>
      {existing && (
        <div className="existing-note">
          <span>
            Já existe um registro deste produto nesta data. Salvar substituirá
            esse registro.
          </span>
          <button type="button" className="text-button" onClick={loadExisting}>
            Carregar registro
            <ArrowRight size={14} />
          </button>
        </div>
      )}
      <div className="form-feedback">
        {error && (
          <p id="record-error" role="alert" className="field-error">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="save-success">
            <Check size={16} />
            Registro salvo neste navegador.
          </p>
        )}
      </div>
      <button type="submit" disabled={!ready} className="button primary">
        <Check size={17} />
        Salvar registro
      </button>
    </form>
  );
}

function InventoryPanel({
  records,
  days,
  onExpand,
}: {
  records: DailyRecord[];
  days: number;
  onExpand?: () => void;
}) {
  const inventory = inventorySummary(records, DEMO_END, days);
  const stockValue = inventory.reduce((sum, item) => sum + item.stockAtCost, 0);
  return (
    <section className="panel inventory-panel">
      <div className="panel-heading">
        <div>
          <h2>Nas prateleiras e no freezer</h2>
          <p className="section-description">
            Mercadorias de revenda · última contagem até {dateLabel(DEMO_END)}.
          </p>
        </div>
        {onExpand && (
          <button className="text-button" onClick={onExpand}>
            Ver estoque <ArrowRight size={16} />
          </button>
        )}
      </div>
      <div className="inventory-summary">
        <div>
          <span>Estoque ao custo</span>
          <strong>{money(stockValue)}</strong>
        </div>
        <div>
          <span>Precisam de reposição</span>
          <strong>
            {inventory.filter((item) => item.status === "Repor estoque").length}{" "}
            {inventory.filter((item) => item.status === "Repor estoque")
              .length === 1
              ? "produto"
              : "produtos"}
          </strong>
        </div>
        <div>
          <span>Sem giro recente</span>
          <strong>
            {
              inventory.filter((item) => item.status === "Sem giro recente")
                .length
            }{" "}
            {inventory.filter((item) => item.status === "Sem giro recente")
              .length === 1
              ? "produto"
              : "produtos"}
          </strong>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">Estoque dos itens de revenda</caption>
          <thead>
            <tr>
              <th>Produto</th>
              <th className="numeric">Estoque final</th>
              <th className="numeric">Mínimo</th>
              <th>Última venda</th>
              <th>Cobertura estimada</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item) => (
              <tr key={item.product.id}>
                <th scope="row">
                  <div className="product-name">
                    <span className="product-avatar avatar-1">
                      <Package size={20} />
                    </span>
                    <div>
                      <strong>{item.product.name}</strong>
                      <span>{item.product.category} · revenda</span>
                    </div>
                  </div>
                </th>
                <td className="numeric">
                  {item.stock === null ? "—" : number(item.stock)}
                  <span className="cell-detail">
                    {item.product.unit} ·{" "}
                    {item.recordedDate
                      ? dateLabel(item.recordedDate)
                      : "sem contagem"}
                  </span>
                </td>
                <td className="numeric">{item.product.minimumStock}</td>
                <td>
                  {item.lastSaleDate
                    ? dateLabel(item.lastSaleDate)
                    : "Sem venda registrada"}
                  {item.daysWithoutSale !== null &&
                    item.daysWithoutSale > 0 && (
                      <span className="cell-detail">
                        {item.daysWithoutSale} dias sem venda
                      </span>
                    )}
                </td>
                <td>
                  {item.coverageDays === null
                    ? "Sem vendas no período"
                    : `${number(item.coverageDays)} dias`}
                </td>
                <td>
                  <span
                    className={`badge ${item.status === "Em equilíbrio" ? "success" : "warning"}`}
                  >
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="inventory-note">
        Estoque final = estoque inicial + entradas − vendas − descartes. Usamos
        a última contagem, sem somar saldos diários. Cobertura pela média dos
        dias registrados no período; validade e temperatura ainda não são
        acompanhadas. Preços, embalagens e mínimos são exemplos fictícios.
      </p>
    </section>
  );
}
