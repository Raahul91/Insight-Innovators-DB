import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Mic, MicOff, Send, Volume2, VolumeX, ArrowRight } from "lucide-react";
import { ERAAvatar } from "./ERAAvatar";
import { useERA } from "./ERAContext";

/**
 * Compact left assistant rail — visible only on lg+ (laptop and above).
 * Preserves all animations (halo, bob, waves, listen ring).
 */
export const ERAPanel = () => {
  const {
    messages,
    input,
    setInput,
    listening,
    speaking,
    streaming,
    voiceEnabled,
    setVoiceEnabled,
    sendMessage,
    toggleListen,
    t,
  } = useERA();

  const location = useLocation();
  const sectionKey =
    location.pathname === "/objectives"
      ? "objectives"
      : location.pathname === "/products"
      ? "products"
      : "dashboard";
  const sectionCaption = t(`section_${sectionKey}`);
  // Different body tilts per section to make ERA feel like she's pointing/gesturing
  const gestureTransform = {
    dashboard: "rotate(-4deg) translateY(-4px)",
    objectives: "rotate(3deg) translateY(0px)",
    products: "rotate(6deg) translateY(4px)",
  }[sectionKey];

  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streaming]);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <aside
      data-testid="era-panel-desktop"
      className="hidden lg:flex flex-col h-screen sticky top-0 border-r border-[var(--border)] bg-gradient-to-b from-[#F1F6FE] via-[#E9F1FC] to-[#DDE9F9] relative overflow-hidden"
    >
      {/* Decorative background rings */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[var(--accent)]/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-[420px] h-[420px] rounded-full bg-[var(--primary)]/10 blur-3xl" aria-hidden />

      {/* Brand row */}
      <div className="px-5 pt-5 pb-2 relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[var(--primary)] flex items-center justify-center">
            <span className="font-display font-black text-white text-xs">E</span>
          </div>
          <div>
            <div className="font-display font-black text-base leading-none text-[var(--primary)]">EuroBank</div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-secondary)] mt-1">
              European Wealth
            </div>
          </div>
        </div>
        <div className="text-[10px] tracking-[0.16em] uppercase text-[var(--text-secondary)]">
          Assistant
        </div>
      </div>

      {/* Compact assistant identity */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 pt-2">
        <div className="relative" data-testid="era-gesture-wrap">
          {/* Active-section badge */}
          <div
            key={sectionKey}
            data-testid={`era-callout-${sectionKey}`}
            className="relative z-30 mx-auto mb-1 flex w-fit items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 border border-[var(--border)] shadow-sm era-callout"
          >
            <span className="text-xs font-semibold text-[var(--primary)] whitespace-nowrap">
              {sectionCaption}
            </span>
            <ArrowRight size={12} className="text-[var(--accent)] era-callout-arrow" />
          </div>

          <div
            className="era-gesture"
            style={{ transform: gestureTransform, transition: "transform 0.6s cubic-bezier(.4,1.4,.6,1)" }}
          >
            <ERAAvatar size={280} speaking={speaking} listening={listening} />
          </div>
        </div>
        <div className="-mt-1 text-center">
          <div className="flex items-center justify-center gap-3">
            <h2 className="font-display font-black text-2xl text-[var(--primary)]">ERA</h2>
            <span
              className={`era-waves text-[var(--accent)] ${speaking ? "active" : ""}`}
              aria-hidden
            >
              <span /><span /><span /><span /><span />
            </span>
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">{t("era_role")}</div>
          <div
            data-testid="era-panel-status"
            className={`mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
              streaming
                ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                : listening
                ? "bg-[var(--danger)]/10 text-[var(--danger)]"
                : speaking
                ? "bg-[var(--success)]/10 text-[var(--success)]"
                : "bg-white/70 text-[var(--text-secondary)] border border-[var(--border)]"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${
                  streaming || listening || speaking ? "animate-ping" : ""
                }`}
                style={{
                  background: streaming ? "#007AFF" : listening ? "#FF3B30" : speaking ? "#34C759" : "#9CA3AF",
                }}
              />
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{
                  background: streaming ? "#007AFF" : listening ? "#FF3B30" : speaking ? "#34C759" : "#9CA3AF",
                }}
              />
            </span>
            {streaming
              ? t("era_status_helping")
              : listening
              ? "Listening…"
              : speaking
              ? "Speaking…"
              : "Ready"}
          </div>
        </div>
      </div>

      {/* Latest message caption bubble */}
      <div className="relative z-10 px-4 pt-3 pb-2 flex-1 min-h-0">
        <div
          ref={scrollRef}
          data-testid="era-panel-messages"
          className="h-full max-h-64 overflow-y-auto rounded-2xl bg-white/60 backdrop-blur border border-white/70 p-3 space-y-2 shadow-sm"
        >
          {messages.slice(-4).map((m, i) => (
            <div key={i} className={`text-xs leading-relaxed ${m.role === "user" ? "text-[var(--primary)]" : "text-[var(--text-primary)]"}`}>
              <span
                className={`inline-block px-3 py-1.5 rounded-xl ${
                  m.role === "user"
                    ? "bg-[var(--primary)] text-white"
                    : "bg-white border border-[var(--border)] text-[var(--text-primary)]"
                }`}
              >
                {m.content || (
                  <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:240ms]" />
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Input row */}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 grid grid-cols-[40px_minmax(0,1fr)_40px_40px] items-center gap-2 px-4 pb-5 pt-2"
      >
        <button
          type="button"
          data-testid="era-panel-mic"
          onClick={toggleListen}
          className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors shadow-sm ${
            listening
              ? "bg-[var(--danger)] text-white"
              : "bg-white text-[var(--primary)] border border-[var(--border)] hover:bg-gray-50"
          }`}
          title={listening ? "Stop listening" : "Speak"}
        >
          {listening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <input
          data-testid="era-panel-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("era_input_placeholder")}
          className="min-w-0 h-10 px-3 rounded-full bg-white border border-[var(--border)] text-xs outline-none focus:border-[var(--accent)] transition-colors shadow-sm"
        />
        <button
          type="button"
          data-testid="era-panel-voice-toggle"
          onClick={() => {
            setVoiceEnabled(!voiceEnabled);
            if (voiceEnabled) window.speechSynthesis?.cancel();
          }}
          className="h-10 w-10 rounded-full bg-white border border-[var(--border)] flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
        >
          {voiceEnabled ? (
            <Volume2 size={16} className="text-[var(--primary)]" />
          ) : (
            <VolumeX size={16} className="text-[var(--text-secondary)]" />
          )}
        </button>
        <button
          type="submit"
          data-testid="era-panel-send"
          disabled={!input.trim() || streaming}
          className="h-10 w-10 rounded-full bg-[var(--primary)] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[var(--accent)] transition-colors shadow-sm"
        >
          <Send size={16} />
        </button>
      </form>
    </aside>
  );
};
