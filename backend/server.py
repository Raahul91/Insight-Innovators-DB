from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from openai import AsyncOpenAI
import os
import json
import logging
import re
import asyncio
import httpx
import base64
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
with open(ROOT_DIR / "recommendation_profiles.json", encoding="utf-8") as profile_file:
    RECOMMENDATION_PROFILES = json.load(profile_file)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-5.6-sol")
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
ERA_TTS_MODEL = os.environ.get("ERA_TTS_MODEL", "gpt-4o-mini-tts")
ERA_TTS_VOICE = os.environ.get("ERA_TTS_VOICE", "marin")

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------- Models ----------
class Holding(BaseModel):
    ticker: str
    name: str
    category: str
    shares: float
    avg_cost: float
    current_price: float
    day_change_pct: float


class HoldingTrade(BaseModel):
    side: Literal["buy", "sell"]
    quantity: float = Field(gt=0)
    execution_price: Optional[float] = Field(default=None, gt=0)
    name: Optional[str] = None
    category: Optional[str] = None
    current_price: Optional[float] = Field(default=None, gt=0)
    day_change_pct: float = 0


class PortfolioSummary(BaseModel):
    net_worth: float
    total_invested: float
    total_gain: float
    total_gain_pct: float
    day_change: float
    day_change_pct: float
    allocation: List[dict]
    performance: List[dict]
    holdings: List[Holding]


class Product(BaseModel):
    id: str
    ticker: str
    name: str
    category: Literal["Stocks", "Mutual Funds", "ETFs", "Bonds", "Crypto"]
    price: float
    ytd_return: float
    one_year_return: float
    risk: Literal["Low", "Medium", "High"]
    expense_ratio: Optional[float] = None
    description: str


class QuestionnaireAnswer(BaseModel):
    question_id: str
    value: int  # score


class QuestionnaireSubmission(BaseModel):
    answers: List[QuestionnaireAnswer]
    session_id: Optional[str] = None


class QuestionnaireResult(BaseModel):
    total_score: int
    profile_id: str
    primary_objective: str
    horizon: Literal["Short-term", "Medium-term", "Long-term"]
    risk_profile: Literal["Conservative", "Balanced", "Aggressive"]
    recommendation: str
    allocation_suggestion: List[dict]
    knowledge: Literal["BEGINNER", "INTERMEDIATE", "ADVANCED"]
    experience: str
    esg_preference: Literal["YES", "NO"] = "NO"


class ContextualCustomerProfile(BaseModel):
    riskAppetite: Literal["LOW", "MEDIUM", "HIGH"]
    knowledge: Literal["BEGINNER", "INTERMEDIATE", "ADVANCED"]
    experience: str
    esgPreference: Literal["YES", "NO"]


class ContextualOrder(BaseModel):
    instrumentId: Optional[str] = None
    instrumentSymbol: Optional[str] = None
    instrumentName: str
    action: Literal["BUY", "SELL"]
    quantity: int = Field(gt=0)


class EraSpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4096)


class ContextualInsightRequest(BaseModel):
    customerProfile: ContextualCustomerProfile
    order: ContextualOrder


class ChatRequest(BaseModel):
    message: str
    session_id: str
    language: Optional[str] = "English"
    portfolio_context: Optional[dict] = None
    questionnaire_context: Optional[dict] = None


class EraTurn(BaseModel):
    message: str = Field(
        description="A concise, warm reply written to be spoken aloud."
    )
    question_id: Optional[str] = Field(
        default=None,
        description="The current questionnaire question id, when applicable."
    )
    selected_option_value: Optional[int] = Field(
        default=None,
        ge=1,
        le=4,
        description=(
            "The value of the matching visible option. Set this both for a clear answer "
            "and for a likely interpretation that needs the customer's confirmation; the "
            "client keeps it pending until the customer affirms it."
        )
    )
    selected_option_label: Optional[str] = Field(
        default=None,
        description="The exact label of the selected option, or null."
    )
    confidence: Literal["none", "low", "medium", "high"] = "none"


# ---------- File-backed portfolio state ----------
HOLDINGS_FILE = ROOT_DIR / "holdings.json"
CURRENT_RECOMMENDATION_FILE = ROOT_DIR / "current_recommendation.json"
holdings_lock = asyncio.Lock()
recommendation_lock = asyncio.Lock()


