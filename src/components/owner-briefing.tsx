"use client";

import {
  ArrowRight,
  ClipboardCheck,
  Leaf,
  Package,
  TriangleAlert,
} from "lucide-react";
import { dateLabel, DEMO_END, money, type DailyRecord } from "@/lib/demo";
import { ownerSummary } from "@/lib/operations";

export function OwnerBriefing({
  records,
  days,
  onNavigate,
}: {
  records: DailyRecord[];
  days: number;
  onNavigate: (
    view: "purchases" | "insights" | "inventory" | "production",
  ) => void;
}) {
  const summary = ownerSummary(records, days);
  const actions = [
    ...(summary.lowStock.length
      ? [
          {
            id: "stock",
            icon: Package,
            title: `Confira a reposição de ${summary.lowStock[0].product.name}`,
            detail: `${summary.lowStock[0].stock} embalagens na última contagem; mínimo de ${summary.lowStock[0].product.minimumStock}.`,
            action: "Planejar compra",
            view: "purchases" as const,
            badge: "Reposição",
          },
        ]
      : []),
    ...(summary.largestLoss
      ? [
          {
            id: "loss",
            icon: Leaf,
            title: `${summary.largestLoss.product.name}: maior perda por descarte`,
            detail: `${money(summary.largestLoss.loss)} ao custo nos ${days} dias. Confira os registros antes de ajustar a produção.`,
            action: "Revisar perdas",
            view: "insights" as const,
            badge: "Desperdício",
          },
        ]
      : []),
    ...(summary.idleStock.length
      ? [
          {
            id: "idle",
            icon: Package,
            title: `${summary.idleStock[0].product.name}: estoque sem giro`,
            detail: `${money(summary.idleStockAtCost)} ao custo nos itens sem giro recente. Confira a validade e a procura.`,
            action: "Conferir estoque",
            view: "inventory" as const,
            badge: "Dinheiro em estoque",
          },
        ]
      : []),
    ...(summary.totals.stockouts
      ? [
          {
            id: "shortage",
            icon: TriangleAlert,
            title: `${summary.totals.stockouts} registros de falta no período`,
            detail:
              "Observe os produtos que acabam cedo antes de reduzir fornadas ou compras.",
            action: "Ver registros",
            view: "production" as const,
            badge: "Faltas",
          },
        ]
      : []),
  ];
  return (
    <section className="owner-briefing" aria-labelledby="owner-briefing-title">
      <div className="owner-briefing-heading">
        <div>
          <span className="small-label">A ROTINA EM PRIMEIRO LUGAR</span>
          <h2 id="owner-briefing-title">Por onde começar</h2>
        </div>
        <span className="owner-date">
          <ClipboardCheck size={15} />
          Base até {dateLabel(DEMO_END)}
        </span>
      </div>
      <ul className="owner-priorities">
        {actions.map(
          ({ id, icon: Icon, title, detail, action, view, badge }) => (
            <li key={id}>
              <Icon size={19} aria-hidden="true" />
              <div>
                <span className="priority-category">{badge}</span>
                <h3>{title}</h3>
                <p>{detail}</p>
              </div>
              <button className="text-button" onClick={() => onNavigate(view)}>
                {action}
                <ArrowRight size={15} />
              </button>
            </li>
          ),
        )}
      </ul>
      {!actions.length && (
        <p className="owner-empty">
          Nenhum alerta identificado. Continue registrando vendas, estoque e
          descartes para acompanhar a operação.
        </p>
      )}
      <p className="owner-context">
        Leitura dos dados simulados. {summary.coveragePercent}% dos registros
        esperados no período estão preenchidos. Você revisa e decide cada ação.
      </p>
    </section>
  );
}
