import { expect, test } from "@playwright/test";

test("chat uses the selected data, renders Markdown and retains history during navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests: unknown[] = [];
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { configured: true } });
    const body = route.request().postDataJSON();
    requests.push(body);
    expect(body.records).toHaveLength(420);
    expect(body.messages.at(-1).role).toBe("user");
    return route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "delta",
          text: "Nos dados simulados, **Pão francês** é o mais vendido, com **3.597 unidades**.\n\nConfira as faltas antes de aumentar a produção.",
        }) +
        "\n" +
        JSON.stringify({ type: "done" }) +
        "\n",
    });
  });
  await page.goto("/?view=chat&days=7");
  await expect(page.getByText("Groq conectada", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/chat-desktop-empty.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Qual produto vende mais?", exact: true })
    .click();
  await expect(
    page.locator('.chat-markdown [data-streamdown="strong"]').first(),
  ).toHaveText("Pão francês");
  await expect(
    page.getByRole("button", { name: "Copiar resposta da eia" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await page
    .getByRole("button", { name: "Conversar com a eia", exact: true })
    .click();
  await expect(page.locator(".chat-entry.user")).toHaveCount(1);
  await page.getByRole("button", { name: "30 dias", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Sua pergunta para a eia" })
    .fill("E nesse período?");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Copiar resposta da eia" }),
  ).toHaveCount(2);
  expect(requests).toHaveLength(2);
  expect((requests[1] as { days: number }).days).toBe(30);
  await page.screenshot({
    path: "test-results/chat-desktop-answer.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("chat preserves failed questions, retries without duplicates and handles partial answers", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/chat", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { configured: true } });
    calls++;
    if (calls === 1)
      return route.fulfill({
        status: 429,
        json: {
          error:
            "A IA atingiu o limite de uso da Groq. Aguarde um minuto e tente novamente.",
        },
      });
    return route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({ type: "delta", text: "Uma resposta parcial." }) +
        "\n" +
        JSON.stringify({
          type: "error",
          message: "A resposta foi interrompida. Tente novamente.",
        }) +
        "\n",
    });
  });
  await page.goto("/?view=chat");
  const input = page.getByRole("textbox", { name: "Sua pergunta para a eia" });
  await expect(page.getByText("Groq conectada", { exact: true })).toBeVisible();
  await input.fill("Quanto foi descartado?");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    page.getByText("A IA atingiu o limite de uso", { exact: false }),
  ).toBeVisible();
  await expect(input).toHaveValue("Quanto foi descartado?");
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(
    page.getByText("Resposta parcial · não concluída", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".chat-entry.user")).toHaveCount(1);
});

test("mobile chat supports composition, multiline drafts and interruption", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  let calls = 0;
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { configured: true } });
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      await route.fulfill({
        contentType: "application/x-ndjson",
        body: '{"type":"delta","text":"Resposta"}\n{"type":"done"}\n',
      });
    } catch {
      /* The request was deliberately cancelled. */
    }
  });
  await page.goto("/?view=chat");
  await expect(page.getByText("Groq conectada", { exact: true })).toBeVisible();
  const input = page.getByRole("textbox", { name: "Sua pergunta para a eia" });
  await input.fill("Quero entender as sobras");
  await input.dispatchEvent("keydown", { key: "Enter", isComposing: true });
  expect(calls).toBe(0);
  await input.press("Shift+Enter");
  await expect(input).toHaveValue("Quero entender as sobras\n");
  await page.screenshot({
    path: "test-results/chat-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await input.press("Enter");
  await page.getByRole("button", { name: "Interromper", exact: true }).click();
  await expect(
    page.getByText("Resposta interrompida. Você pode tentar novamente.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("unconfigured chat explains recovery and prevents sending", async ({
  page,
}) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({ json: { configured: false } }),
  );
  await page.goto("/?view=chat");
  await page
    .getByRole("textbox", { name: "Sua pergunta para a eia" })
    .fill("Qual produto vende mais?");
  await expect(
    page.getByText("A IA não está disponível agora.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviar", exact: true }),
  ).toBeDisabled();
});
