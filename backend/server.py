from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]

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
    submission_id: Optional[str] = None
    total_score: int
    horizon: Literal["Short-term", "Medium-term", "Long-term"]
    risk_profile: Literal["Conservative", "Balanced", "Aggressive"]
    recommendation: str
    allocation_suggestion: List[dict]


class ChatRequest(BaseModel):
    message: str
    session_id: str
    portfolio_context: Optional[dict] = None


# ---------- Static/mock data ----------
PORTFOLIO_HOLDINGS = [
    Holding(ticker="ASML.AS", name="ASML Holding N.V.", category="Stocks", shares=18, avg_cost=620.00, current_price=892.40, day_change_pct=1.42),
    Holding(ticker="MC.PA", name="LVMH Moët Hennessy Louis Vuitton", category="Stocks", shares=12, avg_cost=680.00, current_price=742.30, day_change_pct=-0.35),
    Holding(ticker="SAP.DE", name="SAP SE", category="Stocks", shares=40, avg_cost=112.00, current_price=178.60, day_change_pct=0.68),
    Holding(ticker="VWCE.DE", name="Vanguard FTSE All-World UCITS ETF", category="ETFs", shares=85, avg_cost=98.20, current_price=124.85, day_change_pct=0.52),
    Holding(ticker="IMEU.L", name="iShares Core MSCI Europe UCITS ETF", category="ETFs", shares=120, avg_cost=56.40, current_price=68.72, day_change_pct=0.44),
    Holding(ticker="IE00B4L5Y983", name="iShares Core MSCI World UCITS Fund", category="Mutual Funds", shares=95, avg_cost=68.10, current_price=89.35, day_change_pct=0.61),
    Holding(ticker="EUNH.DE", name="iShares Euro Government Bond 7-10y UCITS", category="Bonds", shares=180, avg_cost=142.50, current_price=138.20, day_change_pct=-0.14),
    Holding(ticker="BTC", name="Bitcoin", category="Crypto", shares=0.28, avg_cost=28500.00, current_price=59200.00, day_change_pct=2.65),
    Holding(ticker="ETH", name="Ethereum", category="Crypto", shares=2.1, avg_cost=1620.00, current_price=3120.00, day_change_pct=1.78),
]

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
    total_invested = sum(h.shares * h.avg_cost for h in PORTFOLIO_HOLDINGS)
    net_worth = sum(h.shares * h.current_price for h in PORTFOLIO_HOLDINGS)
    total_gain = net_worth - total_invested
    total_gain_pct = (total_gain / total_invested) * 100 if total_invested else 0.0
    day_change = sum(h.shares * h.current_price * (h.day_change_pct / 100) for h in PORTFOLIO_HOLDINGS)
    day_change_pct = (day_change / net_worth) * 100 if net_worth else 0.0

    allocation_map: dict = {}
    for h in PORTFOLIO_HOLDINGS:
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
        holdings=PORTFOLIO_HOLDINGS,
    )


def compute_questionnaire(answers: List[QuestionnaireAnswer]) -> QuestionnaireResult:
    total = sum(a.value for a in answers)
    # max is 5 questions * 4 = 20, min 5
    if total <= 9:
        horizon = "Short-term"
        risk = "Conservative"
        rec = "Focus on capital preservation with bonds and low-risk instruments. Prioritize stability over growth."
        alloc = [
            {"category": "Bonds", "percentage": 60},
            {"category": "Mutual Funds", "percentage": 20},
            {"category": "ETFs", "percentage": 15},
            {"category": "Stocks", "percentage": 5},
        ]
    elif total <= 15:
        horizon = "Medium-term"
        risk = "Balanced"
        rec = "A balanced mix of growth and income assets suits your profile. Diversify across equities and fixed income."
        alloc = [
            {"category": "Stocks", "percentage": 35},
            {"category": "ETFs", "percentage": 25},
            {"category": "Mutual Funds", "percentage": 20},
            {"category": "Bonds", "percentage": 15},
            {"category": "Crypto", "percentage": 5},
        ]
    else:
        horizon = "Long-term"
        risk = "Aggressive"
        rec = "Your long horizon and tolerance support aggressive growth allocations weighted toward equities and alternatives."
        alloc = [
            {"category": "Stocks", "percentage": 50},
            {"category": "ETFs", "percentage": 25},
            {"category": "Crypto", "percentage": 15},
            {"category": "Mutual Funds", "percentage": 7},
            {"category": "Bonds", "percentage": 3},
        ]

    return QuestionnaireResult(
        total_score=total, horizon=horizon, risk_profile=risk,
        recommendation=rec, allocation_suggestion=alloc,
    )


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Investment Portfolio API"}


