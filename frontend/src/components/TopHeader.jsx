import { Bell, Search, ChevronDown, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LANGS, useLanguage } from "../lib/language";

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
      className="flex items-center justify-between px-6 md:px-10 py-6 border-b border-[var(--border)] bg-white/70 backdrop-blur sticky top-0 z-20"
    >
      <div>
        <div className="text-[11px] tracking-[0.2em] uppercase text-[var(--text-secondary)]">
          {subtitle} · EUR
        </div>
        <h1 className="font-display font-black text-2xl md:text-3xl text-[var(--primary)]" data-testid="page-title">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-full border border-[var(--border)] bg-white text-sm text-[var(--text-secondary)] w-64">
          <Search size={16} />
          <input
            data-testid="header-search"
            placeholder="Search UCITS ETFs, stocks…"
            className="bg-transparent outline-none flex-1 text-[var(--text-primary)]"
          />
        </div>
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
          <div className="hidden md:block">
            <div className="text-sm font-semibold text-[var(--primary)]">Elena Marchetti</div>
            <div className="text-xs text-[var(--text-secondary)]">Premium Client</div>
          </div>
        </div>
      </div>
    </header>
  );
};
