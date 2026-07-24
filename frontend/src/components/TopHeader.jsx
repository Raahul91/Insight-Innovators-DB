import { Bell, ChevronDown, Globe, LayoutDashboard, Target, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { LANGS, useLanguage } from "../lib/language";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "topnav-dashboard" },
  { to: "/objectives", label: "Objectives", icon: Target, testid: "topnav-objectives" },
  { to: "/products", label: "Products", icon: TrendingUp, testid: "topnav-products" },
];

const LangSelector = () => {
  const { code, short, setCode, label } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        data-testid="lang-selector-btn"
        onClick={() => setOpen((v) => !v)}
        className="h-10 pl-3 pr-2.5 rounded-full border border-[var(--border)] bg-white flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:bg-gray-50 transition-colors"
        aria-label={`Language: ${label}`}
      >
        <Globe size={14} className="text-[var(--text-secondary)]" />
        <span className="font-mono-num">{short}</span>
        <ChevronDown size={13} className={`text-[var(--text-secondary)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          data-testid="lang-selector-menu"
          className="absolute right-0 mt-2 w-44 rounded-xl border border-[var(--border)] bg-white shadow-lg overflow-hidden z-30"
        >
          {LANGS.map((l) => (
            <button
              key={l.code}
              data-testid={`lang-option-${l.code}`}
              onClick={() => {
                setCode(l.code);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 flex items-center justify-between text-sm transition-colors ${
                l.code === code
                  ? "bg-[var(--accent)]/10 text-[var(--accent)] font-semibold"
                  : "text-[var(--primary)] hover:bg-gray-50"
              }`}
            >
              <span>{l.label}</span>
              <span className="text-[10px] tracking-widest font-mono-num text-[var(--text-secondary)]">{l.short}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const TopHeader = ({ title, subtitle }) => {
  return (
    <header
      data-testid="top-header"
      className="flex items-center justify-between px-6 md:px-10 py-6 border-b border-[var(--border)] bg-white/70 backdrop-blur sticky top-0 z-20 gap-4 flex-wrap lg:grid lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:flex-nowrap"
    >
      <div className="min-w-0 lg:justify-self-start">
        <div className="text-[11px] tracking-[0.2em] uppercase text-[var(--text-secondary)]">
          {subtitle} · EUR
        </div>
        <h1 className="font-display font-black text-2xl md:text-3xl text-[var(--primary)] truncate" data-testid="page-title">
          {title}
        </h1>
      </div>

      {/* Primary navigation remains available even when the assistant rail is visible. */}
      <nav className="hidden md:flex items-center gap-1 order-3 md:order-3 lg:order-2 w-full lg:w-auto lg:justify-self-start">
        {NAV.map(({ to, label, icon: Icon, testid }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            data-testid={testid}
            className={({ isActive }) =>
              `inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-gray-100 hover:text-[var(--primary)]"
              }`
            }
          >
            <Icon size={15} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div
        data-testid="profile-settings"
        className="flex items-center gap-3 order-2 lg:order-3 ml-auto lg:ml-0 lg:justify-self-end rounded-2xl border border-[var(--border)] bg-white/85 px-2 py-1.5 shadow-sm"
      >
        <LangSelector />
        <button
          data-testid="notifications-btn"
          className="h-10 w-10 rounded-full border border-[var(--border)] bg-white flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <Bell size={18} className="text-[var(--text-secondary)]" />
        </button>
        <div className="flex items-center gap-3 pl-3 border-l border-[var(--border)]">
          <img
            data-testid="user-avatar"
            src="https://images.unsplash.com/photo-1506863530036-1efeddceb993?crop=entropy&cs=srgb&fm=jpg&w=80&h=80&fit=crop"
            alt="user"
            className="h-10 w-10 rounded-full object-cover"
          />
          <div className="hidden 2xl:block">
            <div className="text-sm font-semibold text-[var(--primary)]">Elena Marchetti</div>
            <div className="text-xs text-[var(--text-secondary)]">Premium Client</div>
          </div>
        </div>
      </div>
    </header>
  );
};
