import { useEffect, useState } from "react";
import { fetchQuestions, submitQuestionnaire } from "../lib/api";
import { API } from "../lib/api";
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, Download } from "lucide-react";
import { toast } from "sonner";

const HORIZON_COLORS = {
  "Short-term": "#F59E0B",
  "Medium-term": "#007AFF",
  "Long-term": "#34C759",
};

export default function Objectives() {
  const [questions, setQuestions] = useState([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQuestions().then((data) => setQuestions(data.questions));
  }, []);

  const currentQ = questions[step];
  const total = questions.length;
  const progress = total ? ((step + (result ? 1 : 0)) / total) * 100 : 0;

  const handleSelect = (value) => {
    setAnswers((a) => ({ ...a, [currentQ.id]: value }));
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
            </div>
            <h2 className="font-display font-black text-3xl md:text-4xl text-[var(--primary)] mb-2">
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

            <div className="border-t border-[var(--border)] pt-6">
              <div className="text-xs tracking-[0.15em] uppercase text-[var(--text-secondary)] mb-3">
                Suggested allocation
              </div>
              <div className="space-y-3">
                {result.allocation_suggestion.map((a) => (
                  <div key={a.category} data-testid={`alloc-${a.category}`}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[var(--primary)] font-medium">{a.category}</span>
                      <span className="font-mono-num text-[var(--text-secondary)]">{a.percentage}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${a.percentage}%`,
                          background: `linear-gradient(90deg, ${HORIZON_COLORS[result.horizon]}, #007AFF)`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-8">
              {result.submission_id && (
                <button
                  data-testid="download-suitability-btn"
                  onClick={async () => {
                    try {
                      const res = await fetch(
                        `${API}/questionnaire/suitability/${result.submission_id}`,
                      );
                      if (!res.ok) throw new Error("Download failed");
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `suitability-${result.submission_id.slice(0, 8)}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                      toast.success("MiFID II Suitability Statement downloaded");
                    } catch (e) {
                      toast.error("Could not download PDF");
                    }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[var(--accent)] transition-colors"
                >
                  <Download size={14} /> Download MiFID II Statement
                </button>
              )}
              <button
                onClick={restart}
                data-testid="restart-questionnaire-btn"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--border)] text-sm font-medium text-[var(--primary)] hover:bg-gray-50 transition-colors"
              >
                <RotateCcw size={14} /> Retake assessment
              </button>
            </div>
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
          <h2
            data-testid="question-text"
            className="font-display font-black text-3xl md:text-4xl text-[var(--primary)] mb-8 leading-tight"
          >
            {currentQ.text}
          </h2>

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
