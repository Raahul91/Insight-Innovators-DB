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

const FEMININE_VOICE_NAMES = {
  en: ["samantha", "ava", "allison", "susan", "zoe", "victoria", "karen", "aria", "jenny", "zira", "hazel", "female"],
  de: ["anna", "petra", "vicki", "marlene", "katja", "female"],
  fr: ["amelie", "audrey", "marie", "virginie", "hortense", "female"],
  es: ["monica", "paulina", "marisol", "helena", "laura", "female"],
  it: ["alice", "federica", "elsa", "female"],
};

const MASCULINE_VOICE_NAMES = [
  "alex", "daniel", "fred", "ralph", "thomas", "jorge", "diego", "luca", "male",
];

const selectBestVoice = (voices, locale) => {
  const language = locale.toLowerCase().split("-")[0];
  const preferredNames = FEMININE_VOICE_NAMES[language] || FEMININE_VOICE_NAMES.en;

  return voices
    .filter((voice) => voice.lang?.toLowerCase().startsWith(language))
    .map((voice) => {
      const name = voice.name.toLowerCase();
      let score = 0;
      if (voice.lang.toLowerCase() === locale.toLowerCase()) score += 40;
      if (voice.localService) score += 12;
      if (voice.default) score += 4;

      const preferredIndex = preferredNames.findIndex((candidate) => name.includes(candidate));
      if (preferredIndex >= 0) score += 100 - preferredIndex * 4;
      if (/(premium|enhanced|natural|neural|siri)/i.test(name)) score += 35;
      if (MASCULINE_VOICE_NAMES.some((candidate) => name.includes(candidate))) score -= 80;

      return { voice, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.voice;
};

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
  const recognitionSuppressedRef = useRef(false);
  const listeningTimerRef = useRef(null);
  const activeRequestRef = useRef(null);
  const speakRef = useRef(null);
  const pendingActionRef = useRef(null);
  const streamingRef = useRef(false);
  const sessionId = useRef(getSessionId()).current;
  const portfolioContextRef = useRef(portfolioContext);
  portfolioContextRef.current = portfolioContext;
  streamingRef.current = streaming;

  const clearListeningTimer = useCallback(() => {
    if (listeningTimerRef.current) {
      clearTimeout(listeningTimerRef.current);
      listeningTimerRef.current = null;
    }
  }, []);

  const isConfirmation = useCallback((text) => {
    const normalized = text
      .toLowerCase()
      .trim()
      .replace(/[.,!?]/g, "")
      .replace(/\s+/g, " ");
    if (normalized === "yes") return true;
    if (/\b(no|not|don't|do not|wait|stop)\b/i.test(normalized)) return false;
    return (
      /^(yes|yeah|yep|sure|okay|ok|correct|absolutely|ja|oui|sí|si|certo)\b/i.test(normalized) ||
      /^(please\s+)?(confirm|confirmed|go ahead|continue|select it|choose it|do it)\b/i.test(normalized) ||
      /^(i confirm|you can select it|that'?s right|that is right|va bene)\b/i.test(normalized)
    );
  }, []);

  const isRejection = useCallback((text) => {
    const normalized = text.toLowerCase().trim().replace(/[.,!?]/g, "").replace(/\s+/g, " ");
    return /^(no|nope|not yet|change it|don't select it|do not select it|nein|non|niet|não)(\s+please)?$/i.test(
      normalized,
    );
  }, []);

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
    (text, options = {}) => {
      if (!voiceEnabled || !window.speechSynthesis) return;
      const listenAfter = options.listenAfter !== false;

      const speakWithAvailableVoices = () => {
        clearListeningTimer();
        // Never let speech recognition capture Era's own voice or a stale final transcript.
        recognitionSuppressedRef.current = true;
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch (_) {
            // Recognition may already be stopped.
          }
        }
        setListening(false);
        window.speechSynthesis.cancel();
        const spokenText = text
          .replace(/[*_#`]/g, "")
          .replace(/\bERA\b/g, "Era")
          .replace(/\s+/g, " ")
          .trim();
        const utter = new SpeechSynthesisUtterance(spokenText);
        utter.lang = locale;
        const match = selectBestVoice(window.speechSynthesis.getVoices(), locale);
        if (match) utter.voice = match;
        utter.rate = 0.94;
        utter.pitch = 1.06;
        utter.volume = 1;
        utter.onstart = () => setSpeaking(true);
        utter.onend = () => {
          setSpeaking(false);
          if (!listenAfter) {
            recognitionSuppressedRef.current = true;
            setListening(false);
            return;
          }
          // Behave like a call assistant: after Era finishes, listen for the customer's reply.
          setTimeout(() => {
            const rec = recognitionRef.current;
            if (!rec || streamingRef.current) return;
            try {
              recognitionSuppressedRef.current = false;
              rec.lang = locale;
              rec.start();
              setListening(true);
              clearListeningTimer();
              listeningTimerRef.current = setTimeout(() => {
                recognitionSuppressedRef.current = true;
                try {
                  rec.abort();
                } catch (_) {
                  // Recognition may already have ended.
                }
                setListening(false);
                const reminder = "I didn’t hear an answer. Could you please answer again?";
                setMessages((m) => [...m, { role: "assistant", content: reminder }]);
                speakRef.current?.(reminder);
              }, 5000);
            } catch (_) {
              // Recognition may already be active or microphone permission may not be granted.
            }
          }, 450);
        };
        utter.onerror = () => {
          recognitionSuppressedRef.current = false;
          setSpeaking(false);
        };
        window.speechSynthesis.speak(utter);
      };

      if (window.speechSynthesis.getVoices().length) {
        speakWithAvailableVoices();
        return;
      }

      // Chromium may populate system voices asynchronously on the first request.
      let hasSpoken = false;
      const speakOnce = () => {
        if (hasSpoken) return;
        hasSpoken = true;
        speakWithAvailableVoices();
      };
      const handleVoicesChanged = () => {
        window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
        speakOnce();
      };
      window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged, { once: true });
      setTimeout(() => {
        window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
        speakOnce();
      }, 500);
    },
    [voiceEnabled, locale, clearListeningTimer],
  );
  speakRef.current = speak;

  const sendMessage = useCallback(
    async (msgText, options = {}) => {
      const text = (msgText ?? "").trim();
      if (!text || streaming) return;
      const displayUser = options.displayUser !== false;
      const expectResponse = options.expectResponse !== false;

      if (pendingActionRef.current && isConfirmation(text)) {
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        setInput("");
        const confirmation = `Perfect. I’ll select “${action.label}” and continue.`;
        setMessages((m) => [
          ...m,
          ...(displayUser ? [{ role: "user", content: text }] : []),
          { role: "assistant", content: confirmation },
        ]);
        window.dispatchEvent(
          new CustomEvent("era-questionnaire-action", {
            detail: { ...action, confirmed: true },
          }),
        );
        setTimeout(() => speak(confirmation), 150);
        return;
      }

      if (pendingActionRef.current && isRejection(text)) {
        pendingActionRef.current = null;
        setInput("");
        const retry = "No problem. Tell me what you would prefer, and I’ll help you choose again.";
        setMessages((m) => [
          ...m,
          ...(displayUser ? [{ role: "user", content: text }] : []),
          { role: "assistant", content: retry },
        ]);
        setTimeout(() => speak(retry), 150);
        return;
      }

      const baseQuestionnaireContext =
        options.questionnaireContext || window.eraQuestionnaireContext || null;
      const questionnaireContext =
        baseQuestionnaireContext && pendingActionRef.current
          ? {
              ...baseQuestionnaireContext,
              pending_proposal: {
                value: pendingActionRef.current.value,
                label: pendingActionRef.current.label,
              },
              confirmation_required: true,
            }
          : baseQuestionnaireContext;
      setInput("");
      setMessages((m) => [
        ...m,
        ...(displayUser ? [{ role: "user", content: text }] : []),
        { role: "assistant", content: "" },
      ]);
      setStreaming(true);
      activeRequestRef.current?.abort();
      const controller = new AbortController();
      activeRequestRef.current = controller;

      try {
        const res = await fetch(`${API}/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            session_id: sessionId,
            language: langLabel,
            portfolio_context: portfolioContextRef.current || null,
            questionnaire_context: questionnaireContext,
          }),
          signal: controller.signal,
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
            const lines = chunk.split("\n");
            const eventType =
              lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
            const dataLine = lines.find((line) => line.startsWith("data:"));
            if (!dataLine) continue;
            const payload = JSON.parse(dataLine.slice(5).trim());

            if (eventType === "message") {
              full += payload.text || "";
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: full };
                return copy;
              });
            } else if (eventType === "questionnaire_action") {
              if (payload.confirmed) {
                pendingActionRef.current = null;
                window.dispatchEvent(
                  new CustomEvent("era-questionnaire-action", { detail: payload }),
                );
              } else {
                // Keep inferred recommendations pending until the customer explicitly confirms.
                pendingActionRef.current = payload;
              }
            } else if (eventType === "error") {
              throw new Error(payload.message || "Error contacting Era.");
            }
          }
        }
        if (full) speak(full, { listenAfter: expectResponse });
      } catch (e) {
        if (e.name === "AbortError") return;
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content: e.message || "I couldn't connect just now. Please try again.",
          };
          return copy;
        });
      } finally {
        if (activeRequestRef.current === controller) {
          activeRequestRef.current = null;
          setStreaming(false);
        }
      }
    },
    [streaming, sessionId, langLabel, speak, isConfirmation, isRejection],
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
      if (recognitionSuppressedRef.current) return;
      clearListeningTimer();
      const text = e.results[0][0].transcript;
      setInput(text);
      setListening(false);
      setTimeout(() => sendMessage(text), 200);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
    };
    recognitionRef.current = rec;
  }, [locale, sendMessage, clearListeningTimer]);

  // Unlock browser speech output on the first user interaction.
  useEffect(() => {
    const unlockSpeech = () => {
      if (!window.speechSynthesis) return;
      const utterance = new SpeechSynthesisUtterance(" ");
      utterance.volume = 0;
      window.speechSynthesis.speak(utterance);
    };
    window.addEventListener("pointerdown", unlockSpeech, { once: true });
    window.addEventListener("keydown", unlockSpeech, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockSpeech);
      window.removeEventListener("keydown", unlockSpeech);
    };
  }, []);

  const toggleListen = useCallback(() => {
    if (!recognitionRef.current) return;
    if (listening) {
      clearListeningTimer();
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        window.speechSynthesis?.cancel();
        recognitionSuppressedRef.current = false;
        recognitionRef.current.lang = locale;
        recognitionRef.current.start();
        setListening(true);
        clearListeningTimer();
        listeningTimerRef.current = setTimeout(() => {
          recognitionSuppressedRef.current = true;
          try {
            recognitionRef.current?.abort();
          } catch (_) {
            // Recognition may already have ended.
          }
          setListening(false);
          const reminder = "I didn’t hear an answer. Could you please answer again?";
          setMessages((m) => [...m, { role: "assistant", content: reminder }]);
          speakRef.current?.(reminder);
        }, 5000);
      } catch (_) {
        setListening(false);
      }
    }
  }, [listening, locale, clearListeningTimer]);

  // Global helpers
  useEffect(() => {
    window.askERA = (prompt, options = {}) => {
      setFloatingOpen(true);
      setTimeout(() => sendMessage(prompt, options), 200);
    };
    window.eraGreet = (text) => {
      setFloatingOpen(true);
      greetLocal(text);
    };
    window.eraGuideQuestion = (questionnaireContext, isFirstQuestion = false) => {
      setFloatingOpen(true);
      const options = questionnaireContext.options
        .map((option) => `${option.value}. ${option.label}`)
        .join("\n");
      const prompt = isFirstQuestion
        ? `Briefly introduce yourself as Era, explain that you will listen and select answers on screen, then ask the current question naturally.\n\nAvailable choices:\n${options}`
        : `Ask the current on-screen question naturally and invite the customer to answer in their own words.\n\nAvailable choices:\n${options}`;
      setTimeout(
        () => sendMessage(prompt, { displayUser: false, questionnaireContext }),
        200,
      );
    };
    window.eraMoveOn = () => {
      pendingActionRef.current = null;
      clearListeningTimer();
      recognitionSuppressedRef.current = true;
      try {
        recognitionRef.current?.abort();
      } catch (_) {
        // Recognition may already be stopped.
      }
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
      window.speechSynthesis?.cancel();
      setListening(false);
      setSpeaking(false);
      setStreaming(false);
    };
    return () => {
      delete window.askERA;
      delete window.eraGreet;
      delete window.eraGuideQuestion;
      delete window.eraMoveOn;
    };
  }, [sendMessage, greetLocal, clearListeningTimer]);

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
