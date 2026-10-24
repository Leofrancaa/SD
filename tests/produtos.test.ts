import assert from "node:assert/strict";
import { test } from "node:test";
import { abc, movimentos, type ProdutoLinha } from "../src/lib/vendas";
import {
  aindaValido,
  cestasRange,
  gerarInsights,
  insightsSchema,
} from "../src/lib/insights-server";

const p = (
  codigo: string,
  faturamento: number,
  faturamento_anterior: number,
): ProdutoLinha => ({
  codigo,
  produto: `PRODUTO ${codigo}`,
  unidade: "UN",
  qtd: faturamento,
  faturamento,
  vendas: 1,
  dias_vendidos: 1,
  ultima_venda: null,
  qtd_anterior: faturamento_anterior,
  faturamento_anterior,
});

test("curva ABC: A até 80% do faturamento, B até 95%, C o resto", () => {
  const curva = abc([
    p("1", 700, 0),
    p("2", 150, 0),
    p("3", 100, 0),
    p("4", 50, 0),
    p("5", 0, 10),
  ]);
  assert.equal(curva.vendidos, 4);
  assert.equal(curva.classes.get("1"), "A");
  assert.equal(curva.classes.get("2"), "A"); // começa em 70%, ainda abaixo de 80%
  assert.equal(curva.classes.get("3"), "B");
  assert.equal(curva.classes.get("4"), "C");
  assert.equal(curva.classes.has("5"), false);
  assert.equal(curva.resumo[0].produtos, 2);
});

test("altas, quedas, parados e novidades ignoram itens pequenos", () => {
  const m = movimentos([
    p("alta", 900, 500),
    p("queda", 200, 800),
    p("ruido", 120, 20),
    p("parou", 0, 300),
    p("novo", 250, 0),
  ]);
  assert.deepEqual(
    m.alta.map((x) => x.codigo),
    ["alta"],
  );
  assert.equal(m.alta[0].diferenca, 400);
  assert.equal(m.alta[0].variacao, 80);
  assert.deepEqual(
    m.queda.map((x) => x.codigo),
    ["queda"],
  );
  assert.deepEqual(
    m.parados.map((x) => x.codigo),
    ["parou"],
  );
  assert.deepEqual(
    m.novos.map((x) => x.codigo),
    ["novo"],
  );
});

test("cestas usam no máximo os últimos 90 dias em períodos longos", () => {
  assert.deepEqual(cestasRange("2026-10-01", "2026-10-24"), {
    ini: "2026-10-01",
    fim: "2026-10-24",
  });
  assert.deepEqual(cestasRange("2026-01-01", "2026-10-24"), {
    ini: "2026-07-27",
    fim: "2026-10-24",
  });
});

test("análise salva vale sempre para período fechado e 3 h quando inclui hoje", () => {
  const salvo = {
    conteudo: {} as never,
    modelo: "x",
    gerado_em: "2026-10-24T12:00:00Z",
  };
  assert.equal(aindaValido(null, "2020-01-01"), false);
  assert.equal(aindaValido(salvo, "2020-01-01"), true);
  assert.equal(
    aindaValido(salvo, "9999-12-31", Date.parse("2026-10-24T14:00:00Z")),
    true,
  );
  assert.equal(
    aindaValido(salvo, "9999-12-31", Date.parse("2026-10-24T16:00:00Z")),
    false,
  );
});

const exemplo = {
  manchete: "Faturamento sobe 1,1% com ticket maior",
  resumo:
    "O período fechou com R$ 487.051,46 em 19.441 pedidos e ticket médio de R$ 25,05, acima do anterior.",
  insights: Array.from({ length: 4 }, (_, i) => ({
    tipo: "oportunidade",
    impacto: "alto",
    titulo: `Insight número ${i + 1}`,
    explicacao: "Explicação com pelo menos vinte caracteres.",
    evidencia: "78% de quem leva A leva B",
    acao: "Testar um combo por duas semanas.",
  })),
  perguntas: ["Quais produtos cresceram?", "Qual o melhor horário?"],
};

test("schema rejeita respostas fora do formato", () => {
  assert.equal(insightsSchema.safeParse(exemplo).success, true);
  assert.equal(
    insightsSchema.safeParse({
      ...exemplo,
      insights: exemplo.insights.slice(0, 2),
    }).success,
    false,
  );
  assert.equal(
    insightsSchema.safeParse({
      ...exemplo,
      insights: [
        { ...exemplo.insights[0], tipo: "outro" },
        ...exemplo.insights,
      ],
    }).success,
    false,
  );
});

test("gera insights com a Groq e cai para o modelo menor se o primeiro falhar", async () => {
  const previous = {
    key: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL,
  };
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const models: string[] = [];
  try {
    process.env.GROQ_API_KEY = "test-key";
    delete process.env.GROQ_MODEL;
    console.error = () => {};
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(String(options?.body));
      models.push(body.model);
      if (body.model === "openai/gpt-oss-120b")
        return new Response(JSON.stringify({ error: { message: "x" } }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      return Response.json({
        id: "t",
        object: "chat.completion",
        created: 1,
        model: body.model,
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: { role: "assistant", content: JSON.stringify(exemplo) },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    };
    const result = await gerarInsights({ teste: true });
    assert.deepEqual(models, ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
    assert.equal(result.modelo, "openai/gpt-oss-20b");
    assert.equal(result.conteudo.insights.length, 4);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    if (previous.key === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previous.key;
    if (previous.model !== undefined) process.env.GROQ_MODEL = previous.model;
  }
});
