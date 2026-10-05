import { expect, test } from "@playwright/test";

test("owner priorities route directly to purchases and keep simulation visible", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Por onde começar" }),
  ).toBeVisible();
  await expect(page.locator(".owner-priorities")).toContainText("Leite");
  await expect(page.locator(".owner-priorities")).toContainText(
    "Morango congelado",
  );
  await page
    .getByRole("button", { name: "Planejar compra", exact: true })
    .click();
  await expect(page).toHaveURL(/view=purchases/);
  await expect(
    page.getByRole("heading", { name: "Lista de compras", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".purchase-planner tbody tr")).toHaveCount(9);
  const milk = page
    .locator(".purchase-planner tbody tr")
    .filter({ hasText: "Leite" });
  await expect(milk.getByRole("checkbox")).toBeChecked();
  await expect(page.locator(".purchase-total")).toContainText(
    "1 item selecionado",
  );
});

test("purchase draft validates quantity, permits selection and exports reviewed costs", async ({
  page,
}) => {
  await page.goto("/?view=purchases&days=7");
  const quantity = page.getByRole("spinbutton", { name: /Comprar Leite/ });
  await quantity.fill("-1");
  await expect(page.locator("#purchase-error")).toBeVisible();
  const exportButton = page.getByRole("button", {
    name: "Exportar lista de compras",
  });
  await expect(exportButton).toBeDisabled();
  await quantity.fill("12");
  await expect(page.locator(".purchase-total strong")).toContainText("56,40");
  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "superdeli-purchase-plan-2026-10-05.csv",
  );
  await expect(
    page.getByText("Nenhum pedido foi enviado.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: /Incluir Leite/ }).uncheck();
  await expect(exportButton).toBeDisabled();
  await expect(
    page.getByText("Nenhum item selecionado.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Planejar para", { exact: true }).selectOption("14");
  await expect(quantity).not.toHaveValue("12");
  await expect(
    page.getByRole("checkbox", { name: /Incluir Leite/ }),
  ).toBeChecked();
});

test("report distinguishes return from net profit and prints only the selected report", async ({
  page,
}) => {
  await page.goto("/?view=report&days=7");
  await expect(
    page.getByRole("heading", { name: "Resumo para o dono" }),
  ).toBeVisible();
  await expect(page.locator(".report-disclosure")).toContainText(
    "dados simulados",
  );
  await expect(page.locator(".report-financial")).toContainText(
    "não é lucro líquido",
  );
  await expect(page.locator(".report-next-steps")).toContainText(
    "Morango congelado",
  );
  await page.getByRole("button", { name: "30 dias", exact: true }).click();
  await expect(page.locator(".report-comparison")).toContainText(
    "Comparação indisponível",
  );
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".page-heading")).toBeHidden();
  await expect(page.locator(".owner-report")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Imprimir / salvar PDF" }),
  ).toBeHidden();
  await page.pdf({ path: "test-results/owner-report.pdf", format: "A4" });
});

test("owner workflows fit a phone and respect keyboard controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/owner-home-mobile.png",
    fullPage: true,
  });
  await page.goto("/?view=purchases");
  await page.getByLabel("Planejar para", { exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.getByRole("spinbutton", { name: /Comprar Leite/ }).focus();
  await expect(
    page.getByRole("spinbutton", { name: /Comprar Leite/ }),
  ).toBeInViewport();
  await page.screenshot({
    path: "test-results/purchases-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/?view=report");
  await page.screenshot({
    path: "test-results/owner-report-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
