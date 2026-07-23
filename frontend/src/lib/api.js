import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const http = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

export const fetchPortfolio = () => http.get("/portfolio").then((r) => r.data);
export const fetchProducts = (category) =>
  http
    .get(`/products${category && category !== "All" ? `?category=${encodeURIComponent(category)}` : ""}`)
    .then((r) => r.data);
export const fetchQuestions = () => http.get("/questionnaire/questions").then((r) => r.data);
export const submitQuestionnaire = (payload) =>
  http.post("/questionnaire/submit", payload).then((r) => r.data);
