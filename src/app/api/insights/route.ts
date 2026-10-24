import { failure, guard, json, parseRange } from "@/lib/api-route";
import { createLimiter } from "@/lib/rate-limit";
import {
  aindaValido,
  dataPack,
  gerarInsights,
  insightsSalvar,
  insightsUltimo,
} from "@/lib/insights-server";
import type { RespostaInsights, Situacao } from "@/lib/vendas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Geração custa IA: no máximo 30/h por instância e 6/h por usuário forçando.
const geracoes = createLimiter({ max: 30, windowMs: 3600_000 });
const forcadas = createLimiter({ max: 6, windowMs: 3600_000 });
// Evita duas gerações simultâneas do mesmo período.
const emAndamento = new Map<string, Promise<unknown>>();

async function responder(
  request: Request,
  ini: string,
  fim: string,
  situacao: Situacao,
  forcar: boolean,
  podeGerar: boolean,
) {
  const { pack, vendas, cestas, cestasPeriodo } = await dataPack(
    ini,
    fim,
    situacao,
  );
  let salvo = forcar ? null : await insightsUltimo(ini, fim, situacao);
  if (!aindaValido(salvo, fim)) {
    if (!process.env.GROQ_API_KEY)
      return json(
        { error: "A IA ainda não foi configurada no servidor.", code: "ia" },
        503,
      );
    if (vendas.resumo.pedidos === 0)
      return json({ error: "Sem vendas nesse período para analisar." }, 422);
    if (geracoes.blocked("global"))
      return json(
        { error: "Muitas análises geradas na última hora. Tente mais tarde." },
        429,
      );
    const key = `${ini}|${fim}|${situacao}`;
    let tarefa = emAndamento.get(key);
    if (!tarefa) {
      geracoes.fail("global");
      tarefa = gerarInsights(pack, { signal: request.signal })
        .then(async (gerado) => {
          await insightsSalvar(
            ini,
            fim,
            situacao,
            gerado.modelo,
            gerado.conteudo,
          );
          return gerado;
        })
        .finally(() => emAndamento.delete(key));
      emAndamento.set(key, tarefa);
    }
    const gerado = (await tarefa) as Awaited<ReturnType<typeof gerarInsights>>;
    salvo = { ...gerado, gerado_em: new Date().toISOString() };
  }
  const body: RespostaInsights = {
    conteudo: salvo!.conteudo,
    modelo: salvo!.modelo,
    gerado_em: salvo!.gerado_em,
    periodo: { ini, fim, situacao },
    base: {
      pedidos: vendas.resumo.pedidos,
      faturamento: vendas.resumo.faturamento,
    },
    cestas,
    cestasPeriodo,
    podeGerar,
  };
  return json(body);
}

export async function GET(request: Request) {
  const check = guard(request, "insights");
  if ("response" in check) return check.response;
  const range = parseRange(new URL(request.url).searchParams);
  if (!range) return json({ error: "Período ou filtro inválido." }, 400);
  try {
    return await responder(
      request,
      range.ini,
      range.fim,
      range.situacao,
      false,
      check.session.role === "admin",
    );
  } catch (error) {
    if (
      (error as Error)?.name?.includes("AI_") ||
      (error as Error)?.name === "ZodError"
    )
      console.error("insights: falha da IA", (error as Error).name);
    return failure(error, "api/insights");
  }
}

/** Gera de novo (só admin). */
export async function POST(request: Request) {
  const check = guard(request, "insights");
  if ("response" in check) return check.response;
  if (check.session.role !== "admin")
    return json(
      { error: "Só o administrador pode gerar uma nova análise." },
      403,
    );
  const origin = request.headers.get("origin");
  try {
    if (
      !origin ||
      new URL(origin).host !==
        (request.headers.get("host") ?? new URL(request.url).host)
    )
      throw new Error("origin");
  } catch {
    return json({ error: "Origem inválida." }, 403);
  }
  const range = parseRange(new URL(request.url).searchParams);
  if (!range) return json({ error: "Período ou filtro inválido." }, 400);
  const userKey = check.session.sub ?? check.session.role;
  if (forcadas.blocked(userKey))
    return json(
      { error: "Você já pediu várias análises nesta hora. Tente mais tarde." },
      429,
    );
  forcadas.fail(userKey);
  try {
    return await responder(
      request,
      range.ini,
      range.fim,
      range.situacao,
      true,
      true,
    );
  } catch (error) {
    return failure(error, "api/insights POST");
  }
}
