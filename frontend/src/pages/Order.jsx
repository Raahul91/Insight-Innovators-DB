import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { fetchContextualInsight, fetchPortfolio, tradeHolding } from "../lib/api";
import { toast } from "sonner";

const readSessionItem = (key) => {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
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

const formatMoney = (value, currency = "EUR") =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const RISK_SCORE = { LOW: 32, MEDIUM: 62, HIGH: 88 };
const SENTIMENT_SCORE = {
  VERY_NEGATIVE: 8,
  NEGATIVE: 25,
  NEUTRAL: 50,
  POSITIVE: 75,
  VERY_POSITIVE: 92,
};

const MetricBar = ({ label, value, score, color }) => (
  <div className="rounded-xl border border-[var(--border)] bg-white p-4">
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">{label}</span>
      <span className="text-xs font-black text-[var(--primary)]">{value}</span>
    </div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.max(0, Math.min(100, score || 0))}%`, backgroundColor: color }}
      />
    </div>
  </div>
);

const PortfolioImpact = ({ insight, loading, error, product, quantity, total, portfolio }) => {
  const portfolioValue = Number(portfolio?.net_worth) || 0;
  const proposedWeight = portfolioValue > 0 ? (Number(total) / (portfolioValue + Number(total))) * 100 : 0;
  const currentPortfolioWeight = Math.max(0, 100 - proposedWeight);

  return (
  <section className="text-left" data-testid="portfolio-impact-section">
    <div className="mb-4">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Pre-trade review</div>
      <h3 className="mt-1 font-display text-2xl font-black text-[var(--primary)]">Portfolio impact if order is placed</h3>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Potential impact of purchasing {quantity} × {product.ticker}, valued at {formatMoney(total, product.currency)}.
        This pending order is not included in your holdings.
      </p>
    </div>

    <div className="rounded-2xl border border-[var(--accent)]/25 bg-gradient-to-br from-[#F4F9FF] via-white to-[#F7FBFF] p-5 md:p-6">
      {loading && (
        <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-[var(--text-secondary)]">
          <LoaderCircle size={22} className="animate-spin text-[var(--accent)]" />
          Analysing the proposed order against your current portfolio and market context…
        </div>
      )}

      {!loading && error && (
        <div className="flex min-h-28 items-center gap-3 rounded-xl bg-white p-4 text-sm text-[var(--text-secondary)]">
          <AlertTriangle size={20} className="text-[#B45309]" />
          {error}
        </div>
      )}

      {!loading && insight && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)]">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-5 text-center shadow-sm">
              <div
                className="grid h-28 w-28 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(var(--accent) ${insight.confidence || 0}%, #E8EEF5 0)`,
                }}
              >
                <div className="grid h-20 w-20 place-items-center rounded-full bg-white">
                  <div>
                    <div className="font-display text-2xl font-black text-[var(--primary)]">{insight.confidence}%</div>
                    <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Confidence</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-full bg-[var(--primary)] px-3 py-1.5 text-[10px] font-bold text-white">
                {insight.recommendation?.replaceAll("_", " ")}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                <Lightbulb size={16} /> Contextual investment insight
              </div>
              <p className="mt-3 text-base font-semibold leading-7 text-[var(--primary)]">{insight.summary}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MetricBar
                  label="Suitability"
                  value={insight.customerSuitability?.replaceAll("_", " ")}
                  score={insight.customerSuitability?.includes("HIGHLY") ? 95 : insight.customerSuitability === "SUITABLE" ? 78 : insight.customerSuitability?.includes("PARTIALLY") ? 52 : 20}
                  color="#34C759"
                />
                <MetricBar label="Risk level" value={insight.riskLevel} score={RISK_SCORE[insight.riskLevel]} color="#F59E0B" />
                <MetricBar
                  label="Market sentiment"
                  value={insight.marketSentiment?.replaceAll("_", " ")}
                  score={SENTIMENT_SCORE[insight.marketSentiment]}
                  color="#007AFF"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
            <div className="rounded-xl border border-[var(--border)] bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary)]">Potential portfolio weight</div>
              <div className="mt-4 flex items-center gap-5">
                <div
                  className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(var(--accent) 0 ${proposedWeight}%, #DCE7F3 ${proposedWeight}% 100%)`,
                  }}
                >
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-center">
                    <div>
                      <div className="text-lg font-black text-[var(--primary)]">{proposedWeight.toFixed(1)}%</div>
                      <div className="text-[8px] uppercase tracking-wide text-[var(--text-secondary)]">Proposed</div>
                    </div>
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between gap-2 text-[var(--text-secondary)]">
                      <span>Current portfolio</span><span>{currentPortfolioWeight.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-[#DCE7F3]" style={{ width: `${currentPortfolioWeight}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between gap-2 font-semibold text-[var(--primary)]">
                      <span>{product.ticker} order</span><span>{proposedWeight.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(2, proposedWeight)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-white p-4">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary)]">Decision spectrum</div>
              <div className="mt-5 grid gap-5">
                <div>
                  <div className="mb-2 flex justify-between text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                    <span>Lower risk</span><span>Higher risk</span>
                  </div>
                  <div className="relative h-3 rounded-full bg-gradient-to-r from-[#34C759] via-[#F59E0B] to-[#EF4444]">
                    <span
                      className="absolute top-1/2 h-5 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--primary)] shadow"
                      style={{ left: `${RISK_SCORE[insight.riskLevel] || 50}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex justify-between text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                    <span>Negative</span><span>Neutral</span><span>Positive</span>
                  </div>
                  <div className="relative h-3 rounded-full bg-gradient-to-r from-[#EF4444] via-[#CBD5E1] to-[#34C759]">
                    <span
                      className="absolute top-1/2 h-5 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--accent)] shadow"
                      style={{ left: `${SENTIMENT_SCORE[insight.marketSentiment] || 50}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--success)]/20 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--success)]">
                <CheckCircle2 size={17} /> Positive factors
              </div>
              <ul className="mt-3 grid gap-2 pl-5 text-sm leading-5 text-[var(--text-secondary)] list-disc">
                {insight.positiveFactors?.map((factor) => <li key={factor}>{factor}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-[#B45309]/20 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[#B45309]">
                <AlertTriangle size={17} /> Risks to consider
              </div>
              <ul className="mt-3 grid gap-2 pl-5 text-sm leading-5 text-[var(--text-secondary)] list-disc">
                {insight.negativeFactors?.map((factor) => <li key={factor}>{factor}</li>)}
              </ul>
            </div>
          </div>

          {insight.alternatives?.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary)]">Diversification alternatives</div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {insight.alternatives.map((alternative, index) => (
                  <div key={`${alternative.category}-${alternative.reason}`} className="rounded-xl bg-white p-4 shadow-sm">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)]/10 text-xs font-black text-[var(--accent)]">
                      {index + 1}
                    </div>
                    <div className="mt-3 text-sm font-bold text-[var(--primary)]">{alternative.category}</div>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{alternative.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  </section>
  );
};