def load_holdings() -> List[Holding]:
    with open(HOLDINGS_FILE, encoding="utf-8") as holdings_file:
        return [Holding.model_validate(item) for item in json.load(holdings_file)]


def save_holdings(holdings: List[Holding]) -> None:
    temporary_file = HOLDINGS_FILE.with_suffix(".json.tmp")
    with open(temporary_file, "w", encoding="utf-8") as holdings_file:
        json.dump(
            [holding.model_dump() for holding in holdings],
            holdings_file,
            ensure_ascii=False,
            indent=2,
        )
        holdings_file.write("\n")
    os.replace(temporary_file, HOLDINGS_FILE)


def load_current_recommendation() -> Optional[dict]:
    if not CURRENT_RECOMMENDATION_FILE.exists():
        return None
    with open(CURRENT_RECOMMENDATION_FILE, encoding="utf-8") as recommendation_file:
        return json.load(recommendation_file)


def save_current_recommendation(result: QuestionnaireResult, session_id: str) -> None:
    temporary_file = CURRENT_RECOMMENDATION_FILE.with_suffix(".json.tmp")
    payload = {
        "session_id": session_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        **result.model_dump(),
    }
    with open(temporary_file, "w", encoding="utf-8") as recommendation_file:
        json.dump(payload, recommendation_file, indent=2, ensure_ascii=False)
        recommendation_file.write("\n")
    os.replace(temporary_file, CURRENT_RECOMMENDATION_FILE)

PRODUCTS: List[Product] = [
    # Stocks (European blue chips)
    Product(id="p1", ticker="ASML.AS", name="ASML Holding N.V.", category="Stocks", price=892.40, ytd_return=42.6, one_year_return=68.2, risk="High", description="Dutch semiconductor lithography leader; monopoly on EUV machines."),
    Product(id="p2", ticker="MC.PA", name="LVMH (Moët Hennessy Louis Vuitton)", category="Stocks", price=742.30, ytd_return=8.4, one_year_return=15.8, risk="Medium", description="Paris-listed global luxury conglomerate — 75+ Maisons."),
    Product(id="p3", ticker="SAP.DE", name="SAP SE", category="Stocks", price=178.60, ytd_return=24.8, one_year_return=48.6, risk="Medium", description="German enterprise software leader in ERP and cloud."),
    Product(id="p4", ticker="NOVO-B.CO", name="Novo Nordisk A/S", category="Stocks", price=112.80, ytd_return=18.5, one_year_return=42.1, risk="Medium", description="Danish pharma leader in diabetes and obesity treatments (Ozempic, Wegovy)."),
    Product(id="p5", ticker="NESN.SW", name="Nestlé S.A.", category="Stocks", price=94.30, ytd_return=-2.1, one_year_return=4.5, risk="Low", description="Swiss consumer staples giant, defensive dividend payer."),
    # Mutual Funds (UCITS)
    Product(id="p6", ticker="IE00B4L5Y983", name="iShares Core MSCI World UCITS", category="Mutual Funds", price=89.35, ytd_return=11.2, one_year_return=22.4, risk="Medium", expense_ratio=0.20, description="Diversified developed-market equity exposure. UCITS-compliant."),
    Product(id="p7", ticker="LU0274208692", name="Xtrackers MSCI Europe UCITS", category="Mutual Funds", price=78.20, ytd_return=8.6, one_year_return=14.8, risk="Medium", expense_ratio=0.12, description="Broad European large- and mid-cap equity exposure."),
    Product(id="p8", ticker="IE00B4WXJJ64", name="iShares Euro Aggregate Bond UCITS", category="Mutual Funds", price=104.80, ytd_return=1.6, one_year_return=3.8, risk="Low", expense_ratio=0.09, description="Investment-grade euro-denominated bonds across the eurozone."),
    # ETFs (UCITS)
    Product(id="p9", ticker="VWCE.DE", name="Vanguard FTSE All-World UCITS ETF", category="ETFs", price=124.85, ytd_return=10.4, one_year_return=22.8, risk="Medium", expense_ratio=0.22, description="Global equity ETF (developed + emerging), EUR-hedged available."),
    Product(id="p10", ticker="EUNL.DE", name="iShares Core MSCI World UCITS ETF", category="ETFs", price=92.40, ytd_return=11.1, one_year_return=23.4, risk="Medium", expense_ratio=0.20, description="Popular UCITS world equity ETF among European investors."),
    Product(id="p11", ticker="SXR8.DE", name="iShares Core S&P 500 UCITS ETF", category="ETFs", price=548.60, ytd_return=12.8, one_year_return=25.6, risk="Medium", expense_ratio=0.07, description="EU-domiciled S&P 500 tracker (Ireland UCITS)."),
    Product(id="p12", ticker="EXS1.DE", name="iShares Core DAX UCITS ETF", category="ETFs", price=178.20, ytd_return=9.4, one_year_return=18.2, risk="Medium", expense_ratio=0.16, description="Tracks the DAX 40 — largest listed German companies."),
    # Bonds (European sovereigns & corporates)
    Product(id="p13", ticker="EUNH.DE", name="iShares Euro Gov Bond 7-10y UCITS", category="Bonds", price=138.20, ytd_return=1.4, one_year_return=3.2, risk="Low", expense_ratio=0.15, description="Diversified eurozone government bonds, 7-10 year maturities."),
    Product(id="p14", ticker="IBGL.L", name="iShares German Bund 25+ UCITS", category="Bonds", price=82.40, ytd_return=-1.8, one_year_return=0.6, risk="Medium", expense_ratio=0.15, description="Long-duration German Bunds — flagship EU safe-haven asset."),
    Product(id="p15", ticker="IEAC.L", name="iShares Euro Corporate Bond UCITS", category="Bonds", price=124.60, ytd_return=1.2, one_year_return=3.4, risk="Low", expense_ratio=0.20, description="Investment-grade euro-denominated corporate bonds."),
    # Crypto
    Product(id="p16", ticker="BTC", name="Bitcoin", category="Crypto", price=59200.00, ytd_return=48.2, one_year_return=136.4, risk="High", description="Original decentralised digital currency. MiCA-regulated in EU."),
    Product(id="p17", ticker="ETH", name="Ethereum", category="Crypto", price=3120.00, ytd_return=44.6, one_year_return=92.8, risk="High", description="Smart-contract platform powering Web3 apps."),
    Product(id="p18", ticker="SOL", name="Solana", category="Crypto", price=152.80, ytd_return=62.4, one_year_return=198.6, risk="High", description="High-throughput blockchain for DeFi and consumer apps."),
]

