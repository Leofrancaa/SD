// Leitura das vendas reais no Supabase. SÓ roda no servidor.
import type { PainelVendas, Situacao } from "@/lib/vendas";
import { SupabaseNaoConfigurado, supabaseRpc } from "@/lib/supabase-server";

export class VendasNaoConfiguradas extends Error {
  constructor() {
    super("Conexão com o banco de vendas não configurada no servidor.");
    this.name = "VendasNaoConfiguradas";
  }
}

// Cache curto por instância: os dados chegam do BMWeb a cada ~30 min, então
// 2 min evitam consultas repetidas sem atrasar a atualização.
const TTL_MS = 120_000;
const MAX_ENTRIES = 60;
const cache = new Map<string, { expires: number; data: PainelVendas }>();

export async function painelVendas(
  ini: string,
  fim: string,
  situacao: Situacao,
  empresaId = process.env.SUPABASE_EMPRESA_ID,
): Promise<PainelVendas> {
  if (!empresaId) throw new VendasNaoConfiguradas();
  const cacheKey = `${empresaId}|${ini}|${fim}|${situacao}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > now) return hit.data;

  let data: PainelVendas;
  try {
    data = await supabaseRpc<PainelVendas>("painel_vendas", {
      p_empresa: empresaId,
      p_ini: ini,
      p_fim: fim,
      p_situacao: situacao,
    });
  } catch (error) {
    if (error instanceof SupabaseNaoConfigurado)
      throw new VendasNaoConfiguradas();
    throw error;
  }

  for (const [entry, value] of cache)
    if (value.expires <= now) cache.delete(entry);
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey, { expires: now + TTL_MS, data });
  return data;
}
