import { expect, test } from "@playwright/test";

// A IA e o banco são simulados no navegador; o teste cobre a interface.
test("chat responde com Markdown, envia só o histórico e mantém a conversa ao navegar", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests: { messages: { role: string; content: string }[] }[] = [];
  await page.route("**/api/vendas?**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "x", code: "not_configured" },
    }),
  );
  await page.route("**/api/chat", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { configured: true } });
    const body = route.request().postDataJSON();
    requests.push(body);
    expect(Object.keys(body)).toEqual(["messages"]);
    expect(body.messages.at(-1).role).toBe("user");
    return route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "delta",
          text: "Nos últimos 30 dias, o **ticket médio** foi de **R$ 25,05**.",
        }) +
        "\n" +
        JSON.stringify({ type: "done" }) +
        "\n",
    });
  });
  await page.goto("/?view=chat");
  await expect(page.getByText("Groq conectada", { exact: true })).toBeVisible();
  await page
    .getByRole("button", {
      name: "Qual foi o ticket médio deste mês e como ele mudou?",
    })
    .click();
  await expect(
    page.locator('.chat-markdown [data-streamdown="strong"]').first(),
  ).toHaveText("ticket médio");
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await page
    .getByRole("button", { name: "Conversar com a Cifrai", exact: true })
    .click();
  await expect(page.locator(".chat-entry.user")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Sua pergunta para a Cifrai" })
    .fill("E na semana passada?");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Copiar resposta da Cifrai" }),
  ).toHaveCount(2);
  expect(requests).toHaveLength(2);
  expect(requests[1].messages).toHaveLength(3);
  expect(errors).toEqual([]);
});
