import { expect, test } from "@playwright/test";

test("daily bars retain visible dimensions for every range on desktop and mobile", async ({
  page,
}) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    for (const days of [7, 14, 30]) {
      await page
        .getByRole("button", { name: `${days} dias`, exact: true })
        .click();
      for (const metric of ["Vendas", "Perdas"]) {
        await page.getByRole("button", { name: metric, exact: true }).click();
        await expect(page.locator(".bar")).toHaveCount(days);
        const bounds = await page.locator(".bar").evaluateAll((bars) =>
          bars.map((bar) => {
            const rect = bar.getBoundingClientRect();
            const plot = bar.closest(".plot")!.getBoundingClientRect();
            return {
              width: rect.width,
              height: rect.height,
              insidePlot: rect.left >= plot.left && rect.right <= plot.right,
            };
          }),
        );
        for (const bar of bounds) {
          expect(bar.width).toBeGreaterThanOrEqual(2);
          expect(bar.height).toBeGreaterThan(2);
          expect(bar.insidePlot).toBe(true);
        }
      }
    }
    await page
      .locator(".chart-panel")
      .screenshot({ path: `test-results/rhythm-30-days-${width}.png` });
  }
});

test("analytics show rankings, weekday averages and production outcomes for the selected range", async ({
  page,
}) => {
  await page.goto("/");
  for (const title of [
    "Os favoritos do balcão",
    "Cada dia tem seu ritmo",
    "O destino de cada fornada",
    "Onde o desperdício pesa",
  ])
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const ranking = page.locator(".ranking-list");
  await expect(ranking.locator("li").first()).toContainText("Pão francês");
  await page.getByRole("button", { name: "Receita", exact: true }).click();
  await expect(ranking.locator("li").first()).toContainText(
    "Coxinha de frango",
  );
  await page.getByRole("button", { name: "Retorno", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Retorno", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const production = await page.locator(".donut-center strong").innerText();
  await page.getByRole("button", { name: "30 dias", exact: true }).click();
  expect(await page.locator(".donut-center strong").innerText()).not.toEqual(
    production,
  );
  await expect(page.locator(".weekday-column")).toHaveCount(7);
  await expect(page.locator(".waste-list li")).toHaveCount(5);
});

test("overview renders without browser errors and filters update URL and metrics", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sua Superdeli, por inteiro." }),
  ).toBeVisible();
  const initial = await page.locator(".metric").first().innerText();
  await page.getByRole("button", { name: "14 dias", exact: true }).click();
  await expect(page).toHaveURL(/days=14/);
  expect(await page.locator(".metric").first().innerText()).not.toEqual(
    initial,
  );
  await page.getByRole("button", { name: "Perdas", exact: true }).click();
  await expect(
    page.getByText("Valor descartado por dia, ao custo"),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  await page
    .locator(".analytics-section")
    .screenshot({ path: "test-results/analytics-desktop.png" });
  expect(errors).toEqual([]);
});

test("search supports no-results and clearing, and navigation restores focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Produtos", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Produtos", exact: true }),
  ).toBeFocused();
  await page.getByRole("textbox", { name: "Buscar produtos" }).fill("zzzz");
  await expect(page.getByText("Nenhum produto encontrado")).toBeVisible();
  await page.getByRole("button", { name: "Limpar busca" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(14);
  await expect(
    page.getByRole("textbox", { name: "Buscar produtos" }),
  ).toBeFocused();
  await page.getByRole("textbox", { name: "Buscar produtos" }).fill("pao");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Buscar produtos" }),
  ).toHaveValue("pao");
});

