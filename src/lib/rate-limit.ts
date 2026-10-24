// Limite de tentativas em memória (por instância do servidor). Não substitui
// um limite distribuído, mas barra força bruta simples contra o login.
type Entry = { count: number; resetAt: number };

export function createLimiter({
  max,
  windowMs,
  maxKeys = 5000,
}: {
  max: number;
  windowMs: number;
  maxKeys?: number;
}) {
  const entries = new Map<string, Entry>();
  function prune(now: number) {
    for (const [key, entry] of entries)
      if (entry.resetAt <= now) entries.delete(key);
  }
  return {
    /** true se a chave já esgotou as tentativas na janela atual. */
    blocked(key: string, now = Date.now()) {
      const entry = entries.get(key);
      return Boolean(entry && entry.resetAt > now && entry.count >= max);
    },
    /** Registra uma falha; devolve quantas restam. */
    fail(key: string, now = Date.now()) {
      if (entries.size >= maxKeys) prune(now);
      const current = entries.get(key);
      const entry =
        current && current.resetAt > now
          ? current
          : { count: 0, resetAt: now + windowMs };
      entry.count += 1;
      entries.set(key, entry);
      return Math.max(0, max - entry.count);
    },
    reset(key: string) {
      entries.delete(key);
    },
    retryAfterSeconds(key: string, now = Date.now()) {
      const entry = entries.get(key);
      return entry ? Math.max(0, Math.ceil((entry.resetAt - now) / 1000)) : 0;
    },
  };
}