@api_router.get("/portfolio", response_model=PortfolioSummary)
async def get_portfolio():
    return compute_portfolio_summary()


@api_router.get("/products", response_model=List[Product])
async def get_products(category: Optional[str] = None):
    if category and category != "All":
        return [p for p in PRODUCTS if p.category == category]
    return PRODUCTS


@api_router.get("/questionnaire/questions")
async def get_questions():
    return {"questions": QUESTIONS}


@api_router.post("/questionnaire/submit", response_model=QuestionnaireResult)
async def submit_questionnaire(sub: QuestionnaireSubmission):
    result = compute_questionnaire(sub.answers)
    submission_id = str(uuid.uuid4())
    result.submission_id = submission_id
    # Save to db
    doc = {
        "id": submission_id,
        "session_id": sub.session_id or str(uuid.uuid4()),
        "answers": [a.model_dump() for a in sub.answers],
        "result": result.model_dump(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.questionnaire_submissions.insert_one(doc)
    return result


def _build_suitability_pdf(submission: dict) -> bytes:
    """Generate a MiFID II Suitability Statement PDF for a stored submission."""
    result = submission["result"]
    answers = submission["answers"]
    ts = submission.get("timestamp", datetime.now(timezone.utc).isoformat())
    try:
        date_str = datetime.fromisoformat(ts).strftime("%d %B %Y")
    except Exception:
        date_str = ts

    # Build a mapping of question text
    q_map = {q["id"]: q for q in QUESTIONS}

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=20 * mm, leftMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title="MiFID II Suitability Statement",
        author="Meridian EU Wealth OS",
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="H1EU", fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=colors.HexColor("#0A2540"), spaceAfter=6))
    styles.add(ParagraphStyle(name="H2EU", fontName="Helvetica-Bold", fontSize=12, leading=16, textColor=colors.HexColor("#0A2540"), spaceBefore=14, spaceAfter=6))
    styles.add(ParagraphStyle(name="MetaEU", fontName="Helvetica", fontSize=9, leading=12, textColor=colors.HexColor("#4B5563")))
    styles.add(ParagraphStyle(name="BodyEU", fontName="Helvetica", fontSize=10, leading=14, textColor=colors.HexColor("#111827"), alignment=TA_JUSTIFY))
    styles.add(ParagraphStyle(name="SmallEU", fontName="Helvetica", fontSize=8, leading=11, textColor=colors.HexColor("#4B5563")))

    story = []
    story.append(Paragraph("MERIDIAN · EU Wealth OS", styles["MetaEU"]))
    story.append(Paragraph("MiFID II Suitability Statement", styles["H1EU"]))
    story.append(Paragraph(
        f"Reference: {submission['id'][:8].upper()} &nbsp;&nbsp;·&nbsp;&nbsp; Date: {date_str}",
        styles["MetaEU"],
    ))
    story.append(Spacer(1, 10))

    # Client block
    client_tbl = Table(
        [
            [Paragraph("<b>Client</b>", styles["SmallEU"]), Paragraph("Elena Marchetti (Premium Client)", styles["BodyEU"])],
            [Paragraph("<b>Firm</b>", styles["SmallEU"]), Paragraph("Meridian EU Wealth OS (sample)", styles["BodyEU"])],
            [Paragraph("<b>Regulatory basis</b>", styles["SmallEU"]), Paragraph("Directive 2014/65/EU (MiFID II), Article 25(2) — assessment of suitability", styles["BodyEU"])],
        ],
        colWidths=[35 * mm, None],
    )
    client_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(client_tbl)

    # Intro
    story.append(Paragraph("1. Purpose", styles["H2EU"]))
    story.append(Paragraph(
        "This statement summarises the suitability assessment carried out in accordance with Article 25(2) of Directive 2014/65/EU "
        "(MiFID II) and Articles 54–55 of Commission Delegated Regulation (EU) 2017/565. It records the client's investment objectives, "
        "risk tolerance and knowledge & experience as declared through the on-platform questionnaire, and sets out the resulting "
        "recommended investment horizon and target asset allocation.",
        styles["BodyEU"],
    ))

    # Assessment answers
    story.append(Paragraph("2. Client responses", styles["H2EU"]))
    rows = [["#", "Question", "Response", "Score"]]
    for i, a in enumerate(answers, 1):
        q = q_map.get(a["question_id"])
        if not q:
            continue
        chosen = next((o["label"] for o in q["options"] if o["value"] == a["value"]), str(a["value"]))
        rows.append([
            str(i),
            Paragraph(q["text"], styles["BodyEU"]),
            Paragraph(chosen, styles["BodyEU"]),
            str(a["value"]),
        ])
    q_tbl = Table(rows, colWidths=[8 * mm, 75 * mm, 65 * mm, 12 * mm])
    q_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0A2540")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E7EB")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(q_tbl)

    # Result summary
    story.append(Paragraph("3. Suitability outcome", styles["H2EU"]))
    outcome = Table(
        [
            [Paragraph("<b>Total score</b>", styles["BodyEU"]), Paragraph(f"{result['total_score']} / 20", styles["BodyEU"])],
            [Paragraph("<b>Risk profile</b>", styles["BodyEU"]), Paragraph(result["risk_profile"], styles["BodyEU"])],
            [Paragraph("<b>Recommended horizon</b>", styles["BodyEU"]), Paragraph(result["horizon"], styles["BodyEU"])],
        ],
        colWidths=[45 * mm, None],
    )
    outcome.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E7EB")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(outcome)
    story.append(Spacer(1, 8))
    story.append(Paragraph(result["recommendation"], styles["BodyEU"]))

    # Allocation
    story.append(Paragraph("4. Recommended target allocation", styles["H2EU"]))
    alloc_rows = [["Asset class", "Target weight"]]
    for a in result["allocation_suggestion"]:
        alloc_rows.append([a["category"], f"{a['percentage']} %"])
    alloc_tbl = Table(alloc_rows, colWidths=[80 * mm, 40 * mm])
    alloc_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3F4F6")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E7EB")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(alloc_tbl)

    # Disclosures
    story.append(Paragraph("5. Important information", styles["H2EU"]))
    story.append(Paragraph(
        "The recommendation above is based solely on the information you provided. Past performance is not a reliable indicator of "
        "future results. All investments carry risk, including the possible loss of the amount invested. Products discussed are "
        "UCITS-compliant unless otherwise stated. Crypto-assets referenced are subject to Regulation (EU) 2023/1114 (MiCA).",
        styles["BodyEU"],
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Please inform us without undue delay of any material change in your financial situation, objectives or knowledge, so that this "
        "assessment can be updated in accordance with Article 54(7) of Delegated Regulation (EU) 2017/565.",
        styles["BodyEU"],
    ))

    story.append(Spacer(1, 20))
    story.append(Paragraph("Client acknowledgement", styles["H2EU"]))
    sig_tbl = Table(
        [["", ""], [Paragraph("Client signature", styles["SmallEU"]), Paragraph("Date", styles["SmallEU"])]],
        colWidths=[85 * mm, 55 * mm],
    )
    sig_tbl.setStyle(TableStyle([
        ("LINEABOVE", (0, 1), (0, 1), 0.6, colors.HexColor("#111827")),
        ("LINEABOVE", (1, 1), (1, 1), 0.6, colors.HexColor("#111827")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 24),
    ]))
    story.append(sig_tbl)

    story.append(Spacer(1, 14))
    story.append(Paragraph(
        f"This document was generated by Meridian EU Wealth OS on {date_str}. Reference: {submission['id']}.",
        styles["SmallEU"],
    ))

    doc.build(story)
    return buf.getvalue()