QUESTIONS = [
    {"id": "q1", "text": "What is your primary investment goal?",
     "options": [
         {"label": "Preserve capital and avoid losses", "value": 1},
         {"label": "Generate steady income", "value": 2},
         {"label": "Balanced growth with moderate risk", "value": 3},
         {"label": "Aggressive growth, maximize returns", "value": 4},
     ]},
    {"id": "q2", "text": "How long can you keep this money invested?",
     "options": [
         {"label": "Less than 2 years", "value": 1},
         {"label": "2 to 5 years", "value": 2},
         {"label": "5 to 10 years", "value": 3},
         {"label": "More than 10 years", "value": 4},
     ]},
    {"id": "q3", "text": "If your portfolio dropped 20% in a month, you would:",
     "options": [
         {"label": "Sell everything to prevent more loss", "value": 1},
         {"label": "Sell some holdings", "value": 2},
         {"label": "Hold and wait for recovery", "value": 3},
         {"label": "Buy more at lower prices", "value": 4},
     ]},
    {"id": "q4", "text": "What percentage of your total savings is this investment?",
     "options": [
         {"label": "More than 75%", "value": 1},
         {"label": "50% to 75%", "value": 2},
         {"label": "25% to 50%", "value": 3},
         {"label": "Less than 25%", "value": 4},
     ]},
    {"id": "q5", "text": "Your investment experience is best described as:",
     "options": [
         {"label": "Novice - Very limited experience", "value": 1},
         {"label": "Some experience with basic products", "value": 2},
         {"label": "Comfortable with stocks and funds", "value": 3},
         {"label": "Advanced - active investor", "value": 4},
     ]},
]


