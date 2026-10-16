"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  PackageMinus,
  ShoppingBasket,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import {
  dateLabel,
  DEMO_END,
  inventorySummary,
  latestStockRecord,
  number,
  periodBounds,
  periodLength,
  products,
  stockAlertLabels,
  stockAlertLevel,
  stockAlerts,
  STOCK_WARNING_FACTOR,
  storeName,
  stores,
  type DailyRecord,
  type Period,
  type StockAlertLevel,
} from "@/lib/demo";
import { Select } from "./ui/select";

export type StockHighlight = { key: string; nonce: number } | null;

const badgeTone: Record<StockAlertLevel, string> = {
  out: "danger",
  critical: "danger",
  warning: "warning",
};

function coverageText(days: number | null) {
  if (days === null) return "Sem vendas no período";
  if (days < 1) return "Acaba hoje no ritmo atual";
  return `Dá para ~${number(Math.round(days))} ${Math.round(days) === 1 ? "dia" : "dias"} de venda`;
}

/** Barra de nível: o traço marca o mínimo; a escala vai até o dobro dele. */
function StockMeter({
  stock,
  minimum,
  level,
}: {
  stock: number;
  minimum: number;
  level: StockAlertLevel | null;
}) {
  const scale = minimum * 2;
  return (
    <div
      className={`stock-meter ${level ?? "ok"}`}
      role="img"
      aria-label={`${number(stock)} em estoque para um mínimo de ${number(minimum)}`}
    >
      <i
        style={{
          width: `${Math.min(100, (Math.max(0, stock) / scale) * 100)}%`,
        }}
      />
      <b aria-hidden="true" />
    </div>
  );
}

