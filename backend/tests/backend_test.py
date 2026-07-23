"""Backend API tests for Investment Portfolio app.

Covers: /api/portfolio, /api/products, /api/questionnaire/*, /api/chat/*.
"""
import os
import json
import time
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Portfolio ----------
class TestPortfolio:
    def test_get_portfolio(self, api_client):
        r = api_client.get(f"{API}/portfolio", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in [
            "net_worth", "total_invested", "total_gain", "total_gain_pct",
            "day_change", "day_change_pct", "allocation", "performance", "holdings",
        ]:
            assert k in d, f"missing key {k}"
        assert isinstance(d["net_worth"], (int, float)) and d["net_worth"] > 0
        # 5 categories in allocation
        cats = {a["category"] for a in d["allocation"]}
        assert cats == {"Stocks", "Mutual Funds", "ETFs", "Bonds", "Crypto"}, cats
        # 12-month performance
        assert len(d["performance"]) == 12
        # 7 holdings
        assert len(d["holdings"]) == 7


# ---------- Products ----------
class TestProducts:
    def test_get_all_products(self, api_client):
        r = api_client.get(f"{API}/products", timeout=15)
        assert r.status_code == 200
        products = r.json()
        assert isinstance(products, list) and len(products) >= 15
        cats = {p["category"] for p in products}
        assert cats == {"Stocks", "Mutual Funds", "ETFs", "Bonds", "Crypto"}

    @pytest.mark.parametrize("cat", ["Stocks", "Mutual Funds", "ETFs", "Bonds", "Crypto"])
    def test_filter_by_category(self, api_client, cat):
        r = api_client.get(f"{API}/products", params={"category": cat}, timeout=15)
        assert r.status_code == 200
        products = r.json()
        assert len(products) > 0
        for p in products:
            assert p["category"] == cat

    def test_filter_all_alias(self, api_client):
        r = api_client.get(f"{API}/products", params={"category": "All"}, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 15


# ---------- Questionnaire ----------
class TestQuestionnaire:
    def test_get_questions(self, api_client):
        r = api_client.get(f"{API}/questionnaire/questions", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "questions" in data
        qs = data["questions"]
        assert len(qs) == 5
        for q in qs:
            assert "id" in q and "text" in q and "options" in q
            assert len(q["options"]) == 4

    def _build_answers(self, api_client, value: int):
        qs = api_client.get(f"{API}/questionnaire/questions", timeout=15).json()["questions"]
        return {"answers": [{"question_id": q["id"], "value": value} for q in qs]}

    def test_submit_low_score(self, api_client):
        payload = self._build_answers(api_client, 1)
        r = api_client.post(f"{API}/questionnaire/submit", json=payload, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["total_score"] == 5
        assert d["horizon"] == "Short-term"
        assert d["risk_profile"] == "Conservative"
        assert isinstance(d["allocation_suggestion"], list) and len(d["allocation_suggestion"]) > 0

    def test_submit_mid_score(self, api_client):
        payload = self._build_answers(api_client, 3)
        r = api_client.post(f"{API}/questionnaire/submit", json=payload, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["total_score"] == 15
        assert d["horizon"] == "Medium-term"
        assert d["risk_profile"] == "Balanced"

    def test_submit_high_score(self, api_client):
        payload = self._build_answers(api_client, 4)
        r = api_client.post(f"{API}/questionnaire/submit", json=payload, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["total_score"] == 20
        assert d["horizon"] == "Long-term"
        assert d["risk_profile"] == "Aggressive"


# ---------- Chat streaming + history ----------
class TestChat:
    def test_chat_stream_returns_content(self, api_client):
        session_id = f"TEST_sess_{uuid.uuid4().hex[:8]}"
        payload = {
            "message": "In one short sentence, say hello and mention diversification.",
            "session_id": session_id,
        }
        got_content = ""
        got_done = False
        got_error = False
        with requests.post(
            f"{API}/chat/stream", json=payload, stream=True, timeout=60,
            headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
        ) as r:
            assert r.status_code == 200, r.text
            assert "text/event-stream" in r.headers.get("content-type", "")
            event_type = "message"
            for raw in r.iter_lines(decode_unicode=True):
                if not raw:
                    continue
                if raw.startswith("event:"):
                    event_type = raw[6:].strip()
                    continue
                if raw.startswith("data:"):
                    payload = json.loads(raw[5:].lstrip())
                    if event_type == "done":
                        got_done = True
                        break
                    if event_type == "error":
                        got_error = True
                        break
                    if event_type == "message":
                        got_content += payload.get("text", "")
        assert not got_error, f"Stream returned error: {got_content}"
        assert got_done, "Did not receive [DONE]"
        assert len(got_content.strip()) > 5, f"Empty streamed content: '{got_content}'"

        # Save session id for history test
        pytest.chat_session_id = session_id

        # Give backend a moment to persist
        time.sleep(1.0)

        r2 = api_client.get(f"{API}/chat/history/{session_id}", timeout=15)
        assert r2.status_code == 200
        msgs = r2.json()["messages"]
        assert len(msgs) == 2
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles
        assistant_msg = next(m for m in msgs if m["role"] == "assistant")
        assert len(assistant_msg["content"].strip()) > 5

    def test_chat_history_empty_session(self, api_client):
        r = api_client.get(f"{API}/chat/history/TEST_nonexistent_{uuid.uuid4().hex[:6]}", timeout=15)
        assert r.status_code == 200
        assert r.json() == {"messages": []}
