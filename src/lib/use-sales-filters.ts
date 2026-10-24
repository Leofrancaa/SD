"use client";

// Filtros de período e situação compartilhados pelas abas, guardados na URL
// (vp, vi, vf, vs) para sobreviver à troca de aba e ao recarregar a página.
import { useEffect, useMemo, useState } from "react";
import {
  isIsoDate,
  isPreset,
  isSituacao,
  presetRange,
  todayInStore,
  type Preset,
  type Situacao,
} from "./vendas";

export type Range = { ini: string; fim: string };

function readUrl() {
  const params = new URLSearchParams(window.location.search);
  const vp = params.get("vp");
  const vi = params.get("vi");
  const vf = params.get("vf");
  const vs = params.get("vs");
  const custom =
    isIsoDate(vi) && isIsoDate(vf) && vi <= vf ? { ini: vi, fim: vf } : null;
  return {
    preset: (isPreset(vp) && (vp !== "personalizado" || custom)
      ? vp
      : "30d") as Preset,
    custom,
    situacao: (isSituacao(vs) ? vs : "todas") as Situacao,
  };
}

function writeUrl(preset: Preset, custom: Range | null, situacao: Situacao) {
  const params = new URLSearchParams(window.location.search);
  params.set("vp", preset);
  if (preset === "personalizado" && custom) {
    params.set("vi", custom.ini);
    params.set("vf", custom.fim);
  } else {
    params.delete("vi");
    params.delete("vf");
  }
  if (situacao === "todas") params.delete("vs");
  else params.set("vs", situacao);
  window.history.replaceState(window.history.state, "", `?${params}`);
}

const REFRESH_MS = 5 * 60_000;

export function useSalesFilters() {
  const [today, setToday] = useState(() => todayInStore());
  const [preset, setPreset] = useState<Preset>("30d");
  const [custom, setCustom] = useState<Range | null>(null);
  const [situacao, setSituacao] = useState<Situacao>("todas");
  const [ready, setReady] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const restore = () => {
      const state = readUrl();
      setPreset(state.preset);
      setCustom(state.custom);
      setSituacao(state.situacao);
      setReady(true);
    };
    restore();
  }, []);

  useEffect(() => {
    if (ready) writeUrl(preset, custom, situacao);
  }, [ready, preset, custom, situacao]);

  // Atualiza sozinho a cada 5 min com a aba visível (os dados chegam a cada ~30 min).
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setToday(todayInStore());
      setNonce((value) => value + 1);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const range: Range = useMemo(() => {
    if (preset === "personalizado" && custom) return custom;
    return presetRange(preset === "personalizado" ? "30d" : preset, today);
  }, [preset, custom, today]);

  return {
    ready,
    today,
    preset,
    custom,
    situacao,
    range,
    nonce,
    setPreset(next: Preset) {
      if (next === "personalizado" && !custom) setCustom(range);
      setPreset(next);
    },
    setCustom,
    setSituacao,
    refresh() {
      setToday(todayInStore());
      setNonce((value) => value + 1);
    },
    /** true quando o período termina hoje e o dia ainda está em andamento. */
    incompleteDay: range.fim === today,
  };
}

export type SalesFilters = ReturnType<typeof useSalesFilters>;
