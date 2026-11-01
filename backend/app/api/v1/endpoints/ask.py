import logging

try:
    from fastapi import APIRouter, Depends, HTTPException
except ImportError:
    raise ImportError(
        "fastapi is not installed. Please install it with: pip install fastapi"
    )
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import engine, get_db
from app.schemas.ask import AskRequest, AskResponse
from app.services.explain_service import ExplainService
from app.services.financial_validation import FinancialSeriesValidator
from app.services.insight_engine import InsightEngine
from app.services.llm_service import LLMService
from app.services.rag_service import SchemaRAGService
from app.services.sql_executor import SQLExecutor
from app.services.sql_guard import SQLGuard
from app.services.visualization_recommender import VisualizationRecommender

logger = logging.getLogger(__name__)
router = APIRouter()

llm_service = LLMService()
rag_service = SchemaRAGService()
sql_guard = SQLGuard()
sql_executor = SQLExecutor()
explain_service = ExplainService()
financial_validator = FinancialSeriesValidator()
insight_engine = InsightEngine()
viz_recommender = VisualizationRecommender()


def _build_visualization_data(rows: list[dict]) -> list[dict]:
    """Legacy visualization data builder for backward compatibility."""
    if not rows:
        return []
    if "period" in rows[0]:
        return sorted(rows, key=lambda r: str(r.get("period", "")))
    return rows


@router.post("/ask", response_model=AskResponse)
def ask(
    payload: AskRequest,
    db: Session = Depends(get_db),
    _current_user: str = Depends(get_current_user),
) -> AskResponse:
    """Enhanced intelligent /ask endpoint with dynamic response generation."""
    try:
        # Step 1: Get database schema context
        schema_context = rag_service.get_schema_context(engine)

        # Step 2: Plan the query (intent understanding)
        query_plan = llm_service.query_planner.plan(payload.question)
        intent = query_plan.intent
        logger.info(f"[ASK] Intent: {intent}, Metric: {query_plan.metric}, Operation: {query_plan.operation}")

        # Step 3: Generate and validate SQL
        raw_sql = llm_service.question_to_sql(payload.question, schema_context)
        safe_sql = sql_guard.validate(raw_sql)

        # Step 4: Execute query
        rows = sql_executor.execute(db, safe_sql)
        rows = financial_validator.clean_output_rows(rows)
        financial_validator.validate_financial_series(rows)

        # Step 5: Detect currency and period coverage
        currency = _detect_currency_from_rows(rows)
        period_coverage = _detect_period_coverage(rows)

        # Step 6: Generate intelligent insights
        insights = insight_engine.generate_insights(rows, intent, payload.question)
        kpis = insight_engine.generate_kpis(rows, intent, query_plan.metric)

        # Step 7: Recommend visualizations
        visualizations = viz_recommender.recommend(rows, intent, payload.question)

        # Step 8: Generate contextual explanation
        explanation = explain_service.explain(safe_sql, rows, intent)

        # Step 9: Generate answer text
        answer_text = _generate_answer_text(
            rows,
            intent,
            query_plan.metric,
            explanation,
        )

        # Step 10: Build enhanced response
        return AskResponse(
            question=payload.question,
            intent=intent,
            sql=safe_sql,
            execution_method="sql",
            answer_text=answer_text,
            table=rows if len(rows) > 0 and len(rows) <= 100 else None,
            kpis=kpis if kpis else None,
            visualizations=visualizations if visualizations else None,
            insights=insights if insights else None,
            data_source="financial_facts",
            period_coverage=period_coverage,
            currency=currency,
            confidence=query_plan.confidence,
            limitations=_check_data_limitations(rows),
            follow_up_suggestions=_generate_follow_ups(intent, query_plan.metric),
            # Backward compatibility
            explanation=explanation,
            rows=rows,
            visualization_data=_build_visualization_data(rows),
        )

    except ValueError as exc:
        logger.warning(f"[ASK] Validation error: {exc}")
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("[ASK] Query failed")
        raise HTTPException(status_code=500, detail=f"Ask query failed: {exc}") from exc


def _detect_currency_from_rows(rows: list[dict]) -> str | None:
    """Detect currency from row data."""
    if not rows:
        return None
    first_row = rows[0]
    if "currency" in first_row:
        return str(first_row["currency"])
    return None


def _detect_period_coverage(rows: list[dict]) -> str | None:
    """Detect time period coverage."""
    if not rows:
        return None

    period_keys = ["period", "year", "month", "date", "quarter"]
    period_col = None
    for key in period_keys:
        if key in rows[0]:
            period_col = key
            break

    if period_col:
        periods = [str(r[period_col]) for r in rows if r.get(period_col)]
        if len(periods) >= 2:
            return f"{periods[0]} to {periods[-1]}"
        elif len(periods) == 1:
            return periods[0]

    return None


def _generate_answer_text(
    rows: list[dict],
    intent: str,
    metric: str | None,
    explanation: str,
) -> str:
    """Generate primary answer text."""
    if not rows:
        return "No data found matching your query."

    # Build answer based on intent
    if intent in ["total", "sum", "aggregate"]:
        return f"Here are the aggregated results. {explanation}"
    elif intent in ["trend", "growth"]:
        return f"Trend analysis complete. {explanation}"
    elif intent in ["comparison", "compare"]:
        return f"Comparison results are ready. {explanation}"
    elif len(rows) == 1:
        return f"Found 1 matching record. {explanation}"
    else:
        return f"Retrieved {len(rows)} records. {explanation}"


def _check_data_limitations(rows: list[dict]) -> list[str] | None:
    """Check for data quality issues."""
    if not rows:
        return ["No data available"]

    limitations = []

    # Check for null values
    null_count = sum(1 for row in rows for val in row.values() if val is None)
    if null_count > len(rows) * len(rows[0]) * 0.3:  # >30% nulls
        limitations.append("Some data values are missing or incomplete")

    # Check for single data point
    if len(rows) == 1:
        limitations.append("Limited to a single data point; trend analysis not possible")

    return limitations if limitations else None


def _generate_follow_ups(intent: str, metric: str | None) -> list[str] | None:
    """Generate contextual follow-up suggestions."""
    suggestions = []

    if intent in ["lookup", "value"]:
        suggestions.append("Show me the trend over time")
        if metric:
            suggestions.append(f"Compare {metric} with other metrics")

    elif intent in ["trend"]:
        suggestions.append("What are the year-over-year growth rates?")
        suggestions.append("Which period had the highest value?")

    elif intent in ["comparison"]:
        suggestions.append("Show me the percentage breakdown")
        suggestions.append("Which has grown faster?")

    return suggestions[:3] if suggestions else None
