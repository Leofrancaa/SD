import { test as setup } from "@playwright/test";

// Entra como admin uma vez e reaproveita a sessão nos demais testes.
setup("login admin", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill("admin");
  await page.getByLabel("Senha").fill("admin-e2e");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("/");
  await page.context().storageState({ path: "test-results/admin.json" });
});
