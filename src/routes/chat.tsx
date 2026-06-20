import { useChat } from "@ai-sdk/react";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import { ArrowUp, Database, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { z } from "zod";

import { AppShell, useActiveHouseholdId } from "@/components/AppShell";
import { toolSourceLabels } from "@/lib/agent-tool-labels";

const searchSchema = z.object({ q: z.string().optional(), hh: z.string().optional() });

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Enpal Pulse" },
      { name: "description", content: "Ask your Enpal home energy assistant anything." },
    ],
  }),
  validateSearch: searchSchema,
  component: ChatPage,
});

const SUGGESTIONS = [
  "How much would it cost to run the dishwasher for 2 hours right now?",
  "What's the best time today to charge my EV?",
  "Is my heat pump covered under my maintenance contract?",
  "Why was my bill higher in August?",
];

function ChatPage() {
  const { q } = Route.useSearch();
  const householdId = useActiveHouseholdId();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const submittedQ = useRef<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { householdId },
      }),
    [householdId],
  );

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  // Clear conversation when household changes so context isn't mixed.
  useEffect(() => {
    setMessages([]);
    submittedQ.current = null;
  }, [householdId, setMessages]);

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // Auto-send q from deep link (once per unique q)
  useEffect(() => {
    if (q && submittedQ.current !== q) {
      submittedQ.current = q;
      sendMessage({ text: q });
    }
  }, [q, sendMessage]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-12rem)] sm:h-[calc(100vh-10rem)]">
        <div className="mb-4">
          <h1 className="text-navy text-3xl sm:text-4xl">Ask Enpal Pulse</h1>
          <p className="text-stone mt-1">Grounded in your household, tariff, contract and live prices.</p>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto card-soft p-5 sm:p-6 space-y-5"
        >
          {messages.length === 0 && (
            <div className="space-y-4">
              <p className="text-stone">Try one of these:</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage({ text: s })}
                    className="text-left text-sm font-semibold text-navy bg-cta/20 hover:bg-cta/40 transition rounded-2xl px-4 py-3 leading-snug"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {status === "submitted" && (
            <div className="flex items-center gap-2 text-stone text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking your data…
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-4 flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            rows={1}
            placeholder="Ask about your energy, bill, contract…"
            className="flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-navy placeholder:text-stone/70 focus:outline-none focus:ring-2 focus:ring-yellow"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="btn-cta disabled:opacity-50 disabled:cursor-not-allowed h-12 w-12 justify-center !p-0"
            aria-label="Send"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </form>
      </div>
    </AppShell>
  );
}

type UIMsg = ReturnType<typeof useChat>["messages"][number];

function MessageBubble({ message }: { message: UIMsg }) {
  const isUser = message.role === "user";

  const text = message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");

  const toolNames = new Set<string>();
  for (const part of message.parts) {
    const t = (part as { type: string }).type;
    if (t.startsWith("tool-")) {
      toolNames.add(t.slice("tool-".length));
    }
  }
  const sources = Array.from(toolNames)
    .map((n) => toolSourceLabels[n as keyof typeof toolSourceLabels])
    .filter(Boolean);
  const uniqueSources = Array.from(new Set(sources));

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-navy text-white px-4 py-2.5 text-[15px] font-medium leading-relaxed">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2">
        <div className="rounded-2xl rounded-bl-md bg-secondary/70 text-navy px-4 py-3 text-[15px] leading-relaxed prose prose-sm max-w-none prose-headings:text-navy prose-strong:text-navy prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
          {text ? <ReactMarkdown>{text}</ReactMarkdown> : <span className="text-stone italic">…</span>}
        </div>
        {uniqueSources.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-stone pl-1">
            <Database className="w-3 h-3" />
            <span className="font-semibold">based on:</span>
            <span>{uniqueSources.join(", ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
