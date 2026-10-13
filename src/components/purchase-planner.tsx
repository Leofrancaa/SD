"use client";

import { useState } from "react";
import { Download, ShoppingBasket } from "lucide-react";
import {
  DEMO_END,
  money,
  number,
  storeName,
  type DailyRecord,
} from "@/lib/demo";
import {
  purchaseCsv,
  purchasePlan,
  PURCHASE_HISTORY_DAYS,
} from "@/lib/operations";
import { downloadFile } from "@/lib/download";
import { Select } from "./ui/select";
import { SupplierMessages } from "./supplier-messages";

export function PurchasePlanner({
  records,
  ready,
  onNotice,
}: {
  records: DailyRecord[];
  ready: boolean;
  onNotice: (message: string) => void;
}) {
  const [targetDays, setTargetDays] = useState(7);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const plan = purchasePlan(records, targetDays).map((item) => {
    const raw = quantities[item.key] ?? String(item.quantity);
    const quantity = Number(raw);
    const valid =
      raw.trim() !== "" &&
      Number.isSafeInteger(quantity) &&
      quantity >= 0 &&
      quantity <= 100000;
    return {
      ...item,
      raw,
      quantity,
      valid,
      selected: selection[item.key] ?? item.quantity > 0,
    };
  });
  const selected = plan.filter((item) => item.selected);
  const multiStore = new Set(plan.map((item) => item.storeId)).size > 1;
  const invalid = selected.some((item) => !item.valid || item.quantity === 0);
  const estimatedCost = selected
    .filter((item) => item.valid)
    .reduce((sum, item) => sum + item.quantity * item.product.cost, 0);
  function exportPlan() {
    if (!selected.length || invalid || !ready) return;
    downloadFile(
      purchaseCsv(selected, targetDays),
      `superdeli-purchase-plan-${DEMO_END}.csv`,
      "text/csv;charset=utf-8",
    );
    onNotice(
      "Lista de compras exportada para revisão. Nenhum pedido foi enviado.",
    );
  }
  return (
    <section
      className="panel purchase-planner"
      aria-labelledby="purchase-title"
    >
      <div className="purchase-heading">
        <div>
          <span className="small-label">COMPRAR COM CRITÉRIO</span>
          <h2 id="purchase-title">Sua próxima lista de compras</h2>
          <p>
            Confira o saldo, ajuste as quantidades e leve a lista para o
            fornecedor.
          </p>
        </div>
        <ShoppingBasket size={28} aria-hidden="true" />
      </div>
      <div className="purchase-toolbar">
        <div className="field">
          <label htmlFor="purchase-horizon">Planejar para</label>
          <Select
            id="purchase-horizon"
            value={String(targetDays)}
            options={[3, 7, 14].map((value) => ({
              value: String(value),
              label: `${value} dias`,
            }))}
            onValueChange={(value) => {
              setTargetDays(Number(value));
              setQuantities({});
              setSelection({});
            }}
          />
        </div>
        <p>
          Base: média de vendas dos últimos {PURCHASE_HISTORY_DAYS} dias
          registrados e o estoque atual, mais o estoque mínimo. Não depende do
          período selecionado no painel.
        </p>
      </div>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">
            Lista de compras sugerida para revisão
          </caption>
          <thead>
            <tr>
              <th>Incluir</th>
              <th>Mercadoria</th>
              <th className="numeric">Estoque</th>
              <th className="numeric">Vendas / dia</th>
              <th>Comprar</th>
              <th className="numeric">Custo estimado</th>
            </tr>
          </thead>
          <tbody>
            {plan.map((item) => (
              <tr
                key={item.key}
                className={item.selected ? "purchase-selected" : undefined}
              >
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Incluir ${item.product.name}${multiStore ? ` · ${storeName(item.storeId)}` : ""}`}
                    checked={item.selected}
                    onChange={(event) =>
                      setSelection((current) => ({
                        ...current,
                        [item.key]: event.target.checked,
                      }))
                    }
                  />
                </td>
                <th scope="row">
                  <strong>{item.product.name}</strong>
                  {multiStore && (
                    <span className="store-chip">
                      {storeName(item.storeId)}
                    </span>
                  )}
                  <span className="cell-detail">
                    {item.stale
                      ? "Confira uma contagem atual antes de comprar"
                      : item.sold === 0
                        ? "Sem venda no período; conferir o giro"
                        : item.status === "Sem giro recente"
                          ? "Confira o giro antes de repor"
                          : `Mínimo: ${item.product.minimumStock} ${item.product.unit}`}
                  </span>
                </th>
                <td className="numeric" data-label="Estoque">
                  {item.stock === null ? "Sem registro" : number(item.stock)}
                </td>
                <td className="numeric" data-label="Vendas / dia">
                  {number(Math.round(item.averageDailySales * 10) / 10)}
                </td>
                <td data-label="Comprar">
                  <input
                    className="purchase-quantity"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="100000"
                    step="1"
                    aria-label={`Comprar ${item.product.name}${multiStore ? ` · ${storeName(item.storeId)}` : ""}`}
                    aria-invalid={
                      item.selected && (!item.valid || item.quantity === 0)
                    }
                    aria-describedby={
                      item.selected && (!item.valid || item.quantity === 0)
                        ? "purchase-error"
                        : "purchase-method"
                    }
                    value={item.raw}
                    onChange={(event) => {
                      setQuantities((current) => ({
                        ...current,
                        [item.key]: event.target.value,
                      }));
                      setSelection((current) => ({
                        ...current,
                        [item.key]: true,
                      }));
                    }}
                  />
                  <span className="cell-detail">{item.product.unit}</span>
                </td>
                <td className="numeric" data-label="Custo estimado">
                  {item.valid ? money(item.quantity * item.product.cost) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="purchase-total" aria-live="polite">
        <div>
          <span>
            {selected.length}{" "}
            {selected.length === 1 ? "item selecionado" : "itens selecionados"}
          </span>
          <strong>{money(estimatedCost)}</strong>
          <small>Compra estimada ao custo ilustrativo</small>
        </div>
        <button
          className="button primary"
          disabled={!ready || !selected.length || invalid}
          onClick={exportPlan}
        >
          <Download size={17} />
          Exportar lista de compras
        </button>
      </div>
      {invalid && (
        <p
          className="field-error purchase-error"
          id="purchase-error"
          role="alert"
        >
          Nos itens selecionados, informe quantidades inteiras de 1 a 100.000 ou
          desmarque o item.
        </p>
      )}
      {!selected.length && (
        <p className="purchase-note">
          Nenhum item selecionado. Se não houver reposição sugerida, você pode
          preencher uma quantidade e incluí-la na lista.
        </p>
      )}
      {!invalid && (
        <SupplierMessages
          items={selected.filter((item) => item.valid && item.quantity > 0)}
          onNotice={onNotice}
        />
      )}
      <p id="purchase-method" className="purchase-note">
        Sugestão = vendas médias × dias planejados + mínimo − estoque contado,
        arredondada para cima. Sem contagem atual ou sem vendas, confira o item
        manualmente. Desconte as unidades de pedidos já em andamento ao revisar
        as quantidades. A lista é um rascunho desta sessão; exporte para
        guardar. Nenhuma compra acontece automaticamente.
      </p>
    </section>
  );
}