export function StockAlerts({
  records,
  period,
  highlight,
  limit,
  onSimulate,
  onPlan,
}: {
  records: DailyRecord[];
  period: Period;
  highlight?: StockHighlight;
  limit?: number;
  onSimulate?: () => void;
  onPlan?: () => void;
}) {
  const { end } = periodBounds(period);
  const alerts = stockAlerts(records, end, periodLength(period));
  const shown = limit ? alerts.slice(0, limit) : alerts;
  const urgent = alerts.filter((item) => item.level !== "warning").length;
  return (
    <section
      className={`panel stock-alerts ${urgent ? "has-urgent" : ""}`}
      aria-labelledby="stock-alerts-title"
    >
      <div className="panel-heading">
        <div className="stock-alerts-title">
          <span className="stock-alerts-icon" aria-hidden="true">
            <TriangleAlert size={20} />
          </span>
          <div>
            <span className="small-label">ESTOQUE EM DESTAQUE</span>
            <h2 id="stock-alerts-title">Quase acabando</h2>
          </div>
          <span
            className="count-badge"
            aria-label={`${alerts.length} mercadorias quase acabando`}
          >
            {alerts.length}
          </span>
        </div>
        <div className="stock-alerts-actions">
          {onSimulate && (
            <button className="text-button" onClick={onSimulate}>
              Simular venda <ArrowRight size={15} />
            </button>
          )}
          {onPlan && alerts.length > 0 && (
            <button className="text-button" onClick={onPlan}>
              Planejar compra <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
      <p className="section-description stock-alerts-description">
        Mercadorias de revenda abaixo do mínimo ou até{" "}
        {Math.round((STOCK_WARNING_FACTOR - 1) * 100)}% acima dele, por loja ·
        contagem até{" "}
        {dateLabel(end, { day: "2-digit", month: "short", year: "numeric" })}.
      </p>
      {shown.length ? (
        <ul className="stock-alert-list">
          {shown.map((item) => {
            const fresh = highlight?.key === item.key;
            return (
              <li
                key={fresh ? `${item.key}-${highlight!.nonce}` : item.key}
                className={`stock-alert ${item.level} ${fresh ? "just-updated" : ""}`}
              >
                <div className="stock-alert-top">
                  <span className={`badge ${badgeTone[item.level]}`}>
                    <span />
                    {stockAlertLabels[item.level]}
                  </span>
                  <span className="stock-alert-store">
                    {storeName(item.storeId)}
                  </span>
                </div>
                <h3>{item.product.name}</h3>
                <p className="stock-alert-amount">
                  <strong>{number(item.stock)}</strong> {item.product.unit}
                  <span> · mínimo {number(item.minimum)}</span>
                </p>
                <StockMeter
                  stock={item.stock}
                  minimum={item.minimum}
                  level={item.level}
                />
                <p className="stock-alert-coverage">
                  {item.level === "out"
                    ? "Sem estoque para vender"
                    : coverageText(item.coverageDays)}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="stock-alerts-empty">
          Nenhuma mercadoria abaixo ou perto do mínimo nesta contagem.
        </p>
      )}
      {limit && alerts.length > limit && (
        <p className="stock-alerts-more">
          Mais {alerts.length - limit} em Estoque e reposição.
        </p>
      )}
    </section>
  );
}

const retailProducts = products.filter((p) => p.operation === "retail");

export function SaleSimulator({
  records,
  period,
  defaultStore,
  defaultProduct,
  ready,
  canUndo,
  onSell,
  onUndo,
}: {
  records: DailyRecord[];
  period: Period;
  defaultStore: string;
  defaultProduct: string;
  ready: boolean;
  canUndo: boolean;
  onSell: (sale: {
    storeId: string;
    productId: string;
    quantity: number;
  }) => void;
  onUndo: () => void;
}) {
  const [storeId, setStoreId] = useState(defaultStore);
  const [productId, setProductId] = useState(defaultProduct);
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState("");
  const product = retailProducts.find((p) => p.id === productId)!;
  const latest = latestStockRecord(records, storeId, productId);
  const stock = latest ? latest.produced - latest.sold - latest.discarded : 0;
  const minimum = product.minimumStock!;
  const entry = inventorySummary(
    records.filter((row) => row.storeId === storeId),
    DEMO_END,
    periodLength(period),
  )
    .find((item) => item.product.id === productId)
    ?.byStore.find((item) => item.storeId === storeId);
  const coverage = entry?.averageSales
    ? Math.round((stock / entry.averageSales) * 10) / 10
    : null;
  const amount = Number(quantity);
  const validAmount =
    quantity.trim() !== "" &&
    Number.isSafeInteger(amount) &&
    amount >= 1 &&
    amount <= stock;
  const after = validAmount ? stock - amount : null;
  const level = stockAlertLevel(stock, minimum);
  const afterLevel = after === null ? null : stockAlertLevel(after, minimum);
  const outsidePeriod = periodBounds(period).end < DEMO_END;

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      onSell({ storeId, productId, quantity: amount });
      setError("");
      setQuantity("1");
    } catch (issue) {
      setError((issue as Error).message);
    }
  }

  return (
    <section
      className="panel sale-simulator"
      aria-labelledby="sale-simulator-title"
    >
      <div className="panel-heading">
        <div>
          <span className="small-label">DEMONSTRAÇÃO</span>
          <h2 id="sale-simulator-title">Simular uma venda</h2>
        </div>
        <span className="tag">Simulação</span>
      </div>
      <p className="section-description">
        Registre uma venda no caixa e veja a mercadoria sair do estoque. A venda
        entra na contagem de{" "}
        {dateLabel(DEMO_END, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}{" "}
        e atualiza alertas, compras e indicadores.
      </p>
      <form noValidate onSubmit={submit}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="sale-store">Loja</label>
            <Select
              id="sale-store"
              value={storeId}
              options={stores.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              onValueChange={(value) => {
                setStoreId(value);
                setError("");
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="sale-quantity">
              Quantidade <span>{product.unit}</span>
            </label>
            <input
              id="sale-quantity"
              type="number"
              inputMode="numeric"
              min="1"
              max={Math.max(1, stock)}
              step="1"
              value={quantity}
              aria-invalid={!!error}
              aria-describedby={error ? "sale-error" : "sale-preview"}
              onChange={(e) => {
                setQuantity(e.target.value);
                setError("");
              }}
            />
          </div>
        </div>
        <div className="field sale-product">
          <label htmlFor="sale-product">Mercadoria</label>
          <Select
            id="sale-product"
            value={productId}
            options={retailProducts.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            onValueChange={(value) => {
              setProductId(value);
              setError("");
            }}
          />
        </div>
        <div className="sale-stock">
          <div className="sale-stock-row">
            <span>Em estoque agora</span>
            <strong>
              {number(stock)} {product.unit}
            </strong>
          </div>
          <StockMeter stock={stock} minimum={minimum} level={level} />
          <p className="sale-stock-detail">
            Mínimo {number(minimum)} ·{" "}
            {level ? stockAlertLabels[level].toLowerCase() : "acima do mínimo"}{" "}
            ·{" "}
            {stock <= 0
              ? "sem estoque para vender"
              : coverageText(coverage).toLowerCase()}
          </p>
        </div>
        <div
          className="sale-presets"
          role="group"
          aria-label="Quantidades rápidas"
        >
          {[1, 5, 10].map((value) => (
            <button
              key={value}
              type="button"
              className="button secondary"
              disabled={value > stock}
              onClick={() => {
                setQuantity(String(value));
                setError("");
              }}
            >
              {value}
            </button>
          ))}
          <button
            type="button"
            className="button secondary"
            disabled={stock <= 0}
            onClick={() => {
              setQuantity(String(stock));
              setError("");
            }}
          >
            Tudo ({number(stock)})
          </button>
        </div>
        <p id="sale-preview" className="field-help sale-preview">
          {after !== null
            ? `Depois da venda: ${number(after)} ${product.unit} · ${afterLevel ? stockAlertLabels[afterLevel].toLowerCase() : "acima do mínimo"}.`
            : stock <= 0
              ? "Mercadoria esgotada nesta loja. Registre uma entrada em Produção e vendas."
              : `Informe de 1 a ${number(stock)} ${product.unit}.`}
        </p>
        {error && (
          <p id="sale-error" className="field-error" role="alert">
            {error}
          </p>
        )}
        {!ready && (
          <p className="field-error">
            O armazenamento deste navegador não está disponível, então a venda
            não pode ser registrada.
          </p>
        )}
        {outsidePeriod && (
          <p className="field-help">
            O período selecionado termina antes dessa data. Escolha setembro de
            2026 para ver a venda nos alertas e nas tabelas.
          </p>
        )}
        <div className="sale-actions">
          <button
            type="submit"
            className="button primary"
            disabled={!ready || !validAmount}
          >
            <PackageMinus size={17} />
            Registrar venda
          </button>
          {canUndo && (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setError("");
                onUndo();
              }}
            >
              <Undo2 size={17} />
              Desfazer última venda
            </button>
          )}
        </div>
      </form>
      <p className="sale-note">
        <ShoppingBasket size={15} aria-hidden="true" />
        Venda de demonstração, salva só neste navegador. Não envolve caixa nem
        pagamento.
      </p>
    </section>
  );
}
