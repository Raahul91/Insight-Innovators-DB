export const fmtCurrency = (n) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);

export const fmtNumber = (n, digits = 2) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    Number(n) || 0,
  );

export const fmtPct = (n) => `${Number(n) >= 0 ? "+" : ""}${Number(n).toFixed(2)}%`;
