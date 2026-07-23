import { NavLink } from "react-router-dom";
import { LayoutDashboard, Target, TrendingUp, Sparkles } from "lucide-react";

const items = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/objectives", label: "Objectives", icon: Target, testid: "nav-objectives" },
  { to: "/products", label: "Products", icon: TrendingUp, testid: "nav-products" },
];

export const Sidebar = () => {
  return (
    <aside
      data-testid="app-sidebar"
      className="hidden md:flex flex-col border-r border-[var(--border)] bg-white/60 backdrop-blur px-5 py-8 sticky top-0 h-screen"
    >
      <div className="flex items-center gap-3 mb-12">
        <div className="h-10 w-10 rounded-xl bg-[var(--primary)] flex items-center justify-center">
          <Sparkles className="text-white" size={20} strokeWidth={2.4} />
        </div>
        <div>
          <div className="font-display font-black text-lg leading-none text-[var(--primary)]">MERIDIAN</div>
          <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-secondary)] mt-1">
            Wealth OS
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        <div className="text-[10px] tracking-[0.2em] uppercase text-[var(--text-secondary)] px-3 mb-2">
          Navigate
        </div>
        {items.map(({ to, label, icon: Icon, testid }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            data-testid={testid}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-gray-100 hover:text-[var(--primary)]"
              }`
            }
          >
            <Icon size={18} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto rounded-xl border border-[var(--border)] p-4 bg-gradient-to-b from-white to-gray-50">
        <div className="text-xs text-[var(--text-secondary)] mb-1">Advisory</div>
        <div className="font-display font-bold text-sm text-[var(--primary)] leading-snug">
          Chat with Aria, your AI investment agent.
        </div>
        <div className="text-xs mt-2 text-[var(--text-secondary)]">
          Ask questions by voice or text.
        </div>
      </div>
    </aside>
  );
};
