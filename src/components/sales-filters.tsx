"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Select } from "./ui/select";
import { dateBr } from "@/lib/format";
import type { ApiError } from "@/lib/use-api";
import type { SalesFilters } from "@/lib/use-sales-filters";
import {
  daysBetween,
  isIsoDate,
  presetLabels,
  situacaoLabels,
  type Preset,
  type Situacao,
} from "@/lib/vendas";

export function SalesToolbar({
  filters,
  loading,
  firstDay,
  label = "Filtros",
  children,
}: {
  filters: SalesFilters;
  loading: boolean;
  firstDay?: string | null;
  label?: string;
  children?: ReactNode;
}) {
  const { preset, custom, situacao, range, today } = filters;
  return (
    <div className="rs-toolbar" role="group" aria-label={label}>
      <div className="period-field">
        <span aria-hidden="true">Período</span>
        <Select
          ariaLabel="Período"
          size="compact"
          value={preset}
          options={(Object.keys(presetLabels) as Preset[]).map((key) => ({
            value: key,
            label: presetLabels[key],
          }))}
          onValueChange={(value) => filters.setPreset(value as Preset)}
        />
      </div>
      {preset === "personalizado" && custom && (
        <div className="rs-dates">
          <label>
            <span>De</span>
            <input
              type="date"
              value={custom.ini}
              min={firstDay ?? undefined}
              max={custom.fim}
              onChange={(event) => {
                const ini = event.target.value;
                if (
                  isIsoDate(ini) &&
                  ini <= custom.fim &&
                  daysBetween(ini, custom.fim) <= 800
                )
                  filters.setCustom({ ...custom, ini });
              }}
            />
          </label>
          <label>
            <span>Até</span>
            <input
              type="date"
              value={custom.fim}
              min={custom.ini}
              max={today}
              onChange={(event) => {
                const fim = event.target.value;
                if (isIsoDate(fim) && fim >= custom.ini && fim <= today)
                  filters.setCustom({ ...custom, fim });
              }}
            />
          </label>
        </div>
      )}
      <div className="period-field">
        <span aria-hidden="true">Pedidos</span>
        <Select
          ariaLabel="Situação dos pedidos"
          size="compact"
          value={situacao}
          options={(Object.keys(situacaoLabels) as Situacao[]).map((key) => ({
            value: key,
            label: situacaoLabels[key],
          }))}
          onValueChange={(value) => filters.setSituacao(value as Situacao)}
        />
      </div>
      <span className="date-range">
        {range.ini === range.fim
          ? dateBr(range.ini, {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : `${dateBr(range.ini, { day: "2-digit", month: "short" })} — ${dateBr(range.fim, { day: "2-digit", month: "short", year: "numeric" })}`}
      </span>
      <div className="rs-toolbar-actions">
        <button
          className="button secondary"
          onClick={filters.refresh}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? "rs-spin" : ""} />
          Atualizar
        </button>
        {children}
      </div>
    </div>
  );
}

export function ApiErrorBanner({
  error,
  onRetry,
}: {
  error: ApiError;
  onRetry: () => void;
}) {
  return (
    <div className="error-banner rs-error" role="alert">
      <strong>{error.text}</strong>
      {error.config ? (
        <span>
          Falta definir SUPABASE_URL, SUPABASE_SECRET_KEY e SUPABASE_EMPRESA_ID
          nas variáveis do servidor.
        </span>
      ) : (
        <button className="text-button" onClick={onRetry}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}

export function filterQuery(filters: SalesFilters) {
  return new URLSearchParams({
    ini: filters.range.ini,
    fim: filters.range.fim,
    situacao: filters.situacao,
  }).toString();
}
