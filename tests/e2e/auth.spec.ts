import { expect, test } from "@playwright/test";

// Sem sessão salva: testa o fluxo de login do zero.
test.use({ storageState: { cookies: [], origins: [] } });

async function login(
  page: import("@playwright/test").Page,
  username: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill(username);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("sem login redireciona para /login e rejeita senha errada", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await login(page, "admin", "errada");
  await expect(page.locator(".login-error")).toHaveText(
    "Usuário ou senha incorretos.",
  );
});

test("admin vê todo o menu", async ({ page }) => {
  await login(page, "admin", "admin-e2e");
  const nav = page.getByRole("navigation", { name: "Menu principal" });
  await expect(nav.getByRole("button")).toHaveCount(2);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "As vendas da Superdeli, de verdade.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Administrador")).toBeVisible();
});

test("gerência vê só as vendas e não acessa o chat", async ({ page }) => {
  await login(page, "gerencia", "gerencia-e2e");
  const nav = page.getByRole("navigation", { name: "Menu principal" });
  await expect(nav.getByRole("button")).toHaveCount(1);
  await expect(nav).toContainText("Vendas");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "As vendas da Superdeli, de verdade.",
    }),
  ).toBeVisible();

  // URL direta para o chat cai nas vendas.
  await page.goto("/?view=chat");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "As vendas da Superdeli, de verdade.",
    }),
  ).toBeVisible();

  const status = await page.evaluate(async () => {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return response.status;
  });
  expect(status).toBe(403);

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});
