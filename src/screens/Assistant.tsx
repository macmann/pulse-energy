import { useRef, useState } from "react";
import { Check, Send, Sparkles, Wrench } from "lucide-react";
import type { Dataset } from "../lib/data";
import { answer, STARTERS, type AssistantReply } from "../lib/assistant";
import { seedRoutine, useRoutines } from "../store/routines";

type Msg =
  | { role: "user"; text: string }
  | { role: "ai"; reply: AssistantReply };

export function Assistant({
  ds,
  onGoRoutines,
}: {
  ds: Dataset;
  onGoRoutines: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const { addRoutine, hasRoutine } = useRoutines();
  const endRef = useRef<HTMLDivElement>(null);

  function ask(q: string) {
    const text = q.trim();
    if (!text) return;
    const reply = answer(text, ds);
    setMsgs((m) => [...m, { role: "user", text }, { role: "ai", reply }]);
    setInput("");
    requestAnimationFrame(() =>
      endRef.current?.scrollIntoView({ behavior: "smooth" }),
    );
  }

  function setRoutine(id: string) {
    const r = seedRoutine(id);
    if (r) addRoutine(r);
  }

  return (
    <div className="screen screen-pad-top" style={{ paddingBottom: 150 }}>
      <h1 style={{ fontSize: 22 }}>Ask me anything</h1>
      <p className="muted tiny" style={{ marginTop: 4 }}>
        about your home's energy, in plain words
      </p>

      {msgs.length === 0 && (
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

      <div className="chat-thread" style={{ marginTop: 16 }}>
        {msgs.map((m, i) =>
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
                {m.reply.text}
                {m.reply.routineId && (
                  <div style={{ marginTop: 12 }}>
                    {hasRoutine(m.reply.routineId) ? (
                      <button
                        className="btn btn-set is-set"
                        onClick={onGoRoutines}
                      >
                        <Check size={15} /> Routine set — view it
                      </button>
                    ) : (
                      <button
                        className="btn btn-accent"
                        onClick={() => setRoutine(m.reply.routineId!)}
                      >
                        Set this routine
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="chips">
          {STARTERS.map((s) => (
            <button key={s.q} className="chip" onClick={() => ask(s.q)}>
              {s.q}
            </button>
          ))}
        </div>
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your energy…"
          enterKeyHint="send"
        />
        <button className="btn btn-accent" type="submit" aria-label="Send">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