export default function Order() {
  const location = useLocation();
  const navigate = useNavigate();
  const product = location.state?.product || readSessionItem("eurobank-selected-product");
  const customerAssessment = readSessionItem("eurobank-customer-profile");
  const [orderType, setOrderType] = useState("Market");
  const [quantity, setQuantity] = useState(1);
  const [limitPrice, setLimitPrice] = useState(product?.price || product?.current_price || 0);
  const [accepted, setAccepted] = useState(false);
  const [impactReviewed, setImpactReviewed] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState("");
  const [portfolioSnapshot, setPortfolioSnapshot] = useState(null);

  const marketPrice = Number(product?.price || product?.current_price || 0);
  const executionPrice = orderType === "Limit" ? Number(limitPrice) || 0 : marketPrice;
  const estimatedTotal = useMemo(
    () => Math.max(0, Number(quantity) || 0) * executionPrice,
    [quantity, executionPrice],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [product?.id, product?.product_id, product?.ticker, placedOrder]);

  const buildInsightRequest = () => ({
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

  const reviewOrderImpact = async (event) => {
    event.preventDefault();
    if (!accepted || quantity <= 0 || estimatedTotal <= 0) return;
    setSubmitting(true);
    setInsight(null);
    setInsightError("");
    setImpactReviewed(true);
    setInsightLoading(true);
    try {
      const [insightResult, portfolioResult] = await Promise.all([
        fetchContextualInsight(buildInsightRequest()),
        fetchPortfolio(),
      ]);
      setInsight(insightResult);
      setPortfolioSnapshot(portfolioResult);
    } catch (error) {
      setInsightError(error.response?.data?.detail || "Portfolio impact insight is currently unavailable.");
    } finally {
      setInsightLoading(false);
      setSubmitting(false);
    }
  };

  const confirmAndPlaceOrder = async () => {
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

  if (!product) {
    return (
      <div className="p-6 md:p-10 fade-up" data-testid="order-empty">
        <div className="max-w-xl mx-auto rounded-2xl border border-[var(--border)] bg-white p-8 text-center">
          <h2 className="font-display font-black text-2xl text-[var(--primary)]">Choose a product first</h2>
          <p className="text-[var(--text-secondary)] mt-2">Select a product before creating an order.</p>
          <button onClick={() => navigate("/products")} className="mt-6 px-5 py-2.5 rounded-full bg-[var(--primary)] text-white font-semibold">
            Browse products
          </button>
        </div>
      </div>
    );
  }

  if (impactReviewed && !placedOrder) {
    return (
      <div className="px-4 pb-8 pt-2 md:px-10 md:pb-10 md:pt-3 fade-up" data-testid="order-impact-review">
        <div className="mx-auto max-w-5xl">
          <PortfolioImpact
            insight={insight}
            loading={insightLoading}
            error={insightError}
            product={product}
            quantity={quantity}
            total={estimatedTotal}
            portfolio={portfolioSnapshot}
          />

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => setImpactReviewed(false)}
              disabled={submitting}
              className="px-5 py-2.5 rounded-full border border-[var(--border)] text-[var(--primary)] font-semibold disabled:opacity-40"
            >
              Change order
            </button>
            <button
              onClick={confirmAndPlaceOrder}
              disabled={submitting || insightLoading || !insight}
              className="px-6 py-2.5 rounded-full bg-[var(--primary)] text-white font-semibold disabled:opacity-40"
            >
              {submitting ? "Placing order…" : "Confirm and place order"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (placedOrder) {
    return (
      <div className="p-6 md:p-10 fade-up" data-testid="order-success">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--border)] bg-white p-8 text-center md:p-12">
          <CheckCircle2 size={52} className="mx-auto text-[var(--success)]" />
          <div className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--success)]">Order received</div>
          <h2 className="mt-2 font-display text-3xl font-black text-[var(--primary)]">Your order has been placed</h2>
          <p className="mt-3 text-[var(--text-secondary)]">
            {quantity} × {product.ticker} · {formatMoney(estimatedTotal, product.currency)}
          </p>
          <div className="mt-6 inline-flex rounded-full border border-[var(--border)] bg-gray-50 px-4 py-2 font-mono-num text-sm">
            Reference {placedOrder}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button onClick={() => navigate("/products")} className="px-5 py-2.5 rounded-full border border-[var(--border)] text-[var(--primary)] font-semibold">
              Back to products
            </button>
            <button onClick={() => navigate("/")} className="px-5 py-2.5 rounded-full bg-[var(--primary)] text-white font-semibold">
              Portfolio overview
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-2 md:px-10 md:pb-10 md:pt-3 fade-up" data-testid="order-page">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] mb-6">
          <ArrowLeft size={16} /> Back to products
        </button>

        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
          <form onSubmit={reviewOrderImpact} className="rounded-2xl border border-[var(--border)] bg-white p-6 md:p-8">
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
              {submitting ? "Analysing impact…" : "Review portfolio impact"}
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
