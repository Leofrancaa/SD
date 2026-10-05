"use client";

import { Printer } from "lucide-react";
import {
  addDays,
  dateLabel,
  DEMO_END,
  money,
  number,
  periodRecords,
  type DailyRecord,
} from "@/lib/demo";
import { rankProducts } from "@/lib/analytics";
import { ownerSummary } from "@/lib/operations";

export function OwnerReport({
  records,
  days,
}: {
  records: DailyRecord[];
  days: number;
}) {
  const report = ownerSummary(records, days);
  const ranked = rankProducts(periodRecords(records, days), "return")
    .filter((item) => item.sold > 0)
    .slice(0, 5);
  return (
    <section className="panel owner-report" aria-labelledby="report-title">
      <header className="report-heading">
        <div>
          <span className="small-label">SUPERDELI · PADARIA E MINIMERCADO</span>
          <h2 id="report-title">Resumo para o dono</h2>
          <p>
            {dateLabel(addDays(DEMO_END, -(days - 1)))} a{" "}
            {dateLabel(DEMO_END, {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <button
          className="button secondary report-print"
          onClick={() => window.print()}
        >
          <Printer size={17} />
          Imprimir / salvar PDF
        </button>
      </header>
      <p className="report-disclosure">
        Demonstração com dados simulados. Os valores abaixo não representam
        resultados reais da Superdeli.
      </p>
      <div className="report-financial">
        <h3>O resultado do período</h3>
        <dl>
          <div>
            <dt>Receita de vendas</dt>
            <dd>{money(report.totals.revenue)}</dd>
          </div>
          <div>
            <dt>Custo das unidades vendidas</dt>
            <dd>{money(report.totals.cost)}</dd>
          </div>
          <div>
            <dt>Perdas por descarte, ao custo</dt>
            <dd>{money(report.totals.loss)}</dd>
          </div>
          <div className="report-return">
            <dt>Retorno estimado</dt>
            <dd>{money(report.estimatedReturn)}</dd>
          </div>
        </dl>
        <p>
          Retorno = receita − custo das unidades vendidas − custo dos descartes.
          Despesas fixas, salários, impostos e aluguel não estão registrados;
          este valor não é lucro líquido.
        </p>
      </div>
      <div className="report-operational">
        <div>
          <span>Itens vendidos</span>
          <strong>{number(report.totals.sold)}</strong>
        </div>
        <div>
          <span>Registros de falta</span>
          <strong>{number(report.totals.stockouts)}</strong>
        </div>
        <div>
          <span>Estoque de revenda ao custo</span>
          <strong>{money(report.stockAtCost)}</strong>
        </div>
      </div>
      <section className="report-comparison">
        <h3>Comparação com o período anterior</h3>
        <p>
          {report.revenueChange === null
            ? "Comparação indisponível: são necessários dois períodos completos com os mesmos produtos. A base tem 30 dias."
            : `Vendas ${Math.abs(report.revenueChange).toFixed(1).replace(".", ",")}% ${report.revenueChange >= 0 ? "acima" : "abaixo"} do período anterior de ${days} dias.`}
        </p>
        {report.lossChange !== null && (
          <p>
            Descarte ao custo:{" "}
            {Math.abs(report.lossChange).toFixed(1).replace(".", ",")}%{" "}
            {report.lossChange <= 0 ? "menor" : "maior"}. Avalie as faltas junto
            com as perdas.
          </p>
        )}
      </section>
      <section className="report-ranking">
        <h3>Produtos com maior retorno estimado</h3>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">
              Cinco maiores retornos no período
            </caption>
            <thead>
              <tr>
                <th>Produto</th>
                <th className="numeric">Vendido</th>
                <th className="numeric">Receita</th>
                <th className="numeric">Retorno</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((item) => (
                <tr key={item.product.id}>
                  <th scope="row">{item.product.name}</th>
                  <td className="numeric">
                    {number(item.sold)} {item.product.unit}
                  </td>
                  <td className="numeric">{money(item.revenue)}</td>
                  <td className="numeric">{money(item.return)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!ranked.length && (
            <p className="owner-empty">
              Não há vendas registradas nesse período.
            </p>
          )}
        </div>
      </section>
      <section className="report-next-steps">
        <h3>Pontos para a próxima conversa</h3>
        <ul>
          {report.largestLoss && (
            <li>
              Revisar {report.largestLoss.product.name}:{" "}
              {money(report.largestLoss.loss)} em descartes ao custo.
            </li>
          )}
          {report.lowStock.map((item) => (
            <li key={item.product.id}>
              Conferir reposição de {item.product.name}: {item.stock} embalagens
              na última contagem.
            </li>
          ))}
          {report.idleStock.map((item) => (
            <li key={item.product.id}>
              Conferir giro e validade de {item.product.name}:{" "}
              {item.daysWithoutSale} dias sem venda registrada.
            </li>
          ))}
          <li>
            Acompanhar perdas e faltas antes e depois de qualquer ajuste
            aprovado pelo dono.
          </li>
        </ul>
      </section>
      <footer className="report-footer">
        Cobertura: {report.recordedDates} dias com registros ·{" "}
        {report.coveragePercent}% dos registros esperados. Estoque usa a última
        contagem até {dateLabel(DEMO_END)}. Dados e decisões ficam neste
        navegador; exporte uma cópia para guardar.
      </footer>
    </section>
  );
}
