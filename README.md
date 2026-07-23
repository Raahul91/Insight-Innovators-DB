# EuroBank local development

## OpenAI-powered Era

Era uses the OpenAI Responses API with Structured Outputs to guide customers
through the Financial Objectives questionnaire. The API key is read only by the
backend and must never be placed in frontend code.

1. Copy `backend/.env.example` to `backend/.env`.
2. Add your key as `OPENAI_API_KEY=...`.
3. Start MongoDB.
4. Start the backend:

   ```bash
   cd backend
   ./.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8000
   ```

5. Start the frontend:

   ```bash
   cd frontend
   npm start
   ```

The default model is `gpt-5.6-sol`. Override it with `OPENAI_MODEL` if needed.
