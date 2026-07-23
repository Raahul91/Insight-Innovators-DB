import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { API } from "../lib/api";
import { useLanguage } from "../lib/language";

const SESSION_KEY = "era-session-id";
const getSessionId = () => {
  let s = localStorage.getItem(SESSION_KEY);
  if (!s) {
    s = `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    localStorage.setItem(SESSION_KEY, s);
  }
  return s;
};

const ERAContext = createContext(null);

export const ERAProvider = ({ children, portfolioContext = null }) => {
  const { code: langCode, label: langLabel, locale, t } = useLanguage();
  const [messages, setMessages] = useState([{ role: "assistant", content: t("era_intro") }]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [floatingOpen, setFloatingOpen] = useState(false);
  const recognitionRef = useRef(null);
  const sessionId = useRef(getSessionId()).current;
  const portfolioContextRef = useRef(portfolioContext);
  portfolioContextRef.current = portfolioContext;

  // Reset intro on language change if only intro present
  useEffect(() => {
    setMessages((m) => (m.length === 1 && m[0].role === "assistant" ? [{ role: "assistant", content: t("era_intro") }] : m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langCode]);

  // Broadcast status so pages (Objectives) can show badges
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("era-status", { detail: { streaming, speaking } }));
  }, [streaming, speaking]);

  const speak = useCallback(
    (text) => {
      if (!voiceEnabled || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = locale;
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find(
        (v) => v.lang && v.lang.toLowerCase().startsWith(locale.toLowerCase().split("-")[0]),
      );
      if (match) utter.voice = match;
      utter.rate = 1.02;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    },
    [voiceEnabled, locale],
  );

  const sendMessage = useCallback(
    async (msgText) => {
      const text = (msgText ?? "").trim();
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
            portfolio_context: portfolioContextRef.current || null,
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
    },
    [streaming, sessionId, langLabel, speak],
  );

  const greetLocal = useCallback(
    (text) => {
      setMessages((m) => [...m, { role: "assistant", content: text }]);
      setTimeout(() => speak(text), 300);
    },
    [speak],
  );

  // Setup SpeechRecognition (recreate when locale changes)
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
  }, [locale, sendMessage]);

  const toggleListen = useCallback(() => {
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
  }, [listening, locale]);

  // Global helpers
  useEffect(() => {
    window.askERA = (prompt) => {
      setFloatingOpen(true);
      setTimeout(() => sendMessage(prompt), 200);
    };
    window.eraGreet = (text) => {
      setFloatingOpen(true);
      greetLocal(text);
    };
    return () => {
      delete window.askERA;
      delete window.eraGreet;
    };
  }, [sendMessage, greetLocal]);

  const value = {
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
    speak,
    t,
    locale,
  };

  return <ERAContext.Provider value={value}>{children}</ERAContext.Provider>;
};

export const useERA = () => {
  const ctx = useContext(ERAContext);
  if (!ctx) throw new Error("useERA must be used within ERAProvider");
  return ctx;
};
