"use client";

// Busca JSON de uma rota interna, com cancelamento, redirecionamento no 401 e
// "loading" derivado (sem setState síncrono em efeito).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type ApiError = { text: string; config?: boolean };

export function useApi<T>(url: string | null, nonce = 0) {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = url ? `${url}#${nonce}` : null;

  useEffect(() => {
    if (!url || !key) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (!response.ok) {
          setError({
            text: body.error ?? "Não foi possível carregar os dados.",
            config: body.code === "not_configured",
          });
          return;
        }
        setError(null);
        setData(body as T);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        console.error(reason);
        setError({ text: "Sem conexão com o servidor. Tente de novo." });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(key);
      });
    return () => controller.abort();
  }, [url, key, router]);

  return { data, error, loading: Boolean(key) && loadedKey !== key };
}
