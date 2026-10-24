"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Lightbulb,
  Link2,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { ApiErrorBanner, SalesToolbar, filterQuery } from "./sales-filters";
import { Chapter } from "./products-view";
import { integer, money, percent, shortDate, titleCase } from "@/lib/format";
import { useApi, type ApiError } from "@/lib/use-api";
import { useSalesFilters, type SalesFilters } from "@/lib/use-sales-filters";
import type { Insight, InsightTipo, RespostaInsights } from "@/lib/vendas";

export const tipoInfo: Record<
  InsightTipo,
  { label: string; icon: LucideIcon; className: string }
> = {
  oportunidade: {
    label: "Oportunidade",
    icon: Lightbulb,
    className: "tipo-oportunidade",
  },
  alerta: { label: "Alerta", icon: AlertTriangle, className: "tipo-alerta" },
  tendencia: {
    label: "Tendência",
    icon: TrendingUp,
    className: "tipo-tendencia",
  },
  destaque: { label: "Destaque", icon: Award, className: "tipo-destaque" },
};
const impactoLabel = {
  alto: "Impacto alto",
  medio: "Impacto médio",
  baixo: "Impacto baixo",
};

/** Busca (ou gera) os insights do período; permite gerar de novo. */
export function useInsights(filters: SalesFilters) {
  const url = filters.ready ? `/api/insights?${filterQuery(filters)}` : null;
  const api = useApi<RespostaInsights>(url, filters.nonce);
  const [override, setOverride] = useState<{
    key: string;
    data: RespostaInsights;
  } | null>(null);
  const [regenError, setRegenError] = useState<ApiError | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const key = filterQuery(filters);
  async function regenerate() {
    setRegenerating(true);
    setRegenError(null);
    try {
      const response = await fetch(`/api/insights?${key}`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        setRegenError({
          text: body.error ?? "Não foi possível gerar a análise.",
        });
      else setOverride({ key, data: body as RespostaInsights });
    } catch {
      setRegenError({ text: "Sem conexão com o servidor. Tente de novo." });
    } finally {
      setRegenerating(false);
    }
  }
  const data = override?.key === key ? override.data : api.data;
  return {
    data,
    error: regenError ?? api.error,
    loading: api.loading,
    regenerating,
    regenerate,
  };
}

export function InsightCard({
  insight,
  onAsk,
}: {
  insight: Insight;
  onAsk?: (question: string) => void;
}) {
  const info = tipoInfo[insight.tipo];
  const Icon = info.icon;
  return (
    <article className={`panel rs-insight ${info.className}`}>
      <div className="rs-insight-top">
        <span className="rs-insight-tag">
          <Icon size={15} />
          {info.label}
        </span>
        <span className={`rs-impacto ${insight.impacto}`}>
          {impactoLabel[insight.impacto]}
        </span>
      </div>
      <h3>{insight.titulo}</h3>
      <p>{insight.explicacao}</p>
      <p className="rs-evidencia">{insight.evidencia}</p>
      <p className="rs-acao">
        <strong>O que fazer:</strong> {insight.acao}
      </p>
      {onAsk && (
        <button
          type="button"
          className="text-button"
          onClick={() =>
            onAsk(`Me explique melhor: ${insight.titulo}. ${insight.acao}`)
          }
        >
          <MessageCircle size={14} />
          Aprofundar com a Cifrai
        </button>
      )}
    </article>
  );
}

export function InsightsLoading() {
  return (
    <div className="panel rs-ai-loading" role="status">
      <LoaderCircle size={20} className="rs-spin" />
      <div>
        <strong>A Cifrai está analisando as vendas…</strong>
        <span>
          Ela lê o período, compara com o anterior e procura oportunidades. Leva
          alguns segundos.
        </span>
      </div>
    </div>
  );
}

export function InsightsView({
  onAsk,
}: {
  onAsk?: (question: string) => void;
}) {
  const filters = useSalesFilters();
  const { data, error, loading, regenerating, regenerate } =
    useInsights(filters);
  const busy = loading || regenerating;
  const geradoEm = data
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(data.gerado_em))
    : null;
  const porTipo = (tipos: InsightTipo[]) =>
    data?.conteudo.insights.filter((i) => tipos.includes(i.tipo)) ?? [];

  return (
    <div className="rs" aria-busy={busy}>
      <SalesToolbar
        filters={filters}
        loading={busy}
        label="Filtros dos insights"
      >
        {data?.podeGerar && (
          <button
            className="button secondary"
            onClick={regenerate}
            disabled={busy}
          >
            <Sparkles size={15} />
            {regenerating ? "Gerando…" : "Gerar de novo"}
          </button>
        )}
      </SalesToolbar>
      {error && <ApiErrorBanner error={error} onRetry={filters.refresh} />}
      {busy && !data && <InsightsLoading />}
      {regenerating && data && <InsightsLoading />}
      {data && (
        <div className={`rs-content ${busy ? "rs-stale" : ""}`}>
          <section className="panel rs-ai-hero">
            <span className="rs-ai-label">
              <Sparkles size={16} />
              Análise da Cifrai
            </span>
            <h2>{data.conteudo.manchete}</h2>
            <p>{data.conteudo.resumo}</p>
            <span className="rs-ai-meta">
              Gerada em {geradoEm?.replace(",", " às")} a partir de{" "}
              {integer(data.base.pedidos)} pedidos (
              {money(data.base.faturamento)}) de {shortDate(data.periodo.ini)} a{" "}
              {shortDate(data.periodo.fim)}. A IA pode errar: confira os números
              nas outras abas.
            </span>
          </section>

          <Chapter
            n={1}
            title="Onde dá para ganhar mais"
            caption="Oportunidades e destaques que a Cifrai encontrou nos números do período."
          />
          <div className="rs-insight-grid">
            {porTipo(["oportunidade", "destaque"]).map((insight) => (
              <InsightCard
                key={insight.titulo}
                insight={insight}
                onAsk={onAsk}
              />
            ))}
          </div>

          {porTipo(["alerta", "tendencia"]).length > 0 && (
            <>
              <Chapter
                n={2}
                title="O que merece atenção"
                caption="Alertas e tendências para acompanhar de perto."
              />
              <div className="rs-insight-grid">
                {porTipo(["alerta", "tendencia"]).map((insight) => (
                  <InsightCard
                    key={insight.titulo}
                    insight={insight}
                    onAsk={onAsk}
                  />
                ))}
              </div>
            </>
          )}

          {data.cestas.length > 0 && (
            <>
              <Chapter
                n={porTipo(["alerta", "tendencia"]).length ? 3 : 2}
                title="Combos que os clientes já montam sozinhos"
                caption={`Pares de produtos que aparecem juntos no mesmo pedido mais do que o acaso explicaria (${shortDate(data.cestasPeriodo.ini)} a ${shortDate(data.cestasPeriodo.fim)}). Bons candidatos a combo, exposição lado a lado ou sugestão no balcão.`}
              />
              <section className="panel rs-cestas">
                <ul>
                  {data.cestas.slice(0, 8).map((c) => {
                    const forte = c.conf_a_b >= c.conf_b_a;
                    const de = forte ? c.a : c.b;
                    const para = forte ? c.b : c.a;
                    const conf = Math.max(c.conf_a_b, c.conf_b_a);
                    return (
                      <li key={`${c.a}|${c.b}`}>
                        <Link2 size={16} aria-hidden="true" />
                        <span className="rs-cesta-text">
                          <strong>{percent(conf * 100, 0)}</strong> de quem leva{" "}
                          <b>{titleCase(de)}</b> também leva{" "}
                          <b>{titleCase(para)}</b>
                        </span>
                        <span className="rs-cesta-meta">
                          {integer(c.pedidos)} pedidos ·{" "}
                          {c.lift.toLocaleString("pt-BR")}× a média
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}

          {onAsk && data.conteudo.perguntas.length > 0 && (
            <section className="panel rs-ask">
              <h2>
                <MessageCircle size={18} /> Quer ir mais fundo? Pergunte à
                Cifrai
              </h2>
              <div className="rs-ask-list">
                {data.conteudo.perguntas.map((q) => (
                  <button key={q} type="button" onClick={() => onAsk(q)}>
                    {q}
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            </section>
          )}
          {data.podeGerar && (
            <p className="rs-note">
              <RefreshCw size={12} /> A análise é guardada e reaproveitada;
              períodos que incluem hoje são refeitos a cada 3 horas, ou quando
              você pede.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