# ---------- Helpers ----------
def compute_portfolio_summary() -> PortfolioSummary:
    holdings = load_holdings()
    total_invested = sum(h.shares * h.avg_cost for h in holdings)
    net_worth = sum(h.shares * h.current_price for h in holdings)
    total_gain = net_worth - total_invested
    total_gain_pct = (total_gain / total_invested) * 100 if total_invested else 0.0
    day_change = sum(h.shares * h.current_price * (h.day_change_pct / 100) for h in holdings)
    day_change_pct = (day_change / net_worth) * 100 if net_worth else 0.0

    allocation_map: dict = {}
    for h in holdings:
        val = h.shares * h.current_price
        allocation_map[h.category] = allocation_map.get(h.category, 0.0) + val
    allocation = [
        {"category": k, "value": round(v, 2), "percentage": round((v / net_worth) * 100, 2)}
        for k, v in allocation_map.items()
    ]

    # Fake 12-month performance curve building up to net_worth
    performance = []
    base = total_invested
    months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"]
    growth_factors = [0.98, 1.02, 1.04, 1.03, 1.06, 1.08, 1.05, 1.10, 1.12, 1.15, 1.18, net_worth / total_invested]
    running = base
    for i, m in enumerate(months):
        running = base * growth_factors[i]
        performance.append({"month": m, "value": round(running, 2)})

    return PortfolioSummary(
        net_worth=round(net_worth, 2),
        total_invested=round(total_invested, 2),
        total_gain=round(total_gain, 2),
        total_gain_pct=round(total_gain_pct, 2),
        day_change=round(day_change, 2),
        day_change_pct=round(day_change_pct, 2),
        allocation=allocation,
        performance=performance,
        holdings=holdings,
    )


def compute_questionnaire(answers: List[QuestionnaireAnswer]) -> QuestionnaireResult:
    answer_map = {answer.question_id: answer.value for answer in answers}
    total = sum(a.value for a in answers)
    horizon_value = answer_map.get("q2", 2)
    horizon = "Short-term" if horizon_value == 1 else "Medium-term" if horizon_value == 2 else "Long-term"

    risk_values = [answer_map.get(question_id, 2) for question_id in ("q1", "q3", "q4", "q5")]
    risk_score = sum(risk_values)
    risk = "Conservative" if risk_score <= 7 else "Balanced" if risk_score <= 12 else "Aggressive"

    objective_value = answer_map.get("q1", 2)
    objective = next(
        option["label"] for option in QUESTIONS[0]["options"] if option["value"] == objective_value
    )
    profile = next(
        item
        for item in RECOMMENDATION_PROFILES
        if item["horizon"] == horizon and item["risk_profile"] == risk
    )
    profile_id = f"{horizon.lower().replace('-term', '')}-{risk.lower()}"
    experience_value = answer_map.get("q5", 2)
    knowledge = (
        "BEGINNER" if experience_value == 1
        else "INTERMEDIATE" if experience_value in (2, 3)
        else "ADVANCED"
    )
    experience = {
        1: "Less than 1 year",
        2: "1-3 Years",
        3: "3-5 Years",
        4: "5+ Years",
    }[experience_value]

    return QuestionnaireResult(
        total_score=total,
        profile_id=profile_id,
        primary_objective=objective,
        horizon=horizon,
        risk_profile=risk,
        recommendation=profile["recommendation"],
        allocation_suggestion=profile["allocation_suggestion"],
        knowledge=knowledge,
        experience=experience,
        esg_preference="NO",
    )


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Investment Portfolio API"}


@api_router.get("/era/voice/status")
async def era_voice_status():
    """Tell the frontend whether high-quality OpenAI speech is available."""
    return {
        "configured": bool(OPENAI_API_KEY),
        "provider": "openai",
        "model": ERA_TTS_MODEL,
    }


