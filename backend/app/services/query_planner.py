"""
AI query understanding layer for Asklytics financial Q&A.

IMPORTANT:
- The model ONLY interprets the user's language.
- It does NOT calculate financial values.
- It does NOT generate SQL.
- The existing deterministic SQL/formula layer remains responsible for numbers.

Pipeline:
user question -> QueryPlanner -> normalized question -> existing SQL templates
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from openai import OpenAI
from pydantic import BaseModel, Field, ValidationError

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class QueryPlan(BaseModel):
    """Enhanced query understanding contract."""

    normalized_question: str = Field(min_length=1, max_length=500)
    intent: str = Field(default="lookup", max_length=80)
    metric: str | None = Field(default=None, max_length=80)
    operation: str = Field(default="value", max_length=80)
    period: str | None = Field(default=None, max_length=120)
    comparison: str | None = Field(default=None, max_length=80)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    needs_clarification: bool = False
    clarification_question: str | None = Field(default=None, max_length=300)
    requires_sql: bool = Field(default=True)
    visualization_hint: str | None = Field(default=None, max_length=100)
    aggregation_type: str | None = Field(default=None, max_length=50)


class QueryPlanner:
    """Uses the configured OpenAI model only for semantic query normalization."""

    SYSTEM_PROMPT = """
You are the query-understanding layer for a financial analytics application.
Your job is to understand natural-language financial questions and normalize them
for a deterministic SQL/formula engine.

NEVER calculate a financial number.
NEVER write SQL.
NEVER invent a metric that is not requested.
Return JSON only.

Supported canonical metric names include:
- revenue
- net profit
- expenses
- gross profit
- gross margin
- operating margin
- ebitda margin
- net margin
- roe
- roa
- roce
- current ratio
- quick ratio
- debt to equity
- interest coverage
- asset turnover
- inventory days
- receivable days
- payable days
- eps
- pe ratio

Important financial synonyms:
- top line / sales / turnover / operating revenue -> revenue
- bottom line / PAT / profit after tax / net earnings / net income -> net profit
- GP margin / gross profit percentage -> gross margin
- operating profit percentage -> operating margin
- NPM / net profit percentage -> net margin
- TIE / times interest earned -> interest coverage
- D/E / gearing -> debt to equity when the context is financial statements
- DSO -> receivable days
- DPO -> payable days
- DIO -> inventory days

Period normalization:
- latest / most recent -> latest
- last N years / past N years / previous N years -> last N years
- recent N years -> last N years
- FY2024 / financial year 2024 -> FY2024
- from 2021 to 2024 -> from 2021 to 2024
- latest year vs previous year -> latest year vs previous year

Follow the user's requested operation:
- trend / over time / progression -> trend
- growth / YoY / year over year -> growth
- average / mean -> average
- total / sum / combined -> total
- highest / maximum / peak / best -> highest
- lowest / minimum / bottom / worst -> lowest
- compare -> comparison
- list/show values -> value

