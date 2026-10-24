import { expect, test } from "@playwright/test";

const produto = (
  codigo: string,
  nome: string,
  faturamento: number,
  anterior: number,
) => ({
  codigo,
  produto: nome,
  unidade: "UN",
  qtd: faturamento,
  faturamento,
  vendas: 10,
  dias_vendidos: 5,
  ultima_venda: "2026-10-20",
  qtd_anterior: anterior,
  faturamento_anterior: anterior,
});

const painel = {
  periodo: {
    ini: "2026-09-25",
    fim: "2026-10-24",
    dias: 30,
    ant_ini: "2026-08-26",
    ant_fim: "2026-09-24",
    situacao: "todas",
  },
  totais: {
    faturamento: 10000,
    faturamento_anterior: 9000,
    pedidos: 400,
    pedidos_anterior: 380,
  },
  produtos: [
    produto("0000000000020", "PAO", 6000, 5000),
    produto("0000000000224", "BUFFET CAFE DA MANHA", 3000, 3500),
    produto("0000000000090", "QUEIJO MUSSARELA", 1000, 500),
    produto("0000000000777", "MINI PIZZA", 0, 300),
  ],
};

const detalhe = {
  codigo: "0000000000020",
  produto: "PAO",
  unidade: "UN",
  periodo: {
    ini: "2026-09-25",
    fim: "2026-10-24",
    dias: 30,
    situacao: "todas",
  },
  resumo: {
    faturamento: 6000,
    qtd: 9000,
    vendas: 900,
    pedidos_com: 180,
    total_pedidos: 400,
    preco_min: 0.65,
    preco_max: 0.7,
    primeira_venda: "2026-09-25",
    ultima_venda: "2026-10-24",
  },
  ticket: { com: 19.03, sem: 29.88 },
  serie: [{ data: "2026-10-01", qtd: 300, faturamento: 210, vendas: 30 }],
  semana_hora: [{ dia_semana: 1, hora: 7, vendas: 50, qtd: 500 }],
  precos: [
    { preco: 0.65, vendas: 100, de: "2026-09-25", ate: "2026-09-30" },
    { preco: 0.7, vendas: 800, de: "2026-10-01", ate: "2026-10-24" },
  ],
  juntos: [
    {
      codigo: "0000000000225",
      produto: "MANTEIGA",
      pedidos: 40,
      confianca: 0.22,
      lift: 1.9,
    },
  ],
};

test("produtos mostram curva ABC, altas e quedas e abrem a ficha", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/produtos?**", (route) =>
    route.fulfill({ json: painel }),
  );
  await page.route("**/api/produtos/0000000000020?**", (route) =>
    route.fulfill({ json: detalhe }),
  );
  await page.goto("/?view=produtos");
  await expect(
    page.getByRole("heading", { level: 1, name: "Produtos" }),
  ).toBeVisible();
  await expect(
    page.getByText("Poucos produtos sustentam a loja"),
  ).toBeVisible();
  await expect(page.locator(".rs-moves").first()).toContainText("Pao");
  await expect(page.locator(".rs-simple-list").first()).toContainText(
    "Mini Pizza",
  );

  await page.getByRole("button", { name: "Pararam", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Todos", exact: true }).click();

  await page.locator("tbody").getByRole("button", { name: "Pao" }).click();
  const ficha = page.getByRole("dialog");
  await expect(ficha.getByRole("heading", { name: "Pao" })).toBeVisible();
  await expect(ficha).toContainText("45,0%");
  await expect(ficha).toContainText("Ideia de combo");
  await expect(ficha).toContainText("O preço mudou 1 vez");
  await page.keyboard.press("Escape");
  await expect(ficha).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("insights mostram a análise da IA, combos e levam a pergunta ao chat", async ({
  page,
}) => {
  await page.route("**/api/insights?**", (route) =>
    route.fulfill({
      json: {
        conteudo: {
          manchete: "Faturamento sobe com ticket maior",
          resumo: "Resumo do período com números reais.",
          insights: [
            {
              tipo: "oportunidade",
              impacto: "alto",
              titulo: "Combo café com leite + buffet",
              explicacao: "Explicação.",
              evidencia: "78% de quem leva café com leite leva o buffet.",
              acao: "Testar um combo.",
            },
            {
              tipo: "alerta",
              impacto: "medio",
              titulo: "Pedidos pendentes",
              explicacao: "Explicação.",
              evidencia: "54% pendentes.",
              acao: "Confirmar com o caixa.",
            },
          ],
          perguntas: ["Quais produtos cresceram?"],
        },
        modelo: "teste",
        gerado_em: "2026-10-24T15:00:00Z",
        periodo: { ini: "2026-09-25", fim: "2026-10-24", situacao: "todas" },
        base: { pedidos: 400, faturamento: 10000 },
        cestas: [
          {
            a: "CAFE COM LEITE",
            b: "BUFFET CAFE DA MANHA",
            pedidos: 100,
            suporte: 0.1,
            conf_a_b: 0.78,
            conf_b_a: 0.3,
            lift: 4.5,
          },
        ],
        cestasPeriodo: { ini: "2026-09-25", fim: "2026-10-24" },
        podeGerar: true,
      },
    }),
  );
  await page.route("**/api/chat", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: { configured: true } })
      : route.fulfill({
          contentType: "application/x-ndjson",
          body:
            JSON.stringify({ type: "delta", text: "Resposta." }) +
            "\n" +
            JSON.stringify({ type: "done" }) +
            "\n",
        }),
  );
  await page.goto("/?view=insights");
  await expect(
    page.getByRole("heading", { name: "Faturamento sobe com ticket maior" }),
  ).toBeVisible();
  await expect(page.locator(".rs-cestas")).toContainText(
    "78% de quem leva Cafe Com Leite também leva Buffet Cafe Da Manha",
  );
  await expect(
    page.getByRole("button", { name: "Gerar de novo" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Quais produtos cresceram?" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Conversar com a Cifrai" }),
  ).toBeVisible();
  await expect(page.locator(".chat-entry.user")).toContainText(
    "Quais produtos cresceram?",
  );
});
