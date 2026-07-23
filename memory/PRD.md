# Investment Portfolio (Meridian Wealth OS) — PRD

## Original Problem Statement
Create a figma type sample webpage for an investment portfolio UI with:
- Portfolio details
- Financial objectives with dynamic questionnaire → investment horizon
- Investment options with product list (Stocks, MFs, ETFs, Bonds, Crypto)
- Talking AI agent (text + voice) for AI Assist

## User Choices
- Full-stack (FastAPI + React + MongoDB)
- Both text + voice AI agent (Claude Sonnet 4.5 + browser Web Speech API for STT/TTS)
- Dynamic scoring questionnaire
- All product categories
- Light professional design (Swiss/High-Contrast)

## Architecture
- **Backend**: FastAPI. Endpoints: /api/portfolio, /api/products, /api/questionnaire/{questions,submit}, /api/chat/stream (SSE, Claude Sonnet 4.5 via EMERGENT_LLM_KEY), /api/chat/history/{session}. Data mostly in-memory mock; submissions + chat persisted to Mongo.
- **Frontend**: React Router. Pages: Dashboard, Objectives, Products. Sidebar + top header. Floating glassmorphism AI Agent panel with Web Speech API mic + speech synthesis. Recharts for line + donut. Sonner toasts.
- **Design**: Chivo (headings), IBM Plex Sans (body), IBM Plex Mono (numbers). Palette: #0A2540 primary, #007AFF accent, #34C759 success, #FF3B30 danger.

## Implemented (Feb 2026)
- Portfolio dashboard: 4 stat cards (net worth, invested, return, day), 12-mo performance line, 5-slice allocation donut, 7-row holdings table
- 5-question dynamic questionnaire with 3-bucket scoring → horizon + risk + suggested allocation
- 16 sample products across 5 categories with search + filter tabs + watchlist toast
- AI Agent Aria: streamed Claude Sonnet 4.5 chat, voice input (SpeechRecognition), voice output (SpeechSynthesis), voice mute toggle
- 100% test pass (14/14 backend, 32/32 frontend)

## Backlog (P1/P2)
- P1: Real market data (Alpha Vantage / CoinGecko) instead of static prices
- P1: User accounts + persisted portfolios per user
- P2: ElevenLabs for higher-quality TTS voice
- P2: Order/trade simulation with paper trading balance
- P2: Advanced charts (candlesticks, multi-period toggle)
- P2: Export portfolio as PDF report
