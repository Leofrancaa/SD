"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Copy,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Wheat,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "./ai-elements/conversation";
import { MessageResponse } from "./ai-elements/message";
import { todayInStore } from "@/lib/vendas";

type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  state: "complete" | "streaming" | "failed" | "cancelled";
  period: string;
};
type HistoryMessage = { role: "user" | "assistant"; content: string };
const questions = [
  "Como foram as vendas de hoje até agora?",
  "Qual foi o ticket médio deste mês e como ele mudou?",
  "Quais dias e horários vendem mais?",
  "Quais produtos mais faturam nos últimos 30 dias?",
  "Compare esta semana com a semana passada.",
  "Que combos poderiam aumentar o ticket médio?",
];

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

export function BakeryChat({
  active,
  prefill,
}: {
  active: boolean;
  prefill?: { text: string; nonce: number } | null;
}) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<
    "checking" | "ready" | "unavailable"
  >("checking");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastRequest = useRef<{
    question: string;
    history: HistoryMessage[];
    userId: string;
  } | null>(null);

  useEffect(() => {
    if (!active) {
      abortRef.current?.abort();
      return;
    }
    const controller = new AbortController();
    fetch("/api/chat", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((result) =>
        setConnection(result.configured ? "ready" : "unavailable"),
      )
      .catch(() => {
        if (!controller.signal.aborted) setConnection("unavailable");
      });
    return () => controller.abort();
  }, [active]);
  useEffect(() => () => abortRef.current?.abort(), []);
  // Pergunta vinda de outra tela ("Aprofundar com a Cifrai").
  const handledPrefill = useRef(0);
  useEffect(() => {
    if (!prefill || !active || connection !== "ready") return;
    if (handledPrefill.current === prefill.nonce) return;
    handledPrefill.current = prefill.nonce;
    const run = () => {
      void send(prefill.text);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill, active, connection]);

  async function send(question: string, retry = false) {
    if (abortRef.current || !question.trim() || connection !== "ready") return;
    const previous = retry ? lastRequest.current : null;
    const history =
      previous?.history ??
      entries
        .filter((entry) => entry.state === "complete" && entry.content.trim())
        .slice(-10)
        .map(({ role, content }) => ({
          role,
          content: content.slice(0, 3500),
        }));
    while (
      history.reduce((sum, message) => sum + message.content.length, 0) > 12000
    )
      history.shift();
    const userId = previous?.userId ?? crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    const controller = new AbortController();
    abortRef.current = controller;
    lastRequest.current = { question: question.trim(), history, userId };
    setBusy(true);
    setError("");
    setAnnouncement("A Cifrai está analisando os dados.");
    setInput("");
    setEntries((current) => [
      ...(previous
        ? current.slice(
            0,
            current.findIndex((entry) => entry.id === userId),
          )
        : current),
      {
        id: userId,
        role: "user",
        content: question.trim(),
        state: "complete",
        period: dayLabel(todayInStore()),
      },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        state: "streaming",
        period: dayLabel(todayInStore()),
      },
    ]);
    let answer = "";
    let done = false;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...history, { role: "user", content: question.trim() }],
        }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(55000),
        ]),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          result?.error ?? "Não foi possível conectar à IA. Tente novamente.",
        );
      }
      if (!response.body)
        throw new Error("A resposta não pôde ser recebida. Tente novamente.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const consume = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.type === "error")
          throw new Error(
            event.message || "A resposta foi interrompida. Tente novamente.",
          );
        if (event.type === "done") done = true;
        if (event.type === "delta" && typeof event.text === "string") {
          answer += event.text;
          setEntries((current) =>
            current.map((entry) =>
              entry.id === assistantId ? { ...entry, content: answer } : entry,
            ),
          );
        }
      };
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          lines.forEach(consume);
        }
        buffer += decoder.decode();
        if (buffer.trim()) consume(buffer);
      } finally {
        reader.releaseLock();
      }
      if (!done || !answer.trim())
        throw new Error(
          "A resposta foi interrompida antes de terminar. Tente novamente.",
        );
      setEntries((current) =>
        current.map((entry) =>
          entry.id === assistantId ? { ...entry, state: "complete" } : entry,
        ),
      );
      setAnnouncement("Resposta da Cifrai concluída.");
    } catch (issue) {
      const cancelled = controller.signal.aborted;
      const message = cancelled
        ? "Resposta interrompida. Você pode tentar novamente."
        : issue instanceof Error && issue.name === "TimeoutError"
          ? "A resposta demorou mais que o esperado. Tente novamente."
          : issue instanceof Error
            ? issue.message
            : "Não foi possível responder. Tente novamente.";
      setError(message);
      setAnnouncement(
        cancelled ? "Resposta interrompida." : "A resposta não foi concluída.",
      );
      setEntries((current) =>
        current.map((entry) =>
          entry.id === assistantId
            ? { ...entry, state: cancelled ? "cancelled" : "failed" }
            : entry,
        ),
      );
      if (!cancelled)
        setInput((current) => (current.trim() ? current : question));
    } finally {
      abortRef.current = null;
      setBusy(false);
      if (active) inputRef.current?.focus();
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (input.trim().length > 1000) {
      setError("Envie uma pergunta com até 1.000 caracteres.");
      inputRef.current?.focus();
      return;
    }
    void send(input);
  }

  return (
    <div className="chat-layout">
      <section className="panel chat-panel" aria-label="Conversa com a Cifrai">
        <header className="chat-header">
          <div className="chat-assistant-mark">
            <Sparkles size={20} />
          </div>
          <div>
            <h2>Cifrai, sua assistente de gestão</h2>
            <p>Uma conversa com as vendas reais da Superdeli.</p>
          </div>
          <span
            className={`chat-connection ${connection === "ready" ? "connected" : ""}`}
          >
            <span />
            {connection === "checking"
              ? "Conectando…"
              : connection === "ready"
                ? "Groq conectada"
                : "Indisponível"}
          </span>
        </header>
        <Conversation
          className="chat-conversation"
          aria-label="Histórico da conversa"
          initial={false}
          resize="instant"
          aria-live="off"
        >
          <ConversationContent className="chat-transcript">
            {!entries.length ? (
              <div className="chat-empty">
                <span className="chat-welcome-icon">
                  <Wheat size={34} />
                </span>
                <h3>O que você quer entender hoje?</h3>
                <p>
                  Pergunte sobre faturamento, ticket médio, produtos, horários e
                  formas de pagamento. Eu consulto o caixa (BMWeb) para
                  responder.
                </p>
                <div className="chat-starter-questions">
                  {questions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      disabled={connection !== "ready" || busy}
                      onClick={() => void send(question)}
                    >
                      {question}
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              entries.map((entry) => (
                <article
                  key={entry.id}
                  className={`chat-entry ${entry.role}`}
                  aria-label={
                    entry.role === "user"
                      ? "Sua mensagem"
                      : "Resposta da Cifrai"
                  }
                >
                  <div className="chat-entry-label">
                    {entry.role === "user" ? (
                      <MessageCircle size={14} />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    <span>{entry.role === "user" ? "Você" : "Cifrai"}</span>
                    <span className="chat-entry-period">{entry.period}</span>
                  </div>
                  {entry.content ? (
                    entry.role === "assistant" ? (
                      <MessageResponse
                        className="chat-markdown"
                        isAnimating={entry.state === "streaming"}
                        controls={false}
                      >
                        {entry.content}
                      </MessageResponse>
                    ) : (
                      <p className="chat-user-text">{entry.content}</p>
                    )
                  ) : entry.state === "streaming" ? (
                    <p className="chat-thinking">
                      <LoaderCircle size={15} className="chat-spinner" />
                      Consultando as vendas…
                    </p>
                  ) : (
                    <p className="chat-interrupted">Resposta não concluída.</p>
                  )}
                  {entry.role === "assistant" && entry.state === "complete" && (
                    <button
                      type="button"
                      className="chat-copy"
                      aria-label="Copiar resposta da Cifrai"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(entry.content);
                          setAnnouncement("Resposta copiada.");
                        } catch {
                          setAnnouncement(
                            "Não foi possível copiar. Selecione o texto para copiar manualmente.",
                          );
                        }
                      }}
                    >
                      <Copy size={13} />
                      Copiar resposta
                    </button>
                  )}
                  {entry.content &&
                    (entry.state === "cancelled" ||
                      entry.state === "failed") && (
                      <p className="chat-interrupted">
                        Resposta parcial · não concluída
                      </p>
                    )}
                </article>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton
            className="chat-scroll-button"
            aria-label="Ir para a última mensagem"
          >
            <ArrowDown size={16} />
          </ConversationScrollButton>
        </Conversation>
        <div className="chat-feedback" role="alert">
          {error && (
            <>
              <span>{error}</span>
              {entries.some((entry) => entry.role === "user") && !busy && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => void send(lastRequest.current!.question, true)}
                >
                  <RefreshCw size={14} />
                  Tentar novamente
                </button>
              )}
            </>
          )}
          {connection === "unavailable" && !error && (
            <span>
              A IA não está disponível agora. Verifique a conexão ou a
              configuração da Groq com o responsável.
            </span>
          )}
        </div>
        <form className="chat-composer" noValidate onSubmit={submit}>
          <label className="sr-only" htmlFor="chat-question">
            Sua pergunta para a Cifrai
          </label>
          <textarea
            id="chat-question"
            ref={inputRef}
            className="resize-none"
            rows={2}
            maxLength={1000}
            value={input}
            placeholder="Pergunte sobre vendas, ticket médio, produtos…"
            aria-describedby="chat-input-help"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (!busy) event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="chat-composer-bottom">
            <span id="chat-input-help">
              Enter envia · Shift + Enter quebra a linha
            </span>
            {busy ? (
              <button
                type="button"
                className="button secondary"
                onClick={() => abortRef.current?.abort()}
              >
                <Square size={14} />
                Interromper
              </button>
            ) : (
              <button
                type="submit"
                className="button primary"
                disabled={!input.trim() || connection !== "ready"}
              >
                <Send size={15} />
                Enviar
              </button>
            )}
          </div>
        </form>
        <p className="chat-footnote">
          IA pode errar. Confira os números na tela de Vendas antes de decidir.
        </p>
        <span className="sr-only" role="status" aria-live="polite">
          {announcement}
        </span>
      </section>
      <aside className="chat-context">
        <div className="inline-title">
          <Check size={17} />
          <h2>De onde vêm as respostas</h2>
        </div>
        <p>
          A Cifrai consulta as vendas reais importadas do BMWeb, no período que
          você perguntar. Sem período, ela usa os últimos 30 dias.
        </p>
        <div className="chat-data-note">
          <span className="demo-badge real-badge">
            <span />
            Dados reais · BMWeb
          </span>
          <p>
            Ela vê pedidos, faturamento, produtos, horários e formas de
            pagamento. Custos, estoque e lucro não estão nos dados, então ela
            não calcula margem.
          </p>
        </div>
        <div className="chat-data-note">
          <h3>Você decide o próximo passo.</h3>
          <p>
            A Cifrai explica e sugere. Ela não altera nada na loja, no caixa ou
            nos sistemas.
          </p>
        </div>
        <p className="chat-privacy-note">
          Sua pergunta e resumos das vendas (totais, sem dados de clientes) são
          enviados à Groq para gerar a resposta. A conversa fica nesta sessão e
          não é salva pelo aplicativo.
        </p>
      </aside>
    </div>
  );
}
