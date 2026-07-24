import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { fetchCurrentRecommendation, fetchRecommendationProfile } from "../lib/api";
import { fmtCurrency, fmtPct } from "../lib/format";
import { Search, TrendingUp, TrendingDown } from "lucide-react";

const CATEGORIES = ["All", "Stocks", "Mutual Funds", "ETFs", "Bonds", "Crypto"];
const fmtProductPrice = (product) =>
  product.currency
    ? new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: product.currency,
        maximumFractionDigits: 2,
      }).format(product.price)
    : fmtCurrency(product.price);

const RiskBadge = ({ level }) => {
  const map = {
    Low: "bg-[var(--success)]/10 text-[var(--success)]",
    Medium: "bg-[#F59E0B]/10 text-[#B45309]",
    High: "bg-[var(--danger)]/10 text-[var(--danger)]",
  };
  const fallback =
    level?.includes("Low") || level === "Very Low"
      ? "bg-[var(--success)]/10 text-[var(--success)]"
      : level?.includes("High") || level === "Extreme"
      ? "bg-[var(--danger)]/10 text-[var(--danger)]"
      : "bg-[#F59E0B]/10 text-[#B45309]";
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${map[level] || fallback}`}>
      {level}
    </span>
  );
};

export default function Products() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const recommended = searchParams.get("recommended") === "true";
  const profileRisk = searchParams.get("risk");
  const profileHorizon = searchParams.get("horizon");
  const [category, setCategory] = useState("All");
  const [products, setProducts] = useState([]);
  const [recommendationProfile, setRecommendationProfile] = useState(null);
  const [profileUnavailable, setProfileUnavailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const hasExplicitProfile = recommended && profileRisk && profileHorizon;

  const rankRecommendedProducts = (profile) =>
    (profile.allocation_suggestion || [])
      .flatMap((allocation, allocationIndex) =>
        (allocation.products || []).map((product, productIndex) => ({
          ...product,
          id: product.product_id,
          category: allocation.asset_class,
          price: product.current_price,
          risk: product.risk_level,
          allocation_percentage: allocation.allocation_percentage,
          allocationIndex,
          productIndex,
        })),
      )
      .sort(
        (left, right) =>
          right.allocation_percentage - left.allocation_percentage ||
          left.allocationIndex - right.allocationIndex ||
          left.productIndex - right.productIndex,
      )
      .map(({ allocationIndex, productIndex, ...product }, index) => ({
        ...product,
        recommendation_rank: index + 1,
      }));

  const startOrder = (product) => {
    sessionStorage.setItem("eurobank-selected-product", JSON.stringify(product));
    navigate(`/order?product=${encodeURIComponent(product.product_id || product.id)}`, {
      state: { product },
    });
  };

  useEffect(() => {
    setLoading(true);
    const profileRequest = hasExplicitProfile
      ? fetchRecommendationProfile(profileHorizon, profileRisk)
      : fetchCurrentRecommendation();

    profileRequest
        .then((profile) => {
          setProfileUnavailable(false);
          setRecommendationProfile(profile);
          setProducts(rankRecommendedProducts(profile));
        })
        .catch(() => {
          setRecommendationProfile(null);
          setProducts([]);
          setProfileUnavailable(true);
        })
        .finally(() => setLoading(false));
  }, [category, hasExplicitProfile, profileHorizon, profileRisk]);

  const showingRecommendations = Boolean(recommendationProfile);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const searched = !q ? products : products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.ticker.toLowerCase().includes(q),
    );
    if (!showingRecommendations) return searched;
    return category === "All"
      ? searched
      : searched.filter((product) => product.category === category);
  }, [products, query, showingRecommendations, category]);

  return (
    <div className="p-6 md:p-10 fade-up" data-testid="products-page">
      {profileUnavailable && !loading && (
        <section
          data-testid="products-requires-objectives"
          className="mx-auto max-w-2xl rounded-3xl border border-[var(--accent)]/20 bg-white px-7 py-10 text-center shadow-sm"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Personalised products
          </div>
          <h2 className="mt-3 font-display text-2xl font-black text-[var(--primary)]">
            Complete Financial Objectives first
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[var(--text-secondary)]">
            We use your investment objective, time horizon, and risk profile to rank products that fit your selections.
          </p>
          <Link
            to="/objectives"
            data-testid="complete-objectives-link"
            className="mt-6 inline-flex rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent)]"
          >
            Complete Financial Objectives
          </Link>
        </section>
      )}
      {!profileUnavailable && (
        <>
      {showingRecommendations && (
        <div
          data-testid="recommended-products-context"
          className="mb-6 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-5 py-4"
        >
          <div className="text-xs tracking-[0.15em] uppercase text-[var(--accent)] font-semibold">
            Recommended for your objectives
          </div>
          <div className="font-display font-bold text-xl text-[var(--primary)] mt-1">
            {recommendationProfile.risk_profile} profile · {recommendationProfile.horizon} horizon
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {recommendationProfile?.recommendation ||
              "Showing products aligned to your completed financial-objectives assessment."}
          </p>
        </div>
      )}
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {CATEGORIES.map((cat) => {
          const active = cat === category;
          return (
            <button
              key={cat}
              data-testid={`category-tab-${cat.replace(/\s+/g, "-").toLowerCase()}`}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                active
                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                  : "bg-white text-[var(--text-secondary)] border-[var(--border)] hover:border-gray-300"
              }`}
            >
              {cat}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2 px-3 py-2 rounded-full border border-[var(--border)] bg-white w-full sm:w-64">
          <Search size={16} className="text-[var(--text-secondary)]" />
          <input
            data-testid="products-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={showingRecommendations ? "Search your recommendations…" : "Search products…"}
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-[var(--text-secondary)]">Loading products…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const positive = p.ytd_return >= 0;
            return (
              <div
                key={p.id}
                data-testid={`product-card-${p.ticker}`}
                className="bg-white border border-[var(--border)] rounded-xl p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                {showingRecommendations && (
                  <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                    <span>Recommended #{p.recommendation_rank}</span>
                    <span>{p.allocation_percentage}% target allocation</span>
                  </div>
                )}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="font-display font-black text-xl text-[var(--primary)] leading-tight">
                      {p.ticker}
                    </div>
                    <div className="text-sm text-[var(--text-secondary)] mt-0.5">{p.name}</div>
                  </div>
                  <RiskBadge level={p.risk} />
                </div>

                <div className="flex items-baseline gap-2 mb-4">
                  <span className="font-display font-black text-2xl text-[var(--primary)] font-mono-num">
                    {fmtProductPrice(p)}
                  </span>
                  {p.ytd_return !== undefined && (
                    <span
                      className={`text-sm font-medium font-mono-num flex items-center gap-1 ${
                        positive ? "text-[var(--success)]" : "text-[var(--danger)]"
                      }`}
                    >
                      {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {fmtPct(p.ytd_return)} YTD
                    </span>
                  )}
                </div>

                <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed line-clamp-2">
                  {p.description ||
                    `${p.category} recommendation · ${p.allocation_percentage}% target allocation · ${p.currency}`}
                </p>

                <div className="flex items-center justify-between text-xs pt-4 border-t border-[var(--border)]">
                  <div>
                    <div className="text-[var(--text-secondary)] mb-0.5">1Y Return</div>
                    <div className="font-semibold font-mono-num text-[var(--primary)]">
                      {p.one_year_return !== undefined
                        ? fmtPct(p.one_year_return)
                        : p.currency}
                    </div>
                  </div>
                  {p.expense_ratio !== null && p.expense_ratio !== undefined && (
                    <div>
                      <div className="text-[var(--text-secondary)] mb-0.5">Expense</div>
                      <div className="font-semibold font-mono-num text-[var(--primary)]">
                        {p.expense_ratio}%
                      </div>
                    </div>
                  )}
                  <button
                    data-testid={`buy-btn-${p.ticker}`}
                    onClick={() => startOrder(p)}
                    className="px-5 py-2 rounded-full bg-[var(--primary)] text-white text-xs font-semibold hover:bg-[var(--accent)] transition-colors"
                  >
                    Buy
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-[var(--text-secondary)] py-16">
              No products match your search.
            </div>
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}