@api_router.post("/era/voice/speech")
async def create_era_speech(req: EraSpeechRequest):
    """Generate raw 24 kHz PCM for Era's local audio-reactive animation."""
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="OpenAI speech is not configured. Add OPENAI_API_KEY.",
        )

    spoken_text = (
        req.text.replace("ERA", "Era")
        .replace("*", "")
        .replace("_", "")
        .replace("#", "")
        .replace("`", "")
        .strip()
    )
    try:
        async with httpx.AsyncClient(timeout=60) as http_client:
            response = await http_client.post(
                "https://api.openai.com/v1/audio/speech",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": ERA_TTS_MODEL,
                    "voice": ERA_TTS_VOICE,
                    "input": spoken_text,
                    "instructions": (
                        "Speak as a warm, polished female European relationship manager. "
                        "Sound natural, attentive, and conversational. Pronounce Era as "
                        "'Eer-ah'. Use measured pacing and subtle, reassuring expression."
                    ),
                    "response_format": "pcm",
                },
            )
        response.raise_for_status()
        return {"audio": base64.b64encode(response.content).decode("ascii")}
    except httpx.HTTPStatusError as exc:
        logger.exception("OpenAI text-to-speech request failed")
        raise HTTPException(
            status_code=exc.response.status_code,
            detail="Era's natural speech could not be generated.",
        ) from exc
    except Exception as exc:
        logger.exception("Era speech generation failed")
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@api_router.get("/portfolio", response_model=PortfolioSummary)
async def get_portfolio():
    return compute_portfolio_summary()


@api_router.post("/portfolio/holdings/{ticker}/trade", response_model=PortfolioSummary)
async def trade_holding(ticker: str, trade: HoldingTrade):
    async with holdings_lock:
        holdings = load_holdings()
        holding = next(
            (item for item in holdings if item.ticker.lower() == ticker.lower()),
            None,
        )
        if holding is None:
            if trade.side == "sell":
                raise HTTPException(status_code=404, detail="Holding not found.")
            if not trade.name or not trade.category or not trade.current_price:
                raise HTTPException(
                    status_code=400,
                    detail="Product details are required when creating a new holding.",
                )
            holding = Holding(
                ticker=ticker,
                name=trade.name,
                category=trade.category,
                shares=0,
                avg_cost=trade.execution_price or trade.current_price,
                current_price=trade.current_price,
                day_change_pct=trade.day_change_pct,
            )
            holdings.append(holding)
        if trade.side == "sell" and trade.quantity > holding.shares:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot sell {trade.quantity:g}; only {holding.shares:g} available.",
            )

        if trade.side == "buy":
            previous_cost = holding.shares * holding.avg_cost
            added_cost = trade.quantity * (trade.execution_price or holding.current_price)
            holding.shares += trade.quantity
            holding.avg_cost = (previous_cost + added_cost) / holding.shares
        else:
            holding.shares -= trade.quantity

        if holding.shares <= 1e-9:
            holdings = [item for item in holdings if item.ticker != holding.ticker]
        save_holdings(holdings)
        return compute_portfolio_summary()


@api_router.get("/products", response_model=List[Product])
async def get_products(category: Optional[str] = None):
    if category and category != "All":
        return [p for p in PRODUCTS if p.category == category]
    return PRODUCTS


@api_router.get("/recommendations")
async def get_recommendations(
    horizon: Literal["Short-term", "Medium-term", "Long-term"],
    risk_profile: Literal["Conservative", "Balanced", "Aggressive"],
):
    return next(
        profile
        for profile in RECOMMENDATION_PROFILES
        if profile["horizon"] == horizon and profile["risk_profile"] == risk_profile
    )


@api_router.get("/recommendations/current")
async def get_current_recommendation():
    recommendation = load_current_recommendation()
    if recommendation is None:
        raise HTTPException(
            status_code=404,
            detail="Complete Financial Objectives to receive ranked product recommendations.",
        )
    return recommendation


@api_router.get("/questionnaire/questions")
async def get_questions():
    return {"questions": QUESTIONS}


