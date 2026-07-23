import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Lightbulb, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { fetchContextualInsight, tradeHolding } from "../lib/api";
import { toast } from "sonner";

const readStoredProduct = () => {
  try {
    return JSON.parse(sessionStorage.getItem("eurobank-selected-product") || "null");
  } catch (_) {
    return null;
  }
};

const readCustomerProfile = () => {
  try {
    return JSON.parse(sessionStorage.getItem("eurobank-customer-profile") || "null");
  } catch (_) {
    return null;
  }
};

const normalizeRisk = (risk) => {
  const value = String(risk || "Balanced").toLowerCase();
  if (value.includes("conservative") || value.includes("low")) return "LOW";
  if (value.includes("aggressive") || value.includes("high")) return "HIGH";
  return "MEDIUM";
};

const ContextualInsightBanner = ({ insight, loading, error }) => (
  <section
    data-testid="contextual-insight-banner"
    className="mb-6 rounded-2xl border border-[var(--accent)]/30 bg-gradient-to-r from-[#F7FBFF] to-white p-5 md:p-6"
  >
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-white p-2.5 text-[var(--accent)] shadow-sm">
          {loading ? <LoaderCircle size={20} className="animate-spin" /> : <Lightbulb size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
            Contextual investment insight
          </div>
          {loading && (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Reviewing this order against your profile, portfolio positions and current market context…
            </p>
          )}
          {!loading && insight && (
            <div className="mt-2 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div>
                <p className="text-base font-semibold leading-7 text-[var(--primary)]">{insight.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-[var(--primary)] px-3 py-1.5 text-white">
                    {insight.recommendation?.replaceAll("_", " ")}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1.5 text-[var(--primary)]">
                    {insight.customerSuitability?.replaceAll("_", " ")}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white px-3 py-2">
                  <div className="text-lg font-black text-[var(--primary)]">{insight.confidence}%</div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">Confidence</div>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <div className="text-sm font-black text-[var(--primary)]">{insight.riskLevel}</div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">Risk</div>
                </div>
                <div className="rounded-xl bg-white px-3 py-2">
                  <div className="text-sm font-black text-[var(--primary)]">
                    {insight.marketSentiment?.replaceAll("_", " ")}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">Sentiment</div>
                </div>
              </div>
            </div>
          )}
          {!loading && error && <p className="mt-2 text-sm text-[var(--text-secondary)]">{error}</p>}
        </div>
      </div>

      {!loading && insight && (
        <>
          <div className="grid gap-4 md:grid-cols-2 text-sm text-[var(--text-secondary)]">
            <div className="rounded-xl border border-[var(--success)]/15 bg-white p-4">
              <div className="flex items-center gap-2 font-bold text-[var(--success)]">
                <CheckCircle2 size={16} /> Positive factors
              </div>
              <ul className="mt-2 grid gap-1.5 list-disc pl-5">
                {insight.positiveFactors?.map((factor) => <li key={factor}>{factor}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-[#B45309]/15 bg-white p-4">
              <div className="flex items-center gap-2 font-bold text-[#B45309]">
                <AlertTriangle size={16} /> Risks to consider
              </div>
              <ul className="mt-2 grid gap-1.5 list-disc pl-5">
                {insight.negativeFactors?.map((factor) => <li key={factor}>{factor}</li>)}
              </ul>
            </div>
          </div>
          {insight.alternatives?.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--primary)]">Possible alternatives</div>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                {insight.alternatives.map((alternative) => (
                  <div key={`${alternative.category}-${alternative.reason}`} className="rounded-xl bg-white px-4 py-3 text-xs leading-5 text-[var(--text-secondary)]">
                    <span className="font-bold text-[var(--primary)]">{alternative.category}</span>
                    <span className="block">{alternative.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  </section>
);

const formatMoney = (value, currency = "EUR") =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

export default function Order() {
  const location = useLocation();
  const navigate = useNavigate();
  const product = location.state?.product || readStoredProduct();
  const [orderType, setOrderType] = useState("Market");
  const [quantity, setQuantity] = useState(1);
  const [limitPrice, setLimitPrice] = useState(product?.price || product?.current_price || 0);
  const [accepted, setAccepted] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState("");
  const customerAssessment = readCustomerProfile();

  const marketPrice = Number(product?.price || product?.current_price || 0);
  const executionPrice = orderType === "Limit" ? Number(limitPrice) || 0 : marketPrice;
  const estimatedTotal = useMemo(
    () => Math.max(0, Number(quantity) || 0) * executionPrice,
    [quantity, executionPrice],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [product?.id, product?.product_id, product?.ticker]);

  useEffect(() => {
    if (!product || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0) {
      setInsight(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setInsightLoading(true);
      setInsightError("");
      try {
        const result = await fetchContextualInsight({
          customerProfile: {
            riskAppetite: normalizeRisk(customerAssessment?.risk_profile || product.risk || product.risk_level),
            knowledge: customerAssessment?.knowledge || "INTERMEDIATE",
            experience: customerAssessment?.experience || "1-3 Years",
            esgPreference: customerAssessment?.esg_preference || "NO",
          },
          order: {
            instrumentId: product.product_id || product.id || product.ticker,
            instrumentSymbol: product.finnhub_symbol || product.ticker,
            instrumentName: product.name,
            action: "BUY",
            quantity: Number(quantity),
          },
        });
        if (!cancelled) setInsight(result);
      } catch (error) {
        if (!cancelled) {
          setInsight(null);
          setInsightError(error.response?.data?.detail || "Insight is currently unavailable.");
        }
      } finally {
        if (!cancelled) setInsightLoading(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [product, quantity, customerAssessment?.risk_profile, customerAssessment?.knowledge, customerAssessment?.experience, customerAssessment?.esg_preference]);

  if (!product) {
    return (
      <div className="p-6 md:p-10 fade-up" data-testid="order-empty">
        <div className="max-w-xl mx-auto rounded-2xl border border-[var(--border)] bg-white p-8 text-center">
          <h2 className="font-display font-black text-2xl text-[var(--primary)]">Choose a product first</h2>
          <p className="text-[var(--text-secondary)] mt-2">Select a product before creating an order.</p>
          <button
            onClick={() => navigate("/products")}
            className="mt-6 px-5 py-2.5 rounded-full bg-[var(--primary)] text-white font-semibold"
          >
            Browse products
          </button>
        </div>
      </div>
    );
  }

  if (placedOrder) {
    return (
      <div className="p-6 md:p-10 fade-up" data-testid="order-success">
        <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--border)] bg-white p-8 md:p-12 text-center">
          <CheckCircle2 size={52} className="mx-auto text-[var(--success)]" />
          <div className="text-xs tracking-[0.18em] uppercase text-[var(--success)] font-semibold mt-5">
            Order received
          </div>
          <h2 className="font-display font-black text-3xl text-[var(--primary)] mt-2">
            Your order is ready for processing
          </h2>
          <p className="text-[var(--text-secondary)] mt-3">
            {quantity} × {product.ticker} · {formatMoney(estimatedTotal, product.currency)}
          </p>
          <div className="mt-6 inline-flex px-4 py-2 rounded-full bg-gray-50 border border-[var(--border)] font-mono-num text-sm">
            Reference {placedOrder}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate("/products")}
              className="px-5 py-2.5 rounded-full border border-[var(--border)] text-[var(--primary)] font-semibold"
            >
              Back to products
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-5 py-2.5 rounded-full bg-[var(--primary)] text-white font-semibold"
            >
              Portfolio overview
            </button>
          </div>
        </div>
      </div>
    );
  }

  const submitOrder = async (event) => {
    event.preventDefault();
    if (!accepted || quantity <= 0 || estimatedTotal <= 0) return;
    setSubmitting(true);
    try {
      await tradeHolding(product.ticker, "buy", Number(quantity), {
        execution_price: executionPrice,
        name: product.name,
        category: product.category,
        current_price: marketPrice,
        day_change_pct: product.day_change_pct || 0,
      });
      setPlacedOrder(`EB-${Date.now().toString().slice(-8)}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "The order could not be placed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-10 fade-up" data-testid="order-page">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] mb-6"
        >
          <ArrowLeft size={16} /> Back to products
        </button>

        <ContextualInsightBanner insight={insight} loading={insightLoading} error={insightError} />

        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
          <form onSubmit={submitOrder} className="rounded-2xl border border-[var(--border)] bg-white p-6 md:p-8">
            <div className="text-xs tracking-[0.18em] uppercase text-[var(--text-secondary)]">New order</div>
            <div className="flex items-start justify-between gap-4 mt-3 pb-6 border-b border-[var(--border)]">
              <div>
                <h2 className="font-display font-black text-3xl text-[var(--primary)]">{product.ticker}</h2>
                <p className="text-[var(--text-secondary)] mt-1">{product.name}</p>
              </div>
              <span className="px-3 py-1.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-xs font-bold">
                {product.risk || product.risk_level}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-5 mt-6">
              <label className="text-sm font-semibold text-[var(--primary)]">
                Order type
                <select
                  data-testid="order-type"
                  value={orderType}
                  onChange={(event) => setOrderType(event.target.value)}
                  className="mt-2 w-full h-12 rounded-xl border border-[var(--border)] bg-white px-4 outline-none focus:border-[var(--accent)]"
                >
                  <option>Market</option>
                  <option>Limit</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-[var(--primary)]">
                Quantity
                <input
                  data-testid="order-quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  className="mt-2 w-full h-12 rounded-xl border border-[var(--border)] px-4 outline-none focus:border-[var(--accent)]"
                />
              </label>
            </div>

            {orderType === "Limit" && (
              <label className="block text-sm font-semibold text-[var(--primary)] mt-5">
                Limit price ({product.currency || "EUR"})
                <input
                  data-testid="limit-price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={limitPrice}
                  onChange={(event) => setLimitPrice(event.target.value)}
                  className="mt-2 w-full h-12 rounded-xl border border-[var(--border)] px-4 outline-none focus:border-[var(--accent)]"
                />
              </label>
            )}

            {false && <div
              data-testid="contextual-insight-banner"
              className="mt-6 rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 p-5"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-white p-2 text-[var(--accent)]">
                  {insightLoading ? <LoaderCircle size={19} className="animate-spin" /> : <Lightbulb size={19} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                    Contextual investment insight
                  </div>
                  {insightLoading && (
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      Reviewing this order against your profile, portfolio positions and current market context…
                    </p>
                  )}
                  {!insightLoading && insight && (
                    <>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--primary)]">
                          {insight.recommendation?.replaceAll("_", " ")}
                        </span>
                        <span className="text-xs font-semibold text-[var(--text-secondary)]">
                          {insight.confidence}% confidence · {insight.riskLevel} risk ·{" "}
                          {insight.marketSentiment?.replaceAll("_", " ")} sentiment
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-medium leading-6 text-[var(--primary)]">{insight.summary}</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs text-[var(--text-secondary)]">
                        <div className="rounded-xl bg-white p-3">
                          <div className="flex items-center gap-2 font-bold text-[var(--success)]">
                            <CheckCircle2 size={14} /> Positive factors
                          </div>
                          <ul className="mt-2 space-y-1.5 list-disc pl-4">
                            {insight.positiveFactors?.map((factor) => <li key={factor}>{factor}</li>)}
                          </ul>
                        </div>
                        <div className="rounded-xl bg-white p-3">
                          <div className="flex items-center gap-2 font-bold text-[#B45309]">
                            <AlertTriangle size={14} /> Risks to consider
                          </div>
                          <ul className="mt-2 space-y-1.5 list-disc pl-4">
                            {insight.negativeFactors?.map((factor) => <li key={factor}>{factor}</li>)}
                          </ul>
                        </div>
                      </div>
                      {insight.alternatives?.length > 0 && (
                        <div className="mt-3 border-t border-[var(--accent)]/15 pt-3">
                          <div className="text-xs font-bold text-[var(--primary)]">Possible alternatives</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {insight.alternatives.map((alternative) => (
                              <div key={`${alternative.category}-${alternative.reason}`} className="rounded-xl bg-white px-3 py-2 text-xs text-[var(--text-secondary)]">
                                <span className="font-bold text-[var(--primary)]">{alternative.category}:</span>{" "}
                                {alternative.reason}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {!insightLoading && insightError && (
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{insightError}</p>
                  )}
                </div>
              </div>
            </div>}

            <label className="mt-6 flex items-start gap-3 rounded-xl bg-gray-50 p-4 text-sm text-[var(--text-secondary)]">
              <input
                data-testid="order-terms"
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
              />
              I understand that market prices can change before execution and that investing involves risk.
            </label>

            <button
              data-testid="place-order-btn"
              type="submit"
              disabled={!accepted || Number(quantity) <= 0 || estimatedTotal <= 0 || submitting}
              className="mt-6 w-full h-12 rounded-full bg-[var(--primary)] text-white font-bold disabled:opacity-40 hover:bg-[var(--accent)] transition-colors"
            >
              {submitting ? "Placing order…" : "Place order"}
            </button>
          </form>

          <aside className="rounded-2xl border border-[var(--border)] bg-gradient-to-b from-white to-[#F4F8FD] p-6 md:p-8 h-fit">
            <div className="text-xs tracking-[0.18em] uppercase text-[var(--text-secondary)]">Order summary</div>
            <div className="space-y-4 mt-5 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Current price</span>
                <span className="font-semibold font-mono-num">{formatMoney(marketPrice, product.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Quantity</span>
                <span className="font-semibold font-mono-num">{quantity || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Order type</span>
                <span className="font-semibold">{orderType}</span>
              </div>
              <div className="pt-4 border-t border-[var(--border)] flex justify-between items-end">
                <span className="text-[var(--text-secondary)]">Estimated total</span>
                <span data-testid="order-total" className="font-display font-black text-2xl text-[var(--primary)]">
                  {formatMoney(estimatedTotal, product.currency)}
                </span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white border border-[var(--border)] p-3">
                <ShieldCheck size={17} className="text-[var(--success)]" />
                <div className="text-xs font-semibold text-[var(--primary)] mt-2">Suitability checked</div>
              </div>
              <div className="rounded-xl bg-white border border-[var(--border)] p-3">
                <LockKeyhole size={17} className="text-[var(--accent)]" />
                <div className="text-xs font-semibold text-[var(--primary)] mt-2">Secure order</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
