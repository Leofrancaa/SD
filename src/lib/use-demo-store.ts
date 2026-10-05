"use client";

import { useSyncExternalStore } from "react";
import {
  generateRecords,
  extendCatalog,
  parseState,
  STORAGE_KEY,
  type DemoState,
} from "./demo";

type Snapshot = { state: DemoState; ready: boolean; error: string };
const initial: Snapshot = {
  state: { version: 1, records: generateRecords(), decisions: {} },
  ready: false,
  error: "",
};
let snapshot = initial;
let lastRaw: string | null = null;
let initialized = false;
const listeners = new Set<() => void>();
function publish(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}
function load() {
  try {
    lastRaw = localStorage.getItem(STORAGE_KEY);
    publish({
      state: lastRaw ? extendCatalog(parseState(lastRaw)) : initial.state,
      ready: true,
      error: "",
    });
  } catch {
    publish({
      state: snapshot.state,
      ready: true,
      error:
        "Os registros locais não puderam ser carregados. A demonstração continua disponível; o salvamento está bloqueado para proteger seus dados. Verifique o armazenamento do navegador.",
    });
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!initialized) {
    initialized = true;
    queueMicrotask(load);
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) load();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
function save(state: DemoState) {
  if (!snapshot.ready || snapshot.error)
    throw new Error(
      "O armazenamento local não está disponível. Seus campos foram preservados.",
    );
  try {
    if (localStorage.getItem(STORAGE_KEY) !== lastRaw) {
      load();
      throw new Error(
        "Os registros mudaram em outra aba. Confira os dados atualizados antes de salvar novamente.",
      );
    }
    const raw = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, raw);
    lastRaw = raw;
    publish({ state, ready: true, error: "" });
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message.includes("outra aba")
        ? error.message
        : "Não foi possível salvar neste navegador. Libere armazenamento ou permita dados locais e tente novamente. Seus campos foram preservados.",
    );
  }
}
export function useDemoStore() {
  const value = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => initial,
  );
  return { ...value, save };
}
