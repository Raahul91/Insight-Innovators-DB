import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Send, X, Volume2, VolumeX } from "lucide-react";
import { ERAAvatar } from "./ERAAvatar";
import { useERA } from "./ERAContext";

/**
 * Mobile / tablet floating variant of ERA (hidden on lg+, where ERAPanel takes over).
 */
export const AIAgent = () => {
  const {
    messages,
    input,
    setInput,
    listening,
    speaking,
    streaming,
    voiceEnabled,
    setVoiceEnabled,
    floatingOpen,
    setFloatingOpen,
    sendMessage,
    toggleListen,
    t,
  } = useERA();

  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="lg:hidden">
      <button
        data-testid="ai-agent-toggle"
        onClick={() => setFloatingOpen(!floatingOpen)}
        className="fixed bottom-6 right-6 z-40 group"
        aria-label="Open ERA assistant"
      >
        <div className="relative h-24 w-24 transition-transform group-hover:scale-105">
          <ERAAvatar size={96} speaking={speaking} listening={listening} />
          <span className="absolute top-2 right-2 h-3.5 w-3.5 rounded-full bg-[var(--success)] border-2 border-white z-10" />
        </div>
      </button>

      <AnimatePresence>
        {floatingOpen && (
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
                <div className="h-14 w-14 flex-shrink-0">
                  <ERAAvatar size={56} speaking={speaking} listening={listening} />
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
                    setVoiceEnabled(!voiceEnabled);
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
                  onClick={() => setFloatingOpen(false)}
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
    </div>
  );
};
