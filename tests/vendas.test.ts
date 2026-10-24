import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bucketSeries,
  daysBetween,
  highlights,
  hourGrid,
  isIsoDate,
  presetOptions,
  comparisonName,
  presetRange,
  isPreset,
  variation,
  weekdayStats,
  type PainelVendas,
} from "../src/lib/vendas";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { createLimiter } from "../src/lib/rate-limit";

test("datas ISO válidas e intervalos", () => {
  assert.equal(isIsoDate("2026-10-24"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("24/10/2026"), false);
  assert.equal(daysBetween("2026-10-01", "2026-10-24"), 24);
});

test("atalhos de período no fuso da loja", () => {
  const today = "2026-10-24";
  assert.deepEqual(presetRange("hoje", today), { ini: today, fim: today });
  assert.deepEqual(presetRange("ontem", today), {
    ini: "2026-10-23",
    fim: "2026-10-23",
  });
  assert.deepEqual(presetRange("30d", today), {
    ini: "2026-09-25",
    fim: today,
  });
  assert.deepEqual(presetRange("mes", today), {
    ini: "2026-10-01",
    fim: today,
  });
  assert.deepEqual(presetRange("mes-anterior", "2026-03-10"), {
    ini: "2026-02-01",
    fim: "2026-02-28",
  });
  assert.deepEqual(presetRange("ano", today), {
    ini: "2026-01-01",
    fim: today,
  });
});

test("variação sem base devolve null", () => {
  assert.equal(variation(110, 100), 10);
  assert.equal(variation(5, 0), null);
});

test("série diária preenche dias sem venda e calcula ticket", () => {
  const { granularidade, pontos } = bucketSeries(
    [
      { data: "2026-10-01", pedidos: 10, faturamento: 250 },
      { data: "2026-10-03", pedidos: 4, faturamento: 100 },
    ],
    "2026-10-01",
    "2026-10-05",
    "2026-10-03",
  );
  assert.equal(granularidade, "dia");
  assert.deepEqual(
    pontos.map((p) => [p.start, p.pedidos, p.faturamento, p.ticket]),
    [
      ["2026-10-01", 10, 250, 25],
      ["2026-10-02", 0, 0, 0],
      ["2026-10-03", 4, 100, 25],
    ],
  );
});

test("períodos longos agrupam por semana e por mês", () => {
  const serie = [{ data: "2026-01-05", pedidos: 2, faturamento: 40 }];
  assert.equal(
    bucketSeries(serie, "2026-01-01", "2026-03-31", null).granularidade,
    "semana",
  );
  const mensal = bucketSeries(serie, "2026-01-01", "2026-10-24", null);
  assert.equal(mensal.granularidade, "mes");
  assert.equal(mensal.pontos.length, 10);
  assert.equal(mensal.pontos[0].faturamento, 40);
});

const amostra: PainelVendas = {
  periodo: {
    ini: "2026-10-19",
    fim: "2026-10-25",
    dias: 7,
    ant_ini: "2026-10-12",
    ant_fim: "2026-10-18",
    situacao: "todas",
  },
  base: {
    primeiro_dia: "2026-01-02",
    ultimo_dia: "2026-10-25",
    ultimo_pedido: "2026-10-25T20:00:00",
  },
  atualizado_em: "2026-10-25T20:10:00-03:00",
  resumo: {
    faturamento: 300,
    pedidos: 12,
    ticket_medio: 25,
    itens: 30,
    dias_com_venda: 2,
  },
  anterior: { faturamento: 200, pedidos: 10, ticket_medio: 20, itens: 20 },
  situacoes: [],
  serie: [],
  semana_hora: [
    { dia_semana: 1, hora: 7, pedidos: 8, faturamento: 200, ocorrencias: 1 },
    { dia_semana: 6, hora: 9, pedidos: 4, faturamento: 100, ocorrencias: 1 },
  ],
  dias_semana: [1, 2, 3, 4, 5, 6, 7].map((dia_semana) => ({
    dia_semana,
    ocorrencias: 1,
  })),
  produtos: [
    {
      codigo: "1",
      produto: "PAO",
      unidade: "UN",
      qtd: 100,
      faturamento: 65,
      vendas: 9,
    },
    {
      codigo: "2",
      produto: "BOLO",
      unidade: "KG",
      qtd: 2.5,
      faturamento: 80,
      vendas: 3,
    },
    {
      codigo: "3",
      produto: "CAFE",
      unidade: "UN",
      qtd: 20,
      faturamento: 70,
      vendas: 20,
    },
  ],
  produtos_distintos: 3,
  pagamentos: [],
  faixas_ticket: [
    { faixa: 1, pedidos: 3, faturamento: 20 },
    { faixa: 3, pedidos: 9, faturamento: 280 },
  ],
};

test("médias por dia da semana usam as ocorrências do período", () => {
  const stats = weekdayStats(amostra);
  assert.equal(stats[0].mediaFaturamento, 200);
  assert.equal(stats[0].ticket, 25);
  assert.equal(stats[1].pedidos, 0);
  const grid = hourGrid(amostra);
  assert.deepEqual(grid.horas, [7, 8, 9]);
  assert.equal(grid.linhas[0].celulas[0].pedidos, 8);
});

test("destaques citam ticket, pico e concentração", () => {
  const texts = highlights(amostra, true);
  assert.match(texts[0], /Ticket médio de R\$\s25,00, 25,0% acima/);
  assert.match(texts[1], /segunda-feira, das 7h às 8h/);
  assert.match(texts[2], /Os 3 produtos/);
  assert.equal(
    highlights({ ...amostra, resumo: { ...amostra.resumo, pedidos: 0 } }, true)
      .length,
    0,
  );
});

test("hash scrypt confere a senha certa e rejeita a errada", async () => {
  const hash = await hashPassword("senha-de-teste-123");
  assert.match(hash, /^scrypt\$131072\$8\$1\$/);
  assert.equal(await verifyPassword("senha-de-teste-123", hash), true);
  assert.equal(await verifyPassword("senha-de-teste-124", hash), false);
  assert.equal(await verifyPassword("x", "texto-qualquer"), false);
});

test("limite de tentativas bloqueia e libera após a janela", () => {
  const limiter = createLimiter({ max: 2, windowMs: 1000 });
  assert.equal(limiter.blocked("ip", 0), false);
  limiter.fail("ip", 0);
  limiter.fail("ip", 10);
  assert.equal(limiter.blocked("ip", 20), true);
  assert.equal(limiter.blocked("ip", 1001), false);
  limiter.fail("outro", 0);
  limiter.reset("outro");
  assert.equal(limiter.blocked("outro", 1), false);
});

test("filtro tem cada ano desde 2025; ano fechado vai de 1/1 a 31/12", () => {
  const today = "2026-10-24";
  const anos = presetOptions(today).filter((o) => o.value.startsWith("ano"));
  assert.deepEqual(anos, [
    { value: "ano", label: "2026 (até hoje)" },
    { value: "ano-2025", label: "2025" },
  ]);
  assert.deepEqual(presetRange("ano-2025", today), {
    ini: "2025-01-01",
    fim: "2025-12-31",
  });
  assert.ok(isPreset("ano-2025"));
  assert.ok(!isPreset("ano-2024"));
  assert.ok(!isPreset("ano-20x5"));
});

test("nome do período de comparação acompanha o que o banco escolheu", () => {
  const c = (ini: string, fim: string, ant_ini: string, ant_fim: string) =>
    comparisonName({ ini, fim, ant_ini, ant_fim });
  assert.equal(
    c("2026-10-01", "2026-10-24", "2026-09-01", "2026-09-24"),
    "os mesmos dias de setembro",
  );
  assert.equal(
    c("2026-01-01", "2026-10-24", "2025-01-01", "2025-10-24"),
    "o mesmo período de 2025",
  );
  assert.equal(
    c("2026-01-01", "2026-01-24", "2025-12-01", "2025-12-24"),
    "os mesmos dias de dezembro",
  );
  assert.equal(
    c("2026-09-25", "2026-10-24", "2026-08-26", "2026-09-24"),
    "os 30 dias anteriores",
  );
  assert.equal(
    c("2026-10-24", "2026-10-24", "2026-10-23", "2026-10-23"),
    "o dia anterior",
  );
});
