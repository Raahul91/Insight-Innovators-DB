import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchProducts } from "../lib/api";
import { fmtCurrency, fmtPct } from "../lib/format";
import { Search, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["All", "Stocks", "Mutual Funds", "ETFs", "Bonds", "Crypto"];

const RiskBadge = ({ level }) => {
  const map = {
    Low: "bg-[var(--success)]/10 text-[var(--success)]",
    Medium: "bg-[#F59E0B]/10 text-[#B45309]",
    High: "bg-[var(--danger)]/10 text-[var(--danger)]",
  };
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${map[level]}`}>
      {level}
    </span>
  );
};

export default function Products() {
  const [searchParams] = useSearchParams();
  const recommended = searchParams.get("recommended") === "true";
  const profileRisk = searchParams.get("risk");
  const profileHorizon = searchParams.get("horizon");
  const [category, setCategory] = useState("All");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchProducts(category)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [category]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const searched = !q ? products : products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.ticker.toLowerCase().includes(q),
    );
    if (!recommended || !profileRisk) return searched;
    const allowedRisk = {
      Conservative: ["Low"],
      Balanced: ["Low", "Medium"],
      Aggressive: ["Medium", "High"],
    }[profileRisk] || ["Low", "Medium", "High"];
    return searched.filter((product) => allowedRisk.includes(product.risk));
  }, [products, query, recommended, profileRisk]);

  return (
    <div className="p-6 md:p-10 fade-up" data-testid="products-page">
      {recommended && profileRisk && (
        <div
          data-testid="recommended-products-context"
          className="mb-6 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-5 py-4"
        >
          <div className="text-xs tracking-[0.15em] uppercase text-[var(--accent)] font-semibold">
            Recommended for your objectives
          </div>
          <div className="font-display font-bold text-xl text-[var(--primary)] mt-1">
            {profileRisk} profile · {profileHorizon || "Personalised"} horizon
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Showing products with risk levels aligned to your completed assessment.
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
            placeholder="Search products…"
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
                    {fmtCurrency(p.price)}
                  </span>
                  <span
                    className={`text-sm font-medium font-mono-num flex items-center gap-1 ${
                      positive ? "text-[var(--success)]" : "text-[var(--danger)]"
                    }`}
                  >
                    {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {fmtPct(p.ytd_return)} YTD
                  </span>
                </div>

                <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed line-clamp-2">
                  {p.description}
                </p>

                <div className="flex items-center justify-between text-xs pt-4 border-t border-[var(--border)]">
                  <div>
                    <div className="text-[var(--text-secondary)] mb-0.5">1Y Return</div>
                    <div
                      className={`font-semibold font-mono-num ${
                        p.one_year_return >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
                      }`}
                    >
                      {fmtPct(p.one_year_return)}
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
                    data-testid={`invest-btn-${p.ticker}`}
                    onClick={() =>
                      toast.success(`Added ${p.ticker} to watchlist`, {
                        description: `${p.name} · ${fmtCurrency(p.price)}`,
                      })
                    }
                    className="px-4 py-1.5 rounded-full bg-[var(--primary)] text-white text-xs font-semibold hover:bg-[var(--accent)] transition-colors"
                  >
                    Watchlist
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
    </div>
  );
}
