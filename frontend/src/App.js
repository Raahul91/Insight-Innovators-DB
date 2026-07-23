import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";

import { Sidebar } from "@/components/Sidebar";
import { TopHeader } from "@/components/TopHeader";
import { AIAgent } from "@/components/AIAgent";
import Dashboard from "@/pages/Dashboard";
import Objectives from "@/pages/Objectives";
import Products from "@/pages/Products";

const PAGE_META = {
  "/": { title: "Portfolio Overview", subtitle: "Dashboard" },
  "/objectives": { title: "Financial Objectives", subtitle: "Assessment" },
  "/products": { title: "Investment Options", subtitle: "Product Catalog" },
};

const Shell = () => {
  const location = useLocation();
  const meta = PAGE_META[location.pathname] || PAGE_META["/"];

  return (
    <div className="app-shell grain-overlay">
      <Sidebar />
      <main className="flex flex-col min-h-screen relative">
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
    <BrowserRouter>
      <Shell />
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}

export default App;