@api_router.post("/questionnaire/submit", response_model=QuestionnaireResult)
async def submit_questionnaire(sub: QuestionnaireSubmission):
    result = compute_questionnaire(sub.answers)
    session_id = sub.session_id or str(uuid.uuid4())
    # Save to db
    doc = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "answers": [a.model_dump() for a in sub.answers],
        "result": result.model_dump(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.questionnaire_submissions.insert_one(doc)
    async with recommendation_lock:
        save_current_recommendation(result, session_id)
    return result


@api_router.post("/contextual-insights")
async def contextual_insights(request: ContextualInsightRequest):
    """Attach the definitive portfolio snapshot and delegate insight generation."""
    contextual_api_url = os.environ.get(
        "CONTEXTUAL_INVESTMENT_API_URL",
        "http://localhost:8080/api/contextual-insights",
    )
    payload = request.model_dump()
    portfolio = compute_portfolio_summary()
    payload["portfolioContext"] = {
        "netWorth": portfolio.net_worth,
        "totalInvested": portfolio.total_invested,
        "totalGain": portfolio.total_gain,
        "totalGainPct": portfolio.total_gain_pct,
        "holdings": [
            {
                "ticker": holding.ticker,
                "name": holding.name,
                "category": holding.category,
                "shares": holding.shares,
                "avgCost": holding.avg_cost,
                "currentPrice": holding.current_price,
                "dayChangePct": holding.day_change_pct,
            }
            for holding in portfolio.holdings
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=60) as contextual_client:
            response = await contextual_client.post(contextual_api_url, json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as error:
        detail = error.response.text or "Contextual investment API rejected the request."
        raise HTTPException(status_code=502, detail=detail) from error
    except httpx.RequestError as error:
        raise HTTPException(
            status_code=503,
            detail="Contextual investment insights are temporarily unavailable.",
        ) from error


@api_router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    system_msg = (
        "Role: You are Era, the customer's warm, professional digital Relationship Manager in a European retail-investing app. "
        "Personality: warm, calm, concise, and conversational because every reply may be spoken aloud. "
        "Goal: understand the customer's needs and guide them naturally through the current financial-objectives question, "
        "like a helpful human relationship manager. Do not describe yourself as a system that proposes, matches, or selects "
        "on-screen choices. "
        "Strict scope: discuss only the current on-screen question, its available choices, the customer's financial "
        "objectives, risk, horizon, investing experience, portfolio, or relevant European investment concepts. "
        "For greetings or any unrelated, off-topic, joking, abusive, political, entertainment, coding, general-knowledge, "
        "or non-financial request, reply with exactly: 'Sorry, I could not understand.' Do not answer or engage with it. "
        "Ask the question naturally, explain it in plain language when needed, and listen to the customer's answer. "
        "When their answer clearly matches one available option, return exactly that option as a proposed choice, "
        "but do not claim it is already selected. Tell the customer which option you recommend and ask a short, "
        "explicit confirmation question such as, 'Shall I select that and continue?' "
        "If the questionnaire context contains pending_proposal, the app is waiting for confirmation of that choice. "
        "If the customer's reply is not a clear yes or no, ask again for an explicit yes-or-no confirmation. "
        "If they ask what the proposal or question means, explain it briefly in plain language, then ask again whether "
        "you should select the pending choice and continue. Keep returning that same proposed option unless the customer "
        "clearly changes their underlying answer. "
        "If their answer is close to one available option but could be a transcription error or needs confirmation, "
        "set selected_option_value to that likely option and ask one short confirmation question, for example, "
        "'Did you mean that your goal is to generate steady income?' This lets the app retain the proposed choice "
        "while it waits for yes or no. Only leave the selection empty when no available option is a reasonable match. "
        "Only the app applies the proposal after the customer confirms it. "
        "Never invent an option, never select a value outside the supplied choices, never guarantee returns, "
        "and do not provide regulated personalized financial advice. Use EUR and European-investor context where relevant. "
        "Keep ordinary replies to 1-3 short sentences."
    )
    if req.language and req.language.lower() not in ("english", "en"):
        system_msg += (
            f"\n\nIMPORTANT: Respond ONLY in {req.language}. "
            f"Use natural, native-sounding phrasing of a fluent {req.language} speaker. "
            "Even if the user writes in another language, always reply in "
            f"{req.language}."
        )
    if req.portfolio_context:
        system_msg += f"\n\nUser portfolio context: {req.portfolio_context}"
    if req.questionnaire_context:
        system_msg += (
            "\n\nCurrent on-screen questionnaire context:\n"
            + json.dumps(req.questionnaire_context, ensure_ascii=False)
        )

    async def event_generator():
        try:
            context = req.questionnaire_context or {}
            allowed_options = context.get("options") or []

            def normalize_choice(value):
                return re.sub(r"[^a-z0-9]+", " ", str(value).lower()).strip()

            def is_direct_option_response(message, option_label):
                normalized_message = normalize_choice(message)
                normalized_label = normalize_choice(option_label)
                without_lead_in = re.sub(
                    r"^(?:i want to|i want|my goal is|i would like to|i would like|please select|select|choose|go with|i prefer)\s+",
                    "",
                    normalized_message,
                )
                without_politeness = re.sub(
                    r"\s+(?:please|thanks|thank you)$", "", without_lead_in
                ).strip()
                return without_politeness == normalized_label

            exact_option = next(
                (
                    option
                    for option in allowed_options
                    if isinstance(option, dict)
                    and is_direct_option_response(req.message, option.get("label", ""))
                ),
                None,
            )
            if exact_option and context.get("question_id"):
                exact_message = "Understood. I’ll continue."
                now = datetime.now(timezone.utc).isoformat()
                await db.chat_messages.insert_many([
                    {"id": str(uuid.uuid4()), "session_id": req.session_id, "role": "user",
                     "content": req.message, "timestamp": now},
                    {"id": str(uuid.uuid4()), "session_id": req.session_id, "role": "assistant",
                     "content": exact_message, "timestamp": now},
                ])
                action = {
                    "question_id": context["question_id"],
                    "value": exact_option.get("value"),
                    "label": exact_option.get("label"),
                    "confidence": "high",
                    "confirmed": True,
                    "exact_match": True,
                }
                yield f"event: message\ndata: {json.dumps({'text': exact_message}, ensure_ascii=False)}\n\n"
                yield f"event: questionnaire_action\ndata: {json.dumps(action, ensure_ascii=False)}\n\n"
                yield "event: done\ndata: {}\n\n"
                return

            if openai_client is None:
                raise RuntimeError(
                    "OpenAI is not configured. Add OPENAI_API_KEY to backend/.env and restart the backend."
                )

            history = await db.chat_messages.find(
                {"session_id": req.session_id},
                {"_id": 0, "role": 1, "content": 1},
            ).sort("timestamp", -1).limit(10).to_list(10)
            history.reverse()
            model_input = [
                {"role": item["role"], "content": item["content"]}
                for item in history
                if item.get("role") in ("user", "assistant") and item.get("content")
            ]
            model_input.append({"role": "user", "content": req.message})

            response = await openai_client.responses.parse(
                model=OPENAI_MODEL,
                instructions=system_msg,
                input=model_input,
                text_format=EraTurn,
                reasoning={"effort": "low"},
                text={"verbosity": "low"},
                max_output_tokens=300,
                store=False,
            )
            turn = response.output_parsed
            if turn is None:
                raise RuntimeError("OpenAI returned no structured response.")

            action = None
            allowed_by_value = {
                option.get("value"): option.get("label")
                for option in allowed_options
                if isinstance(option, dict)
            }
            if (
                turn.selected_option_value is not None
                and turn.selected_option_value in allowed_by_value
                and context.get("question_id")
            ):
                action = {
                    "question_id": context["question_id"],
                    "value": turn.selected_option_value,
                    "label": allowed_by_value[turn.selected_option_value],
                    "confidence": turn.confidence,
                }

            now = datetime.now(timezone.utc).isoformat()
            await db.chat_messages.insert_many([
                {"id": str(uuid.uuid4()), "session_id": req.session_id, "role": "user",
                 "content": req.message, "timestamp": now},
                {"id": str(uuid.uuid4()), "session_id": req.session_id, "role": "assistant",
                 "content": turn.message, "timestamp": now},
            ])

            yield f"event: message\ndata: {json.dumps({'text': turn.message}, ensure_ascii=False)}\n\n"
            if action:
                yield f"event: questionnaire_action\ndata: {json.dumps(action, ensure_ascii=False)}\n\n"
            yield "event: done\ndata: {}\n\n"
        except Exception as e:
            logger.exception("OpenAI chat turn failed")
            error_message = str(e)
            yield f"event: error\ndata: {json.dumps({'message': error_message})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@api_router.get("/chat/history/{session_id}")
async def chat_history(session_id: str):
    docs = await db.chat_messages.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("timestamp", 1).to_list(500)
    return {"messages": docs}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
