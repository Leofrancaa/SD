// Chamadas ao Supabase feitas SÓ pelo servidor, com a chave secreta (service
// role). Nunca importe este arquivo em componentes "use client".

export class SupabaseNaoConfigurado extends Error {
  constructor() {
    super("Conexão com o Supabase não configurada no servidor.");
    this.name = "SupabaseNaoConfigurado";
  }
}

export function supabaseConfigurado() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export async function supabaseRpc<T>(
  fn: string,
  args: Record<string, unknown>,
  {
    signal,
    timeoutMs = 20_000,
  }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new SupabaseNaoConfigurado();
  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  // Chaves legadas (JWT "eyJ...") também precisam do Authorization; as novas
  // (sb_secret_...) vão só no apikey.
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
    cache: "no-store",
    signal: signal ?? AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    // Detalhes do provedor ficam só no log do servidor.
    console.error(
      `supabase rpc ${fn} falhou`,
      response.status,
      (await response.text()).slice(0, 300),
    );
    throw new Error(`Supabase respondeu ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
