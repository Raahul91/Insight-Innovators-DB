import { Bell, Search } from "lucide-react";

export const TopHeader = ({ title, subtitle }) => {
  return (
    <header
      data-testid="top-header"
      className="flex items-center justify-between px-6 md:px-10 py-6 border-b border-[var(--border)] bg-white/70 backdrop-blur sticky top-0 z-20"
    >
      <div>
        <div className="text-[11px] tracking-[0.2em] uppercase text-[var(--text-secondary)]">
          {subtitle}
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
            placeholder="Search assets, funds…"
            className="bg-transparent outline-none flex-1 text-[var(--text-primary)]"
          />
        </div>
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
