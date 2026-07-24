import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchQuestions, submitQuestionnaire } from "../lib/api";
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, HelpCircle, Sparkles, ArrowRight, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../lib/language";

const HORIZON_COLORS = {
  "Short-term": "#F59E0B",
  "Medium-term": "#007AFF",
  "Long-term": "#34C759",
};

export default function Objectives() {
  const { t } = useLanguage();
  const [questions, setQuestions] = useState([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [eraStreaming, setEraStreaming] = useState(false);
  const [eraConfirmedQuestion, setEraConfirmedQuestion] = useState(null);
  const [greetedResult, setGreetedResult] = useState(false);
  const startedWithEra = useRef(false);
  const resultSummaryRef = useRef(null);
  const currentQ = questions[step];
  const total = questions.length;
  const progress = total ? ((step + (result ? 1 : 0)) / total) * 100 : 0;

  useEffect(() => {
    fetchQuestions().then((data) => setQuestions(data.questions));
  }, []);

  // Give Era the exact visible choices and let the LLM ask each question.
  useEffect(() => {
    if (!currentQ || result) return undefined;
    const questionnaireContext = {
      question_id: currentQ.id,
      question: currentQ.text,
      options: currentQ.options,
      selected_value: answers[currentQ.id] ?? null,
      step: step + 1,
      total,
    };
    window.eraQuestionnaireContext = questionnaireContext;
    const timer = setTimeout(() => {
      if (typeof window.eraGuideQuestion === "function") {
        window.eraGuideQuestion(questionnaireContext, !startedWithEra.current);
        startedWithEra.current = true;
      }
    }, 700);
    return () => {
      clearTimeout(timer);
      if (window.eraQuestionnaireContext?.question_id === currentQ.id) {
        delete window.eraQuestionnaireContext;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ?.id, result]);

  // Apply Era's recommendation only after the customer explicitly confirms it.
  useEffect(() => {
    if (!currentQ) return undefined;
    const handler = (event) => {
      const action = event.detail;
      if (action?.question_id !== currentQ.id || !action.confirmed) return;
      const matched = currentQ.options.find((option) => option.value === action.value);
      if (!matched) return;
      setAnswers((existing) => ({ ...existing, [currentQ.id]: matched.value }));
      window.eraQuestionnaireContext = {
        ...window.eraQuestionnaireContext,
        selected_value: matched.value,
      };
      toast.success("Era selected an answer", { description: matched.label });
      setEraConfirmedQuestion(currentQ.id);
    };
    window.addEventListener("era-questionnaire-action", handler);
    return () => window.removeEventListener("era-questionnaire-action", handler);
  }, [currentQ]);

  // Continue automatically after the confirmed selection has rendered.
  useEffect(() => {
    if (eraConfirmedQuestion !== currentQ?.id || answers[currentQ.id] === undefined) return;
    const timer = setTimeout(() => {
      setEraConfirmedQuestion(null);
      if (step < total - 1) {
        setStep((value) => value + 1);
        return;
      }
      const submitConfirmedAnswers = async () => {
        setSubmitting(true);
        try {
          const payload = {
            answers: Object.entries(answers).map(([question_id, value]) => ({ question_id, value })),
          };
          const res = await submitQuestionnaire(payload);
          sessionStorage.setItem("eurobank-customer-profile", JSON.stringify(res));
          setResult(res);
          toast.success("Objectives assessment complete", {
            description: `Recommended horizon: ${res.horizon}`,
          });
        } catch (_) {
          toast.error("Could not compute results. Try again.");
        } finally {
          setSubmitting(false);
        }
      };
      submitConfirmedAnswers();
    }, 700);
    return () => clearTimeout(timer);
  }, [eraConfirmedQuestion, answers, currentQ, step, total]);

  // Listen to ERA streaming/speaking status
  useEffect(() => {
    const handler = (e) => setEraStreaming(!!(e.detail?.streaming || e.detail?.speaking));
    window.addEventListener("era-status", handler);
    return () => window.removeEventListener("era-status", handler);
  }, []);

  // Let Era respond to spoken requests to revisit the preceding question.
  useEffect(() => {
    const handler = (event) => {
      if (event.detail?.direction !== "previous" || result) return;
      setEraConfirmedQuestion(null);
      setStep((current) => Math.max(0, current - 1));
    };
    window.addEventListener("era-questionnaire-navigation", handler);
    return () => window.removeEventListener("era-questionnaire-navigation", handler);
  }, [result]);

  // When result arrives, ask ERA to speak a summary once
  useEffect(() => {
    if (result && !greetedResult && typeof window.askERA === "function") {
      setGreetedResult(true);
      const alloc = result.allocation_suggestion
        .map((a) => `${a.asset_class} ${a.allocation_percentage}%`)
        .join(", ");
      const prompt = `${t("era_result_summary_prompt")} Explain this as a final concise summary. Do not ask the customer a question or expect another answer.\n\nAssessment result:\n- Horizon: ${result.horizon}\n- Risk profile: ${result.risk_profile}\n- Score: ${result.total_score}/20\n- Suggested allocation: ${alloc}`;
      window.eraMoveOn?.();
      resultSummaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      // Let the result panel arrive on screen before Era begins the spoken summary.
      setTimeout(() => window.askERA(prompt, { displayUser: false, expectResponse: false }), 900);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const handleSelect = (value) => {
    setAnswers((a) => ({ ...a, [currentQ.id]: value }));
    setEraConfirmedQuestion(currentQ.id);
    setTimeout(() => {
      try {
        window.eraMoveOn?.();
      } catch (_) {
        // The questionnaire handoff must continue even if a browser media API fails.
      }
    }, 0);
  };

  const goNext = async () => {
    if (step < total - 1) {
      setStep((s) => s + 1);
    } else {
      // submit
      setSubmitting(true);
      try {
        const payload = {
          answers: Object.entries(answers).map(([question_id, value]) => ({ question_id, value })),
        };
        const res = await submitQuestionnaire(payload);
        sessionStorage.setItem("eurobank-customer-profile", JSON.stringify(res));
        setResult(res);
        toast.success("Objectives assessment complete", {
          description: `Recommended horizon: ${res.horizon}`,
        });
      } catch (e) {
        toast.error("Could not compute results. Try again.");
      } finally {
        setSubmitting(false);
      }
    }
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));
  const restart = () => {
    setAnswers({});
    setStep(0);
    setResult(null);
  };

  if (!questions.length) {
    return <div className="p-10 text-[var(--text-secondary)]">Loading assessment…</div>;
  }

  if (result) {
    return (
      <div className="p-6 md:p-10 fade-up" data-testid="objectives-result-page">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border border-[var(--border)] rounded-2xl p-8 md:p-12">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle2 className="text-[var(--success)]" size={28} />
              <div className="text-xs tracking-[0.2em] uppercase text-[var(--text-secondary)]">
                Assessment complete
              </div>
              {eraStreaming && (
                <span
                  data-testid="era-result-status"
                  className="ml-auto inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-semibold"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]" />
                  </span>
                  {t("era_status_summary")}
                </span>
              )}
            </div>
            <h2
              ref={resultSummaryRef}
              className="scroll-mt-6 font-display font-black text-3xl md:text-4xl text-[var(--primary)] mb-2"
            >
              Your recommended horizon
            </h2>
            <div
              data-testid="result-horizon"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white font-semibold text-lg mt-4 mb-8"
              style={{ background: HORIZON_COLORS[result.horizon] }}
            >
              {result.horizon}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <div className="rounded-xl border border-[var(--border)] p-4">
                <div className="text-xs tracking-[0.15em] uppercase text-[var(--text-secondary)]">Score</div>
                <div className="font-display font-black text-3xl text-[var(--primary)] font-mono-num mt-1">
                  {result.total_score}/20
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-4">
                <div className="text-xs tracking-[0.15em] uppercase text-[var(--text-secondary)]">Risk Profile</div>
                <div className="font-display font-bold text-xl text-[var(--primary)] mt-1">
                  {result.risk_profile}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border)] p-4 col-span-2 md:col-span-1">
                <div className="text-xs tracking-[0.15em] uppercase text-[var(--text-secondary)]">Questions</div>
                <div className="font-display font-bold text-xl text-[var(--primary)] mt-1">
                  {total} answered
                </div>
              </div>
            </div>

            <p className="text-[var(--text-secondary)] leading-relaxed mb-8">{result.recommendation}</p>

            <div
              data-testid="product-recommendation-banner"
              className="mb-8 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-[#174a72] p-6 text-white flex flex-col md:flex-row md:items-center gap-5"
            >
              <div className="h-12 w-12 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                <ShoppingBag size={22} />
              </div>
              <div className="flex-1">
                <div className="text-xs tracking-[0.16em] uppercase text-white/70 mb-1">
                  Personalised product shortlist
                </div>
                <h3 className="font-display font-bold text-xl">
                  Explore products suited to your {result.risk_profile.toLowerCase()} profile
                </h3>
                <p className="text-sm text-white/75 mt-1">
                  See investment options aligned with your {result.horizon.toLowerCase()} horizon and financial objectives.
                </p>
              </div>
              <Link
                to={`/products?recommended=true&risk=${encodeURIComponent(result.risk_profile)}&horizon=${encodeURIComponent(result.horizon)}&profile=${encodeURIComponent(result.profile_id)}`}
                data-testid="view-recommended-products"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white text-[var(--primary)] text-sm font-bold hover:bg-white/90 transition-colors whitespace-nowrap"
              >
                View recommended products <ArrowRight size={16} />
              </Link>
            </div>

            <div className="border-t border-[var(--border)] pt-6">
              <div className="text-xs tracking-[0.15em] uppercase text-[var(--text-secondary)] mb-3">
                Suggested allocation
              </div>
              <div className="space-y-3">
                {result.allocation_suggestion.map((a) => (
                  <div key={a.asset_class} data-testid={`alloc-${a.asset_class}`}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[var(--primary)] font-medium">{a.asset_class}</span>
                      <span className="font-mono-num text-[var(--text-secondary)]">{a.allocation_percentage}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${a.allocation_percentage}%`,
                          background: `linear-gradient(90deg, ${HORIZON_COLORS[result.horizon]}, #007AFF)`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={restart}
              data-testid="restart-questionnaire-btn"
              className="mt-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--border)] text-sm font-medium text-[var(--primary)] hover:bg-gray-50 transition-colors"
            >
              <RotateCcw size={14} /> Retake assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selected = answers[currentQ.id];

  return (
    <div className="p-6 md:p-10 fade-up" data-testid="objectives-page">
      <div className="max-w-3xl mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-2">
            <span className="tracking-[0.15em] uppercase">
              Step {step + 1} of {total}
            </span>
            <span className="font-mono-num">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-[var(--border)] rounded-2xl p-8 md:p-12">
          <div className="text-xs tracking-[0.2em] uppercase text-[var(--text-secondary)] mb-3">
            Financial Objectives
          </div>
          <div className="flex items-start justify-between gap-4">
            <h2
              data-testid="question-text"
              className="font-display font-black text-3xl md:text-4xl text-[var(--primary)] mb-2 leading-tight"
            >
              {currentQ.text}
            </h2>
          </div>

          {/* Ask Aria to help */}
          <div className="flex flex-wrap items-center gap-2 mb-8">
            <button
              type="button"
              data-testid="explain-question-btn"
              onClick={() => {
                const optList = currentQ.options.map((o) => `- "${o.label}"`).join("\n");
                const prompt = `I'm on the "Financial Objectives" questionnaire. Please explain this question in plain, friendly language for a European retail investor, and tell me what each answer choice implies so I can pick the one that best fits me.\n\nQuestion: ${currentQ.text}\n\nAnswer choices:\n${optList}`;
                if (typeof window.askERA === "function") {
                  window.askERA(prompt);
                } else {
                  toast.info("ERA is loading, please try again in a moment.");
                }
              }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-semibold hover:bg-[var(--accent)]/20 transition-colors"
            >
              <HelpCircle size={13} /> {t("ask_era_explain")}
            </button>
            <button
              type="button"
              data-testid="help-me-answer-btn"
              onClick={() => {
                const optList = currentQ.options.map((o) => `- "${o.label}"`).join("\n");
                const prompt = `I'm not sure which answer to pick for this questionnaire question. Ask me one or two short, friendly questions to figure out my situation, then recommend which of the choices fits me best.\n\nQuestion: ${currentQ.text}\n\nAnswer choices:\n${optList}`;
                if (typeof window.askERA === "function") {
                  window.askERA(prompt);
                }
              }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--border)] bg-white text-[var(--primary)] text-xs font-semibold hover:bg-gray-50 transition-colors"
            >
              <Sparkles size={13} /> {t("help_me_answer")}
            </button>
            {eraStreaming && (
              <span
                data-testid="era-status-badge"
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--success)]/10 text-[var(--success)] text-xs font-semibold"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
                </span>
                {t("era_status_helping")}
              </span>
            )}
          </div>

          <div className="space-y-3">
            {currentQ.options.map((opt) => {
              const isSelected = selected === opt.value;
              return (
                <button
                  key={opt.value}
                  data-testid={`option-${currentQ.id}-${opt.value}`}
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all duration-150 flex items-center justify-between ${
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent)]/5"
                      : "border-[var(--border)] bg-white hover:border-gray-300"
                  }`}
                >
                  <span
                    className={`font-medium ${
                      isSelected ? "text-[var(--primary)]" : "text-[var(--text-primary)]"
                    }`}
                  >
                    {opt.label}
                  </span>
                  <span
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected ? "border-[var(--accent)] bg-[var(--accent)]" : "border-gray-300"
                    }`}
                  >
                    {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-10">
            <button
              onClick={goBack}
              disabled={step === 0}
              data-testid="prev-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--border)] text-sm font-medium text-[var(--primary)] hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={goNext}
              disabled={selected === undefined || submitting}
              data-testid="next-btn"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--accent)] transition-colors disabled:opacity-40"
            >
              {step === total - 1 ? (submitting ? "Computing…" : "See results") : "Continue"}
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