test("daily record validates conservation, persists and updates totals", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Registrar dia", exact: true })
    .click();
  await expect(page.getByLabel("Produto", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(
    page.getByText("Preencha produção, vendas e descartes.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Produzido", { exact: true }).fill("100");
  await page.getByLabel("Vendido", { exact: true }).fill("101");
  await page.getByLabel("Descartado", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(
    page.getByText("Vendas e descartes não podem superar", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Vendido", { exact: true }).fill("80");
  await page.getByLabel("Descartado", { exact: true }).fill("5");
  await page
    .getByLabel("Destino da sobra não descartada")
    .selectOption("donation");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(
    page.getByText("Registro salvo neste navegador.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Carregar registro" }).click();
  await expect(page.getByLabel("Produzido", { exact: true })).toHaveValue(
    "100",
  );
  await expect(page.getByLabel("Vendido", { exact: true })).toHaveValue("80");
  await expect(page.getByLabel("Destino da sobra não descartada")).toHaveValue(
    "donation",
  );
});

test("recommendation approval persists without modifying production", async ({
  page,
}) => {
  await page.goto("/?view=insights&days=7");
  await page
    .getByRole("button", { name: "Aprovar para planejar" })
    .first()
    .click();
  await expect(
    page.getByText("Sugestão aprovada para o planejamento.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Aprovada", exact: true }),
  ).toBeDisabled();
});

test("CSV export downloads the selected range", async ({ page }) => {
  await page.goto("/?days=14");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("superdeli-demo-14-days.csv");
});

test("unavailable storage preserves the entered values and displays recovery", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "superdeli-demo-v1")
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await page.goto("/?view=production");
  await page.getByLabel("Produzido", { exact: true }).fill("100");
  await page.getByLabel("Vendido", { exact: true }).fill("80");
  await page.getByLabel("Descartado", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(
    page.getByText("Não foi possível salvar neste navegador.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Produzido", { exact: true })).toHaveValue(
    "100",
  );
});

test("mobile, keyboard controls and reduced motion remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Ir para o conteúdo" }),
  ).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Ir para o conteúdo" }),
  ).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Visão geral", exact: true }).focus();
  await expect(
    page.getByRole("link", { name: "Ir para o conteúdo" }),
  ).toHaveCSS("opacity", "0");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  await page
    .locator(".analytics-section")
    .screenshot({ path: "test-results/analytics-mobile.png" });
  await page
    .getByRole("button", { name: "Produção e vendas", exact: true })
    .click();
  const select = page.getByLabel("Produto", { exact: true });
  await select.focus();
  await select.press("ArrowDown");
  await select.press("Enter");
  await expect(select).toHaveValue("cheese-bread");
  await page.getByLabel("Produzido", { exact: true }).focus();
  await expect(page.getByLabel("Produzido", { exact: true })).toBeFocused();
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollbarColor,
    ),
  ).not.toBe("auto");
});

test("minimarket inventory records receipts and keeps unsold goods out of waste", async ({
  page,
}) => {
  await page.goto("/?view=inventory");
  await expect(page.locator(".inventory-panel tbody tr")).toHaveCount(9);
  await expect(
    page
      .locator(".inventory-panel tbody tr")
      .filter({ hasText: "Morango congelado" }),
  ).toContainText("25 dias sem venda");
  await page.screenshot({
    path: "test-results/inventory-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({
    path: "test-results/inventory-mobile.png",
    fullPage: true,
  });
  await page.goto("/?view=production");
  await page.locator("#record-product").selectOption("ground-coffee");
  await page.locator("#record-opening-stock").fill("10");
  await page.locator("#record-produced").fill("5");
  await page.locator("#record-sold").fill("3");
  await page.locator("#record-discarded").fill("0");
  await page
    .getByRole("button", { name: "Salvar registro", exact: true })
    .click();
  await expect(
    page.getByText("Registro salvo neste navegador.", { exact: true }),
  ).toBeVisible();
  await page.goto("/?view=inventory");
  const coffee = page
    .locator(".inventory-panel tbody tr")
    .filter({ hasText: "500 g" });
  await expect(coffee.locator("td").first()).toContainText("12");
  await page.reload();
  await expect(coffee.locator("td").first()).toContainText("12");
});
