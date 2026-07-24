import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const http = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

export const fetchPortfolio = () => http.get("/portfolio").then((r) => r.data);
export const tradeHolding = (ticker, side, quantity, details = {}) =>
  http
    .post(`/portfolio/holdings/${encodeURIComponent(ticker)}/trade`, {
      side,
      quantity,
      ...details,
    })
    .then((r) => r.data);
export const fetchProducts = (category) =>
  http
    .get(`/products${category && category !== "All" ? `?category=${encodeURIComponent(category)}` : ""}`)
    .then((r) => r.data);
export const fetchRecommendationProfile = (horizon, riskProfile) =>
  http
    .get(
      `/recommendations?horizon=${encodeURIComponent(horizon)}&risk_profile=${encodeURIComponent(riskProfile)}`,
    )
    .then((r) => r.data);
export const fetchCurrentRecommendation = () =>
  http.get("/recommendations/current").then((r) => r.data);
export const fetchQuestions = () => http.get("/questionnaire/questions").then((r) => r.data);
export const submitQuestionnaire = (payload) =>
  http.post("/questionnaire/submit", payload).then((r) => r.data);
export const fetchContextualInsight = (payload) =>
  http.post("/contextual-insights", payload).then((r) => r.data);
