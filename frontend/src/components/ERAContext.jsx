import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API } from "../lib/api";
import { useLanguage } from "../lib/language";
import { useEraVoice } from "./EraVoiceContext";

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
  const {
    configured: openAIVoiceConfigured,
    playText: playOpenAIVoice,
    primeAudio,
    stop: stopOpenAIVoice,
  } = useEraVoice();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([{ role: "assistant", content: t("era_intro") }]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [floatingOpen, setFloatingOpen] = useState(false);
  const recognitionRef = useRef(null);
  const recognitionSuppressedRef = useRef(false);
  const shouldKeepListeningRef = useRef(false);
  const listeningTimerRef = useRef(null);
  const activeRequestRef = useRef(null);
  const speakRef = useRef(null);
  const pendingActionRef = useRef(null);
  const queuedInputRef = useRef(null);
  const sendMessageRef = useRef(null);
  const confirmPendingActionRef = useRef(null);
  const streamingRef = useRef(false);
  const previousPathRef = useRef(location.pathname);
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

  const cancelSpeechOutput = useCallback(() => {
    window.speechSynthesis?.cancel();
    stopOpenAIVoice();
  }, [stopOpenAIVoice]);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((enabled) => {
      if (enabled) {
        cancelSpeechOutput();
        setSpeaking(false);
      }
      return !enabled;
    });
  }, [cancelSpeechOutput]);

  // Leaving Objectives or Products must terminate that page's conversation completely.
  useEffect(() => {
    const previousPath = previousPathRef.current;
    previousPathRef.current = location.pathname;
    const contextualPages = ["/objectives", "/products"];
    if (!contextualPages.includes(previousPath) || location.pathname === previousPath) return;

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
    cancelSpeechOutput();
    delete window.eraQuestionnaireContext;
    setInput("");
    setListening(false);
    setSpeaking(false);
    setStreaming(false);
    setMessages([{ role: "assistant", content: t("era_intro") }]);
  }, [location.pathname, clearListeningTimer, cancelSpeechOutput, t]);

  const isConfirmation = useCallback((text) => {
    const normalized = text
      .toLowerCase()
      .trim()
      .replace(/[’']/g, "'")
      .replace(/[.,!?;:]/g, "")
      .replace(/\s+/g, " ");
    if (/\b(no|not|don't|do not|wait|stop)\b/i.test(normalized)) return false;
    // When an option is already pending, natural follow-on wording after an
    // affirmative is still confirmation: "yeah ok", "yes do that selection",
    // "okay please continue", etc.
    if (
      /^(yes|yeah|yep|yup|ok|okay|sure|correct|absolutely|affirmative|certainly|confirm|confirmed|proceed)\b/i.test(
        normalized,
      )
    ) {
      return true;
    }
    return (
      /^(?:uh|um|well)?\s*(yes|yes pleas|yeah|yep|yup|sure|okay|ok|correct|absolutely|affirmative|of course|certainly|ja|oui|sí|si|certo)(\s+(please|thank you|thanks|thankyou))?$/i.test(normalized) ||
      /^(please\s+)?(confirm|confirmed|go ahead|continue|select it|choose it|do it|please do|proceed)(\s+(please|thank you|thanks))?$/i.test(normalized) ||
      /^(i confirm|i agree|you can select it|that's right|that is right|sounds good|va bene)(\s+(please|thank you|thanks))?$/i.test(normalized)
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
      if (!voiceEnabled) {
        options.onComplete?.();
        return;
      }
      const listenAfter = options.listenAfter !== false;
      const onComplete = options.onComplete;

      clearListeningTimer();
      // Never let speech recognition capture Era's own voice or a stale final transcript.
      recognitionSuppressedRef.current = true;
      shouldKeepListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {
          // Recognition may already be stopped.
        }
      }
      setListening(false);
      cancelSpeechOutput();
      const spokenText = text
        .replace(/[*_#`]/g, "")
        .replace(/\bERA\b/g, "Era")
        .replace(/\s+/g, " ")
        .trim();

      const finishSpeaking = () => {
        setSpeaking(false);
        if (!listenAfter) {
          recognitionSuppressedRef.current = true;
          setListening(false);
          onComplete?.();
          return;
        }
        onComplete?.();
        // Behave like a call assistant: after Era finishes, listen for the customer's reply.
        setTimeout(() => {
          const rec = recognitionRef.current;
          if (!rec || streamingRef.current) return;
          try {
            recognitionSuppressedRef.current = false;
            shouldKeepListeningRef.current = true;
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

      const speakWithBrowserVoice = () => {
        if (!window.speechSynthesis) {
          finishSpeaking();
          return;
        }
        const utter = new SpeechSynthesisUtterance(spokenText);
        utter.lang = locale;
        const match = selectBestVoice(window.speechSynthesis.getVoices(), locale);
        if (match) utter.voice = match;
        utter.rate = 0.94;
        utter.pitch = 1.06;
        utter.volume = 1;
        utter.onstart = () => setSpeaking(true);
        utter.onend = finishSpeaking;
        utter.onerror = () => {
          recognitionSuppressedRef.current = false;
          setSpeaking(false);
        };
        window.speechSynthesis.speak(utter);
      };

      const speakWithAvailableBrowserVoice = () => {
        if (window.speechSynthesis?.getVoices().length) {
          speakWithBrowserVoice();
          return;
        }
        // Chromium may populate system voices asynchronously on the first request.
        let hasSpoken = false;
        const speakOnce = () => {
          if (hasSpoken) return;
          hasSpoken = true;
          speakWithBrowserVoice();
        };
        const handleVoicesChanged = () => {
          window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
          speakOnce();
        };
        window.speechSynthesis?.addEventListener("voiceschanged", handleVoicesChanged, { once: true });
        setTimeout(() => {
          window.speechSynthesis?.removeEventListener("voiceschanged", handleVoicesChanged);
          speakOnce();
        }, 500);
      };

      if (openAIVoiceConfigured !== false) {
        let openAIVoiceStarted = false;
        playOpenAIVoice(spokenText, {
          onStart: () => {
            openAIVoiceStarted = true;
            setSpeaking(true);
          },
        })
          .then(finishSpeaking)
          .catch(() => {
            setSpeaking(false);
            if (!openAIVoiceStarted) speakWithAvailableBrowserVoice();
          });
        return;
      }
      speakWithAvailableBrowserVoice();
    },
    [
      voiceEnabled,
      locale,
      clearListeningTimer,
      cancelSpeechOutput,
      openAIVoiceConfigured,
      playOpenAIVoice,
    ],
  );
  speakRef.current = speak;

  const confirmPendingAction = useCallback(
    (text, displayUser = true) => {
      if (!pendingActionRef.current || !isConfirmation(text)) return false;
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      queuedInputRef.current = null;
      clearListeningTimer();
      recognitionSuppressedRef.current = true;
      shouldKeepListeningRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch (_) {
        // Recognition may already have completed.
      }
      setListening(false);
      setInput("");
      const confirmation = `Perfect. I’ll select “${action.label}” and continue.`;
      setMessages((m) => [
        ...m,
        ...(displayUser ? [{ role: "user", content: text }] : []),
        { role: "assistant", content: confirmation },
      ]);
      setTimeout(
        () =>
          speak(confirmation, {
            listenAfter: false,
            onComplete: () => {
              window.dispatchEvent(
                new CustomEvent("era-questionnaire-action", {
                  detail: { ...action, confirmed: true },
                }),
              );
            },
          }),
        150,
      );
      return true;
    },
    [isConfirmation, clearListeningTimer, speak],
  );
  confirmPendingActionRef.current = confirmPendingAction;

  const sendMessage = useCallback(
    async (msgText, options = {}) => {
      const text = (msgText ?? "").trim();
      if (!text) return;
      if (streaming) {
        // A short voice reply can arrive during the final milliseconds of Era's response.
        // Preserve it instead of silently discarding an affirmative confirmation.
        queuedInputRef.current = { text, options };
        return;
      }
      const displayUser = options.displayUser !== false;
      const expectResponse = options.expectResponse !== false;
      const baseQuestionnaireContext =
        options.questionnaireContext || window.eraQuestionnaireContext || null;
      const normalizedCommand = text.toLowerCase().trim().replace(/[.,!?]/g, "");

      // A customer may state the visible choice in a natural sentence, for
      // example: "I want to generate steady income." That is a complete
      // answer and should not need a second confirmation.
      const normalizeOptionText = (value) =>
        String(value || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim()
          .replace(/\s+/g, " ");
      const normalizedAnswer = normalizeOptionText(text);
      const hasNegativeIntent = /\b(no|not|don't|do not|wait|stop)\b/i.test(text);
      const directOption = baseQuestionnaireContext?.options?.find((option) => {
        const optionLabel = normalizeOptionText(option.label);
        const answerWithoutLeadIn = normalizedAnswer
          .replace(
            /^(?:i want to|i want|my goal is|i would like to|i would like|please select|select|choose|go with|i prefer)\s+/,
            "",
          )
          .replace(/\s+(?:please|thanks|thank you)$/i, "")
          .trim();
        return answerWithoutLeadIn === optionLabel;
      });
      const combinedAffirmative =
        /\b(yes|yeah|yep|yup|ok|okay|sure|correct|confirm|confirmed|proceed)\b/i.test(normalizedAnswer) &&
        !hasNegativeIntent;
      const affirmedOption = directOption || (combinedAffirmative
        ? baseQuestionnaireContext?.options?.find((option) =>
            normalizedAnswer.includes(normalizeOptionText(option.label)),
          )
        : null);

      if (affirmedOption && !hasNegativeIntent && baseQuestionnaireContext?.question_id) {
        clearListeningTimer();
        recognitionSuppressedRef.current = true;
        shouldKeepListeningRef.current = false;
        try {
          recognitionRef.current?.abort();
        } catch (_) {
          // Recognition may already have completed.
        }
        pendingActionRef.current = null;
        setInput("");
        setListening(false);
        const reply = "Understood. I’ll continue.";
        setMessages((m) => [
          ...m,
          ...(displayUser ? [{ role: "user", content: text }] : []),
          { role: "assistant", content: reply },
        ]);
        const action = {
          question_id: baseQuestionnaireContext.question_id,
          value: affirmedOption.value,
          label: affirmedOption.label,
          confidence: "high",
          confirmed: true,
          exact_match: true,
        };
        setTimeout(
          () =>
            speak(reply, {
              listenAfter: false,
              onComplete: () =>
                window.dispatchEvent(
                  new CustomEvent("era-questionnaire-action", { detail: action }),
                ),
            }),
          100,
        );
        return;
      }

      const runLocalCommand = (reply, action) => {
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
        cancelSpeechOutput();
        setInput("");
        setListening(false);
        setSpeaking(false);
        setStreaming(false);
        setMessages((m) => [
          ...m,
          ...(displayUser ? [{ role: "user", content: text }] : []),
          { role: "assistant", content: reply },
        ]);
        action();
        setTimeout(() => speak(reply, { listenAfter: false }), 150);
      };

      const endConversation = () => {
        const reply =
          "Thank you for your time. I’ll take you back to your portfolio now. If you need anything else, just ask me anytime.";
        pendingActionRef.current = null;
        queuedInputRef.current = null;
        clearListeningTimer();
        recognitionSuppressedRef.current = true;
        shouldKeepListeningRef.current = false;
        try {
          recognitionRef.current?.abort();
        } catch (_) {
          // Recognition may already be stopped.
        }
        activeRequestRef.current?.abort();
        activeRequestRef.current = null;
        cancelSpeechOutput();
        setInput("");
        setListening(false);
        setSpeaking(false);
        setStreaming(false);
        setMessages((m) => [
          ...m,
          ...(displayUser ? [{ role: "user", content: text }] : []),
          { role: "assistant", content: reply },
        ]);
        setTimeout(
          () =>
            speak(reply, {
              listenAfter: false,
              onComplete: () => navigate("/"),
            }),
          150,
        );
      };

      if (
        /\b(?:i want to|i would like to|let me|please)?\s*(?:stop|end|quit|leave|exit|finish)\b.*\b(?:the )?(?:conversation|chat|talking|speaking|this)\b/i.test(
          normalizedCommand,
        ) ||
        /\b(?:i(?:'m| am) (?:done|finished)|no more questions|that(?:'s| is) all)\b/i.test(
          normalizedCommand,
        )
      ) {
        endConversation();
        return;
      }

      if (
        /\b(go|come|move|take me|return)\b.*\b(back|previous|last)\b|\b(previous|last)\s+question\b|\bgo back\b/i.test(
          normalizedCommand,
        ) &&
        baseQuestionnaireContext
      ) {
        if ((baseQuestionnaireContext.step || 1) <= 1) {
          runLocalCommand("We’re already on the first question.", () => {});
        } else {
          runLocalCommand("Of course. Let’s go back to the previous question.", () => {
            window.dispatchEvent(
              new CustomEvent("era-questionnaire-navigation", {
                detail: { direction: "previous" },
              }),
            );
          });
        }
        return;
      }

      if (/\b(go|open|show|visit|move|take me)\b.*\bobjectives?\b/i.test(normalizedCommand)) {
        runLocalCommand("Of course. I’ll take you to your financial objectives.", () =>
          navigate("/objectives"),
        );
        return;
      }

      if (/\b(go|open|show|visit|move|take me)\b.*\bproducts?\b/i.test(normalizedCommand)) {
        runLocalCommand("Certainly. Let’s look at the available investment products.", () =>
          navigate("/products"),
        );
        return;
      }

      if (confirmPendingAction(text, displayUser)) return;

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
        let confirmedAction = null;

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
                confirmedAction = payload;
              } else {
                // Keep inferred recommendations pending until the customer explicitly confirms.
                pendingActionRef.current = payload;
              }
            } else if (eventType === "error") {
              throw new Error(payload.message || "Error contacting Era.");
            }
          }
        }
        if (
          pendingActionRef.current &&
          /\b(confirmed|i(?:'|’)ll select|selected|selection confirmed)\b/i.test(full)
        ) {
          const pendingLabel = pendingActionRef.current.label;
          full = `I recommend “${pendingLabel}.” Would you like me to select it and continue?`;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: full };
            return copy;
          });
        }
        if (full) {
          speak(full, {
            listenAfter: confirmedAction ? false : expectResponse,
            onComplete: confirmedAction
              ? () =>
                  window.dispatchEvent(
                    new CustomEvent("era-questionnaire-action", { detail: confirmedAction }),
                  )
              : undefined,
          });
        } else if (confirmedAction) {
          window.dispatchEvent(
            new CustomEvent("era-questionnaire-action", { detail: confirmedAction }),
          );
        }
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
          const queued = queuedInputRef.current;
          queuedInputRef.current = null;
          if (queued) {
            setTimeout(() => sendMessageRef.current?.(queued.text, queued.options), 100);
          }
        }
      }
    },
    [
      streaming,
      sessionId,
      langLabel,
      speak,
      isRejection,
      clearListeningTimer,
      cancelSpeechOutput,
      navigate,
      confirmPendingAction,
    ],
  );
  sendMessageRef.current = sendMessage;

  const greetLocal = useCallback(
    (text) => {
      setMessages((m) => [...m, { role: "assistant", content: text }]);
      setTimeout(() => speak(text), 300);
    },
    [speak],
  );

  // Setup SpeechRecognition once per locale. Some Chromium implementations end
  // a recognition session after a brief silence; keep the session alive while
  // Era is awaiting a reply instead of leaving the customer stranded.
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = locale;
    // The five-second guard is only for initial silence. Once the customer
    // starts talking, let the browser listen until their utterance finishes.
    rec.onspeechstart = () => {
      clearListeningTimer();
      setListening(true);
    };
    rec.onresult = (e) => {
      if (recognitionSuppressedRef.current) return;
      clearListeningTimer();
      const text = e.results[0][0].transcript;
      shouldKeepListeningRef.current = false;
      setInput(text);
      setListening(false);
      if (confirmPendingActionRef.current?.(text, true)) return;
      setTimeout(() => sendMessageRef.current?.(text), 200);
    };
    rec.onend = () => {
      setListening(false);
      if (
        !shouldKeepListeningRef.current ||
        recognitionSuppressedRef.current ||
        streamingRef.current
      ) {
        return;
      }
      // Reopen after Chromium closes a no-speech session. The existing
      // five-second timer remains active, so Era still asks again if nobody replies.
      setTimeout(() => {
        if (
          recognitionRef.current !== rec ||
          !shouldKeepListeningRef.current ||
          recognitionSuppressedRef.current ||
          streamingRef.current
        ) {
          return;
        }
        try {
          rec.lang = locale;
          rec.start();
          setListening(true);
        } catch (_) {
          // A replacement recognition session may already be starting.
        }
      }, 180);
    };
    rec.onerror = () => {
      setListening(false);
    };
    recognitionRef.current = rec;
    return () => {
      if (recognitionRef.current === rec) recognitionRef.current = null;
      shouldKeepListeningRef.current = false;
      try {
        rec.abort();
      } catch (_) {
        // Recognition may already have ended.
      }
    };
  }, [locale, clearListeningTimer]);

  // Unlock browser speech output on the first user interaction.
  useEffect(() => {
    const unlockSpeech = () => {
      primeAudio();
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
  }, [primeAudio]);

  const toggleListen = useCallback(() => {
    if (!recognitionRef.current) return;
    if (listening) {
      clearListeningTimer();
      shouldKeepListeningRef.current = false;
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        cancelSpeechOutput();
        recognitionSuppressedRef.current = false;
        shouldKeepListeningRef.current = true;
        recognitionRef.current.lang = locale;
        recognitionRef.current.start();
        setListening(true);
        clearListeningTimer();
        listeningTimerRef.current = setTimeout(() => {
          recognitionSuppressedRef.current = true;
          shouldKeepListeningRef.current = false;
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
  }, [listening, locale, clearListeningTimer, cancelSpeechOutput]);

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
      if (isFirstQuestion) {
        // The Objectives greeting already introduces Era. Replace the generic
        // panel welcome instead of showing two near-identical introductions.
        setMessages([]);
      }
      const options = questionnaireContext.options
        .map((option) => `${option.value}. ${option.label}`)
        .join("\n");
      const prompt = isFirstQuestion
        ? `Introduce yourself warmly as Era, the customer's Relationship Manager. Say that you are here to understand their needs and help them make choices that fit their financial goals. Then ask the current question naturally. Do not mention proposing, matching, selecting, or changing anything on screen.\n\nAvailable choices:\n${options}`
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
      shouldKeepListeningRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch (_) {
        // Recognition may already be stopped.
      }
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
      cancelSpeechOutput();
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
  }, [sendMessage, greetLocal, clearListeningTimer, cancelSpeechOutput]);

  const value = {
    messages,
    input,
    setInput,
    listening,
    speaking,
    streaming,
    voiceEnabled,
    setVoiceEnabled,
    toggleVoice,
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