@api_router.get("/questionnaire/suitability/{submission_id}")
async def download_suitability(submission_id: str):
    submission = await db.questionnaire_submissions.find_one(
        {"id": submission_id}, {"_id": 0}
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    pdf_bytes = _build_suitability_pdf(submission)
    filename = f"suitability-{submission_id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    system_msg = (
        "You are Aria, a friendly, expert AI investment advisor for European retail investors on a light-professional portfolio app. "
        "Give concise, clear guidance in 2-4 sentences. Never guarantee returns. "
        "Use EUR (€) for all monetary figures. Assume UCITS ETFs, MiFID II framework, and EU-domiciled products. "
        "When discussing the user's portfolio, use the context provided. "
        "Be conversational since your response may be spoken aloud."
    )
    if req.portfolio_context:
        system_msg += f"\n\nUser portfolio context: {req.portfolio_context}"

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=req.session_id,
        system_message=system_msg,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    async def event_generator():
        full_text = ""
        try:
            async for event in chat.stream_message(UserMessage(text=req.message)):
                if isinstance(event, TextDelta):
                    full_text += event.content
                    yield f"data: {event.content}\n\n"
                elif isinstance(event, StreamDone):
                    break
        except Exception as e:
            logger.exception("chat stream failed")
            yield f"data: [error] {str(e)}\n\n"
            return

        # Persist conversation
        await db.chat_messages.insert_many([
            {"id": str(uuid.uuid4()), "session_id": req.session_id, "role": "user",
             "content": req.message, "timestamp": datetime.now(timezone.utc).isoformat()},
            {"id": str(uuid.uuid4()), "session_id": req.session_id, "role": "assistant",
             "content": full_text, "timestamp": datetime.now(timezone.utc).isoformat()},
        ])
        yield "data: [DONE]\n\n"

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
