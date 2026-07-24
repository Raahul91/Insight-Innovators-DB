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
const QUESTION_CACHE_KEY = "eurobank-questionnaire-v1";
let questionRequest = null;

export const fetchQuestions = () => {
  try {
    const cached = sessionStorage.getItem(QUESTION_CACHE_KEY);
    if (cached) return Promise.resolve(JSON.parse(cached));
  } catch (_) {
    // A fresh network request is a safe fallback when session storage is unavailable.
  }
  if (!questionRequest) {
    questionRequest = http.get("/questionnaire/questions").then((response) => {
      try {
        sessionStorage.setItem(QUESTION_CACHE_KEY, JSON.stringify(response.data));
      } catch (_) {
        // Keep the in-memory cache even if the browser blocks storage.
      }
      return response.data;
    });
  }
  return questionRequest;
};
export const submitQuestionnaire = (payload) =>
  http.post("/questionnaire/submit", payload).then((r) => r.data);
export const fetchContextualInsight = (payload) =>
  http.post("/contextual-insights", payload).then((r) => r.data);
