import { expect, test } from "@playwright/test";

// A API real depende do Supabase; aqui ela é simulada no navegador.
const resposta = {
  periodo: {
    ini: "2026-09-25",
    fim: "2026-10-24",
    dias: 30,
    ant_ini: "2026-08-26",
    ant_fim: "2026-09-24",
    situacao: "todas",
  },
  base: {
    primeiro_dia: "2026-01-02",
    ultimo_dia: "2026-10-24",
    ultimo_pedido: "2026-10-24T10:58:00",
  },
  atualizado_em: "2026-10-24T13:50:00.000Z",
  resumo: {
    faturamento: 50000,
    pedidos: 2000,
    ticket_medio: 25,
    itens: 4800,
    dias_com_venda: 30,
  },
  anterior: {
    faturamento: 40000,
    pedidos: 2000,
    ticket_medio: 20,
    itens: 4000,
  },
  situacoes: [
    { situacao: "PENDENTE", pedidos: 1200, faturamento: 28000 },
    { situacao: "FINALIZADO", pedidos: 800, faturamento: 22000 },
  ],
  serie: [
    { data: "2026-10-23", pedidos: 70, faturamento: 1750 },
    { data: "2026-10-24", pedidos: 30, faturamento: 800 },
  ],
  semana_hora: [
    { dia_semana: 5, hora: 7, pedidos: 40, faturamento: 1000, ocorrencias: 4 },
    { dia_semana: 6, hora: 18, pedidos: 80, faturamento: 2000, ocorrencias: 4 },
  ],
  dias_semana: [1, 2, 3, 4, 5, 6, 7].map((dia_semana) => ({
    dia_semana,
    ocorrencias: dia_semana >= 5 ? 5 : 4,
  })),
  produtos: [
    {
      codigo: "0000000000020",
      produto: "PAO",
      unidade: "UN",
      qtd: 9000,
      faturamento: 5850,
      vendas: 900,
    },
    {
      codigo: "0000000000224",
      produto: "BUFFET CAFE DA MANHA",
      unidade: "KG",
      qtd: 120.4,
      faturamento: 6018.8,
      vendas: 400,
    },
  ],
  produtos_distintos: 2,
  pagamentos: [{ forma: "DINHEIRO", pedidos: 2000, faturamento: 50000 }],
  faixas_ticket: [{ faixa: 3, pedidos: 2000, faturamento: 50000 }],
};

test("vendas reais é a tela inicial e mostra o ticket médio", async ({
  page,
}) => {
  const pedidos: string[] = [];
  await page.route("**/api/vendas?**", async (route) => {
    pedidos.push(route.request().url());
    await route.fulfill({ json: resposta });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "As vendas da Superdeli, de verdade.",
    }),
  ).toBeVisible();
  await expect(
    page.locator(".topbar").getByText("Dados reais · BMWeb"),
  ).toBeVisible();
  const ticket = page.locator(".metric", { hasText: "Ticket médio" });
  await expect(ticket.locator("strong")).toHaveText(/R\$\s25,00/);
  await expect(ticket).toContainText("25,0% vs.");
  await expect(page.getByText("Movimento por dia e horário")).toBeVisible();
  await expect(page.locator(".rs-top-strip")).toContainText("Pao");
  await expect(
    page.getByRole("heading", { name: "Quando a loja vende" }),
  ).toBeVisible();

  await page.getByRole("combobox", { name: "Período" }).click();
  await page.getByRole("option", { name: /\(até hoje\)/ }).click();
  await expect(page).toHaveURL(/vp=ano/);
  await expect.poll(() => pedidos.at(-1)).toMatch(/ini=\d{4}-01-01/);

  await page.getByRole("combobox", { name: "Período" }).click();
  await page.getByRole("option", { name: "2025", exact: true }).click();
  await expect(page).toHaveURL(/vp=ano-2025/);
  await expect
    .poll(() => pedidos.at(-1))
    .toMatch(/ini=2025-01-01&fim=2025-12-31/);
});

test("sem banco configurado a tela explica o que falta", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rs-error")).toContainText("SUPABASE_SECRET_KEY");
});
