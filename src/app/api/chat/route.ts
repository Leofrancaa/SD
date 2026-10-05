import { createGroq } from "@ai-sdk/groq";
import { isStepCount, ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import {
  assistantInstructions,
  bakeryReport,
  chatRequestSchema,
  friendlyChatError,
  selectedChatContext,
  validatedRecords,
} from "@/lib/chat-context";

export const runtime = "nodejs";
export const maxDuration = 60;
const clients = new Map<string, { count: number; resetAt: number }>();

export function GET() {
  return Response.json(
    { configured: Boolean(process.env.GROQ_API_KEY) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  try {
    if (
      !origin ||
      new URL(origin).host !==
        (request.headers.get("host") ?? new URL(request.url).host)
    )
      throw new Error("Origin mismatch");
  } catch {
    return Response.json(
      { error: "Abra o chat dentro do sistema Superdeli." },
      { status: 403 },
    );
  }
  if (!process.env.GROQ_API_KEY)
    return Response.json(
      {
        error:
          "A IA ainda não foi configurada. O responsável precisa adicionar a chave da Groq no servidor.",
      },
      { status: 503 },
    );
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json(
      { error: "Formato de mensagem inválido." },
      { status: 415 },
    );
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 60000)
    return Response.json(
      { error: "A conversa está muito longa. Envie uma pergunta mais curta." },
      { status: 413 },
    );
  let payload;
  let records;
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).length > 60000)
      return Response.json(
        {
          error: "A conversa está muito longa. Envie uma pergunta mais curta.",
        },
        { status: 413 },
      );
    payload = chatRequestSchema.parse(JSON.parse(body));
    records = validatedRecords(payload.records);
  } catch {
    return Response.json(
      {
        error:
          "A mensagem ou os registros são inválidos. Confira os dados e tente novamente.",
      },
      { status: 400 },
    );
  }
  const now = Date.now();
  for (const [id, entry] of clients)
    if (entry.resetAt <= now) clients.delete(id);
  const address =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  const entry = clients.get(address) ?? { count: 0, resetAt: now + 60000 };
  if (entry.count >= 8 || clients.size >= 5000)
    return Response.json(
      {
        error:
          "Você enviou muitas perguntas em sequência. Aguarde um minuto e tente novamente.",
      },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  entry.count++;
  clients.set(address, entry);
  const controller = new AbortController();
  const signal = AbortSignal.any([
    request.signal,
    controller.signal,
    AbortSignal.timeout(45000),
  ]);
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
  const primaryModel = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
  const createAgent = (modelId: string) =>
    new ToolLoopAgent({
      model: groq(modelId),
      instructions: `${assistantInstructions}\nAUTHORITATIVE REPORT (server calculated):\n${JSON.stringify(selectedChatContext(records, payload.days))}`,
      stopWhen: isStepCount(3),
      maxOutputTokens: 1800,
      temperature: 0.2,
      maxRetries: 0,
      prepareCall: (settings) => ({ ...settings, onError: () => {} }),
      providerOptions: { groq: { reasoningEffort: "low" } },
      tools: {
        getBakeryReport: tool({
          description:
            "Return verified synthetic bakery calculations for a date range or specific product. Date range must fall between 2026-09-06 and 2026-10-05. Product IDs: french-bread, cheese-bread, coxinha, corn-cake, cheese-pastry. Use to answer explicit dates or periods outside the currently selected range.",
          inputSchema: z.object({
            startDate: z.string(),
            endDate: z.string(),
            productId: z.string().optional(),
          }),
          execute: async ({ startDate, endDate, productId }) =>
            bakeryReport(records, startDate, endDate, productId),
        }),
      },
    });
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(output) {
      const send = (event: unknown) =>
        output.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let text = "";
      try {
        const consumeModel = async (modelId: string) => {
          const result = await createAgent(modelId).stream({
            messages: payload.messages,
            abortSignal: signal,
          });
          for await (const part of result.fullStream) {
            if (part.type === "text-delta") {
              if (!text)
                send({
                  type: "delta",
                  text: "**Dados simulados da Superdeli**\n\n",
                });
              text += part.text;
              send({ type: "delta", text: part.text });
            } else if (part.type === "error") throw part.error;
            else if (part.type === "finish" && part.finishReason === "length") {
              const error = new Error("Output limit reached");
              error.name = "OutputLimitError";
              throw error;
            } else if (part.type === "abort")
              throw new DOMException("Request aborted", "AbortError");
          }
        };
        try {
          await consumeModel(primaryModel);
        } catch (error) {
          const status =
            error && typeof error === "object" && "statusCode" in error
              ? Number(error.statusCode)
              : 0;
          if (
            !text &&
            primaryModel !== "openai/gpt-oss-20b" &&
            (status === 429 || status === 503) &&
            !signal.aborted
          )
            await consumeModel("openai/gpt-oss-20b");
          else throw error;
        }
        if (!text.trim()) throw new Error("Empty assistant response");
        send({ type: "done" });
      } catch (error) {
        if (!request.signal.aborted && !controller.signal.aborted)
          send({ type: "error", message: friendlyChatError(error) });
      } finally {
        try {
          output.close();
        } catch {
          /* The client may have cancelled the stream. */
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
