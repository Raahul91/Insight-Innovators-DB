import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Send, X, Volume2, VolumeX } from "lucide-react";
import { API } from "../lib/api";
import { useLanguage } from "../lib/language";
import { ERAAvatar } from "./ERAAvatar";

const SESSION_KEY = "era-session-id";
const getSessionId = () => {
  let s = localStorage.getItem(SESSION_KEY);
  if (!s) {
    s = `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    localStorage.setItem(SESSION_KEY, s);
  }
  return s;
};

export const AIAgent = ({ portfolioContext }) => {
  const { code: langCode, label: langLabel, locale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "assistant", content: t("era_intro") }]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const recognitionRef = useRef(null);
  const scrollRef = useRef(null);
  const sessionId = useRef(getSessionId()).current;

  // Update intro message when language changes (only if only the intro is in the log)
  useEffect(() => {
    setMessages((m) => {
      if (m.length === 1 && m[0].role === "assistant") {
        return [{ role: "assistant", content: t("era_intro") }];
      }
      return m;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langCode]);

  // Update recognition language
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = locale;
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setInput(text);
      setListening(false);
      setTimeout(() => sendMessage(text), 200);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  // Broadcast streaming status so other pages can show "ERA is helping…"
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("era-status", { detail: { streaming, speaking } }),
    );
  }, [streaming, speaking]);

  const speak = (text) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = locale;
    // Try to pick a matching voice for the locale
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(locale.toLowerCase().split("-")[0]));
    if (match) utter.voice = match;
    utter.rate = 1.02;
    utter.pitch = 1;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  const toggleListen = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        window.speechSynthesis?.cancel();
        recognitionRef.current.lang = locale;
        recognitionRef.current.start();
        setListening(true);
      } catch (_) {
        setListening(false);
      }
    }
  };

  const sendMessage = async (msgText) => {
    const text = (msgText ?? input).trim();
    if (!text || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
          language: langLabel,
          portfolio_context: portfolioContext || null,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).replace(/^\s/, "");
          if (payload === "[DONE]") continue;
          if (payload.startsWith("[error]")) {
            full += "\n(Error contacting ERA.)";
          } else {
            full += payload;
          }
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: full };
            return copy;
          });
        }
      }
      if (full) speak(full);
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "…" };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  // Expose global helpers so any page can trigger ERA
  useEffect(() => {
    window.askERA = (prompt) => {
      setOpen(true);
      setTimeout(() => sendMessage(prompt), 250);
    };
    window.eraGreet = (text) => {
      // Local greeting: no backend, just show + speak
      setOpen(true);
      setMessages((m) => [...m, { role: "assistant", content: text }]);
      setTimeout(() => speak(text), 300);
    };
    return () => {
      delete window.askERA;
      delete window.eraGreet;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming, locale, voiceEnabled]);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  return (
    <>
      <button
        data-testid="ai-agent-toggle"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 group"
        aria-label="Open ERA assistant"
      >
        <div
          className={`relative h-16 w-16 rounded-full overflow-hidden ring-4 ring-white shadow-xl transition-transform group-hover:scale-105`}
        >
          <ERAAvatar size={64} speaking={speaking} listening={listening} />
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[var(--success)] border-2 border-white z-10" />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            data-testid="ai-agent-panel"
            className="fixed bottom-28 right-6 z-40 w-[380px] max-w-[calc(100vw-32px)] h-[560px] max-h-[calc(100vh-140px)] glass-panel rounded-2xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/40">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full overflow-hidden ring-2 ring-white">
                  <ERAAvatar size={48} speaking={speaking} listening={listening} />
                </div>
                <div>
                  <div className="font-display font-bold text-[var(--primary)] leading-tight flex items-center gap-2">
                    ERA
                    <span className={`era-waves text-[var(--accent)] ${speaking ? "active" : ""}`} aria-hidden>
                      <span /><span /><span /><span /><span />
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {streaming ? "…" : listening ? "◉ live" : speaking ? "♪" : t("era_role")}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  data-testid="voice-toggle-btn"
                  onClick={() => {
                    setVoiceEnabled((v) => !v);
                    if (voiceEnabled) window.speechSynthesis?.cancel();
                  }}
                  className="h-8 w-8 rounded-full hover:bg-white/60 flex items-center justify-center"
                  title={voiceEnabled ? "Mute voice" : "Enable voice"}
                >
                  {voiceEnabled ? (
                    <Volume2 size={16} className="text-[var(--primary)]" />
                  ) : (
                    <VolumeX size={16} className="text-[var(--text-secondary)]" />
                  )}
                </button>
                <button
                  data-testid="ai-agent-close"
                  onClick={() => setOpen(false)}
                  className="h-8 w-8 rounded-full hover:bg-white/60 flex items-center justify-center"
                >
                  <X size={16} className="text-[var(--primary)]" />
                </button>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
              data-testid="ai-agent-messages"
            >
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-[var(--primary)] text-white rounded-br-sm"
                        : "bg-white/85 border border-white/60 text-[var(--text-primary)] rounded-bl-sm"
                    }`}
                  >
                    {m.content || (
                      <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-bounce" />
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:120ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:240ms]" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 px-4 py-3 border-t border-white/40 bg-white/40"
            >
              <button
                type="button"
                data-testid="mic-btn"
                onClick={toggleListen}
                className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${
                  listening
                    ? "bg-[var(--danger)] text-white"
                    : "bg-white text-[var(--primary)] border border-[var(--border)] hover:bg-gray-50"
                }`}
                title={listening ? "Stop listening" : "Speak"}
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <input
                data-testid="ai-agent-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("era_input_placeholder")}
                className="flex-1 h-10 px-4 rounded-full bg-white border border-[var(--border)] text-sm outline-none focus:border-[var(--accent)] transition-colors"
              />
              <button
                type="submit"
                data-testid="ai-agent-send"
                disabled={!input.trim() || streaming}
                className="h-10 w-10 rounded-full bg-[var(--primary)] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[var(--accent)] transition-colors"
              >
                <Send size={16} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
