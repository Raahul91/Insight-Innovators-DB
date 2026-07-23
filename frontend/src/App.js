import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";

import { Sidebar } from "@/components/Sidebar";
import { TopHeader } from "@/components/TopHeader";
import { AIAgent } from "@/components/AIAgent";
import { ERAPanel } from "@/components/ERAPanel";
import { ERAProvider } from "@/components/ERAContext";
import Dashboard from "@/pages/Dashboard";
import Objectives from "@/pages/Objectives";
import Products from "@/pages/Products";
import { LanguageProvider } from "@/lib/language";

const PAGE_META = {
  "/": { title: "Portfolio Overview", subtitle: "Dashboard" },
  "/objectives": { title: "Financial Objectives", subtitle: "Assessment" },
  "/products": { title: "Investment Options", subtitle: "Product Catalog" },
};

const Shell = () => {
  const location = useLocation();
  const meta = PAGE_META[location.pathname] || PAGE_META["/"];

  return (
    <div className="grain-overlay min-h-screen grid lg:grid-cols-2 md:grid-cols-[260px_1fr] grid-cols-1 bg-[var(--bg)]">
      {/* Laptop+ : ERA occupies left half (50vw) */}
      <ERAPanel />
      {/* Mobile / tablet : keep the compact sidebar */}
      <div className="lg:hidden">
        <Sidebar />
      </div>

      <main className="flex flex-col min-h-screen relative bg-[var(--bg)]">
        <TopHeader title={meta.title} subtitle={meta.subtitle} />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/objectives" element={<Objectives />} />
            <Route path="/products" element={<Products />} />
          </Routes>
        </div>
        <AIAgent />
      </main>
    </div>
  );
};

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <ERAProvider>
          <Shell />
          <Toaster position="top-right" richColors />
        </ERAProvider>
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