If the question is genuinely ambiguous about the metric (for example, "show me
performance"), set needs_clarification=true and provide a short clarification question.
Do not guess in that case.

Output exactly these JSON fields:
{
  "normalized_question": "...",
  "intent": "lookup|trend|growth|comparison|superlative|ratio|summary|clarification",
  "metric": "canonical metric or null",
  "operation": "value|trend|growth|average|total|highest|lowest|comparison|summary",
  "period": "normalized period phrase or null",
  "comparison": "normalized comparison phrase or null",
  "confidence": 0.0,
  "needs_clarification": false,
  "clarification_question": null
}
""".strip()

    def __init__(self) -> None:
        settings = get_settings()
        self.client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
        self.model = settings.openai_model

    @staticmethod
    def _extract_json(text: str) -> dict[str, Any] | None:
        raw = (text or "").strip()
        if not raw:
            return None

        # Direct JSON first.
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            pass

        # Then tolerate a fenced JSON response.
        fenced = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw, flags=re.IGNORECASE)
        if fenced:
            try:
                parsed = json.loads(fenced.group(1))
                return parsed if isinstance(parsed, dict) else None
            except Exception:
                pass

        # Last-resort object extraction.
        obj = re.search(r"\{[\s\S]*\}", raw)
        if not obj:
            return None
        try:
            parsed = json.loads(obj.group(0))
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None

    @staticmethod
    def _normalize_without_ai(question: str) -> QueryPlan:
        """Safe fallback when OpenAI is unavailable or returns invalid JSON."""
        q = " ".join((question or "").strip().lower().split())
        replacements = [
            (r"\btop line\b", "revenue"),
            (r"\bturnover\b", "revenue"),
            (r"\bsales\b", "revenue"),
            (r"\bbottom line\b", "net profit"),
            (r"\bpat\b", "net profit"),
            (r"\bprofit after tax\b", "net profit"),
            (r"\bnet earnings?\b", "net profit"),
            (r"\bnet income\b", "net profit"),
            (r"\brecent\s+(\d+)\s+years?\b", r"last \1 years"),
            (r"\bpast\s+(\d+)\s+years?\b", r"last \1 years"),
            (r"\bprevious\s+(\d+)\s+years?\b", r"last \1 years"),
            (r"\bmost recent\b", "latest"),
            (r"\bmost recent year\b", "latest year"),
            (r"\baverage\b", "average"),
            (r"\bmean\b", "average"),
            (r"\byear over year\b", "yoy"),
            (r"\byear-on-year\b", "yoy"),
        ]
        for pattern, replacement in replacements:
            q = re.sub(pattern, replacement, q)

        metric = None
        metric_aliases = [
            ("gross margin", ["gross margin", "gross profit margin", "gp margin"]),
            ("operating margin", ["operating margin", "operating profit margin"]),
            ("ebitda margin", ["ebitda margin"]),
            ("net margin", ["net margin", "net profit margin", "npm"]),
            ("current ratio", ["current ratio", "working capital ratio"]),
            ("quick ratio", ["quick ratio", "acid test ratio"]),
            ("debt to equity", ["debt to equity", "debt/equity", "d/e"]),
            ("interest coverage", ["interest coverage", "interest cover", "times interest earned", "tie ratio"]),
            ("receivable days", ["receivable days", "days sales outstanding", "dso"]),
            ("payable days", ["payable days", "days payable", "dpo"]),
            ("inventory days", ["inventory days", "days inventory", "dio"]),
            ("asset turnover", ["asset turnover"]),
            ("revenue", ["revenue"]),
            ("net profit", ["net profit", "profit"]),
            ("expenses", ["expenses", "expense", "costs", "cost"]),
            ("roe", ["roe", "return on equity"]),
            ("roa", ["roa", "return on assets"]),
            ("roce", ["roce", "return on capital employed"]),
            ("eps", ["eps", "earnings per share"]),
            ("pe ratio", ["pe ratio", "p/e ratio", "price to earnings"]),
        ]
        for canonical, aliases in metric_aliases:
            if any(alias in q for alias in aliases):
                metric = canonical
                break

        operation = "value"
        intent = "lookup"
        if any(x in q for x in ("highest", "maximum", "peak", "best", "top")):
            operation, intent = "highest", "superlative"
        elif any(x in q for x in ("lowest", "minimum", "bottom", "worst")):
            operation, intent = "lowest", "superlative"
        elif "compare" in q or "versus" in q or " vs " in q:
            operation, intent = "comparison", "comparison"
        elif any(x in q for x in ("yoy", "growth", "year over year")):
            operation, intent = "growth", "growth"
        elif any(x in q for x in ("trend", "over time", "progression", "over years", "over months")):
            operation, intent = "trend", "trend"
        elif any(x in q for x in ("average", "mean", "avg")):
            operation = "average"
        elif any(x in q for x in ("total", "sum", "combined", "aggregate")):
            operation = "total"

        return QueryPlan(
            normalized_question=q,
            intent=intent,
            metric=metric,
            operation=operation,
            confidence=0.55 if metric else 0.25,
        )

    def plan(self, question: str) -> QueryPlan:
        fallback = self._normalize_without_ai(question)
        if not self.client:
            return fallback

        try:
            response = self.client.responses.create(
                model=self.model,
                input=[
                    {"role": "system", "content": self.SYSTEM_PROMPT},
                    {"role": "user", "content": question.strip()},
                ],
                temperature=0,
            )
            raw = self._extract_json(response.output_text)
            if not raw:
                logger.warning("[QUERY PLANNER] Model returned non-JSON; using fallback")
                return fallback

            plan = QueryPlan.model_validate(raw)
            if not plan.normalized_question.strip():
                return fallback
            return plan
        except (ValidationError, ValueError, TypeError) as exc:
            logger.warning("[QUERY PLANNER] Invalid plan: %s", exc)
            return fallback
        except Exception as exc:
            logger.exception("[QUERY PLANNER] AI planning failed: %s", exc)
            return fallback
