import { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { Check, RefreshCw, Send, Sparkles, WifiOff, Wrench } from "lucide-react";
import type { Dataset } from "../lib/data";
import { answer, STARTERS, type AssistantReply } from "../lib/assistant";
import { useGoals } from "../store/goals";
import type { ActionId } from "../lib/engine";
import { ToolRenderer } from "../components/chat/ToolRenderer";
import { Markdown } from "../components/chat/Markdown";


/* ── Fallback message shape (offline mode) ── */
type FallbackMsg =
  | { role: "user"; text: string }
  | { role: "ai"; reply: AssistantReply };

/* ── Component ── */
export function Assistant({
  ds,
  householdId,
  onGoGoals,
}: {
  ds: Dataset;
  householdId: string;
  onGoGoals: () => void;
}) {
  const [useFallback, setUseFallback] = useState(false);
  const { setDone, isDone } = useGoals();
  const endRef = useRef<HTMLDivElement>(null);

  /* ── AI SDK chat (online mode) ── */
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error: chatError,
    append,
    reload,
  } = useChat({
    api: "/api/chat",
    body: { householdId },
  });

  /* ── Switch to fallback on first network / 503 error ── */
  useEffect(() => {
    if (chatError && !useFallback) {
      setUseFallback(true);
    }
  }, [chatError, useFallback]);

  /* ── Fallback messages (offline mode) ── */
  const [fallbackMsgs, setFallbackMsgs] = useState<FallbackMsg[]>([]);
  const [fallbackInput, setFallbackInput] = useState("");

  function askFallback(q: string) {
    const text = q.trim();
    if (!text) return;
    const reply = answer(text, ds);
    setFallbackMsgs((m) => [...m, { role: "user", text }, { role: "ai", reply }]);
    setFallbackInput("");
  }

  /* ── Scroll to bottom on new messages ── */
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() =>
      endRef.current?.scrollIntoView({ behavior: "smooth" })
    );
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, fallbackMsgs, isLoading, scrollToBottom]);

  /* ── Goal helper (fallback mode) ── */
  function activateGoal(id: ActionId) {
    setDone(id, true);
  }

  /* ── Handle MissingInfoForm submission ── */
  function handleInfoSubmit(text: string) {
    append({ role: "user", content: text });
  }

  /* ── Starter chip handler ── */
  function handleStarter(q: string) {
    if (useFallback) {
      askFallback(q);
    } else {
      append({ role: "user", content: q });
    }
  }

  /* ────────────────── RENDER ────────────────── */
  return (
    <div className="screen screen-pad-top" style={{ paddingBottom: 150 }}>
      <h1 style={{ fontSize: 22 }}>Ask me anything</h1>
      <p className="muted tiny" style={{ marginTop: 4 }}>
        about your home's energy, in plain words
      </p>

      {/* Offline banner */}
      {useFallback && (
        <div className="offline-banner">
          <WifiOff size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
          Running in offline mode
        </div>
      )}

      {/* Error banner (online mode, non-fatal) */}
      {chatError && !useFallback && (
        <div className="error-banner">
          <span>Connection error — retrying…</span>
          <button className="btn btn-ghost" onClick={() => reload()}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {(useFallback ? fallbackMsgs.length === 0 : messages.length === 0) && (
        <div
          className="card card-pad"
          style={{ marginTop: 16, textAlign: "center" }}
        >
          <Sparkles size={22} color="var(--accent)" />
          <p className="muted" style={{ marginTop: 8, fontSize: 13.5 }}>
            I read your meter, your tariff and your bills. Try a question below.
          </p>
        </div>
      )}

      {/* ── Chat thread ── */}
      <div className="chat-thread" style={{ marginTop: 16 }}>
        {useFallback
          ? /* ── Fallback (offline) messages ── */
            fallbackMsgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="msg user">
                  <div className="bubble">{m.text}</div>
                </div>
              ) : (
                <div key={i} className="msg ai">
                  <div className="tool-chip">
                    <Wrench size={12} /> {m.reply.toolLabel}
                  </div>
                  <div className="bubble">
                    <Markdown text={m.reply.text} />
                    {m.reply.actionId && (
                      <div style={{ marginTop: 12 }}>
                        {isDone(m.reply.actionId) ? (
                          <button
                            className="btn btn-set is-set"
                            onClick={onGoGoals}
                          >
                            <Check size={15} /> Goal activated — view it
                          </button>
                        ) : (
                          <button
                            className="btn btn-accent"
                            onClick={() => activateGoal(m.reply.actionId!)}
                          >
                            Activate this goal
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            )
          : /* ── Online (AI SDK) messages with parts ── */
            messages.map((message) => (
              <div key={message.id}>
                {message.parts.map((part, pi) => {
                  if (part.type === "text") {
                    return (
                      <div
                        key={pi}
                        className={`msg ${message.role === "user" ? "user" : "ai"}`}
                      >
                        <div className="bubble">
                          <Markdown text={part.text} />
                        </div>
                      </div>
                    );
                  }

                  if (part.type === "tool-invocation") {
                    const inv = part.toolInvocation;
                    return (
                      <div key={pi} className="msg ai">
                        <ToolRenderer
                          toolName={inv.toolName}
                          state={inv.state}
                          args={inv.args}
                          result={"result" in inv ? inv.result : undefined}
                          onSubmitInfo={handleInfoSubmit}
                        />
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            ))}

        {/* Typing indicator */}
        {isLoading && !useFallback && (
          <div className="msg ai">
            <div className="typing-indicator">
              <div className="dot" />
              <div className="dot" />
              <div className="dot" />
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* ── Starter chips ── */}
      <div style={{ marginTop: 18 }}>
        <div className="chips">
          {STARTERS.map((s) => (
            <button
              key={s.q}
              className="chip"
              onClick={() => handleStarter(s.q)}
            >
              {s.q}
            </button>
          ))}
        </div>
      </div>

      {/* ── Composer ── */}
      {useFallback ? (
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            askFallback(fallbackInput);
          }}
        >
          <input
            value={fallbackInput}
            onChange={(e) => setFallbackInput(e.target.value)}
            placeholder="Ask about your energy…"
            enterKeyHint="send"
          />
          <button className="btn btn-accent" type="submit" aria-label="Send">
            <Send size={18} />
          </button>
        </form>
      ) : (
        <form className="composer" onSubmit={handleSubmit}>
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about your energy…"
            enterKeyHint="send"
          />
          <button
            className="btn btn-accent"
            type="submit"
            aria-label="Send"
            disabled={isLoading}
          >
            <Send size={18} />
          </button>
        </form>
      )}
    </div>
  );
}
