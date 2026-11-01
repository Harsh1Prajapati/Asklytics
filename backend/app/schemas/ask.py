"""Enhanced schemas for intelligent financial analytics responses."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    """User question request."""

    question: str = Field(min_length=1, max_length=2000)
    context: dict[str, Any] | None = Field(
        default=None,
        description="Optional conversation context for follow-up questions",
    )


class KPICard(BaseModel):
    """Key performance indicator card."""

    label: str = Field(max_length=100)
    value: str | float = Field(description="Formatted value or number")
    unit: str | None = Field(default=None, max_length=20)
    change: float | None = Field(default=None, description="Percentage change")
    change_period: str | None = Field(default=None, max_length=50)
    trend: Literal["up", "down", "neutral"] | None = None
    sentiment: Literal["positive", "negative", "neutral"] | None = None


class Visualization(BaseModel):
    """Chart or visualization specification."""

    viz_type: Literal[
        "bar",
        "line",
        "pie",
        "area",
        "scatter",
        "multi_bar",
        "multi_line",
        "stacked_bar",
        "stacked_area",
    ]
    data: list[dict[str, Any]]
    title: str | None = None
    x_axis_label: str | None = None
    y_axis_label: str | None = None
    value_format: Literal["currency", "percent", "number", "integer"] = "number"
    currency: str | None = None
    show_legend: bool = True
    colors: list[str] | None = None


class Insight(BaseModel):
    """AI-generated financial insight."""

    insight_type: Literal[
        "summary",
        "trend",
        "anomaly",
        "recommendation",
        "warning",
        "comparison",
        "correlation",
    ]
    title: str | None = None
    content: str = Field(min_length=1, max_length=1000)
    severity: Literal["info", "success", "warning", "error"] | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)


class AskResponse(BaseModel):
    """Intelligent, dynamic response to financial analytics questions."""

    question: str
    intent: str = Field(
        description="Detected query intent (e.g., 'metric_lookup', 'trend_analysis', 'comparison')"
    )
    sql: str | None = Field(
        default=None,
        description="Generated SQL query (None if no SQL execution needed)",
    )
    execution_method: Literal["sql", "calculation", "retrieval", "explanation"] = Field(
        default="sql"
    )

    # Core response content
    answer_text: str = Field(
        description="Primary textual answer to the question"
    )

    # Structured data outputs
    table: list[dict[str, Any]] | None = Field(
        default=None,
        description="Tabular data when appropriate",
    )
    kpis: list[KPICard] | None = Field(
        default=None,
        description="Key performance indicators",
    )
    visualizations: list[Visualization] | None = Field(
        default=None,
        description="Recommended visualizations",
    )
    insights: list[Insight] | None = Field(
        default=None,
        description="AI-generated financial insights",
    )

    # Metadata
    data_source: str | None = Field(
        default=None,
        description="Source of data (e.g., 'financial_facts', 'uploaded_csv')",
    )
    period_coverage: str | None = Field(
        default=None,
        description="Time period covered by the response",
    )
    currency: str | None = None
    units: str | None = None
    confidence: float = Field(
        default=0.8,
        ge=0.0,
        le=1.0,
        description="Confidence in response accuracy",
    )
    limitations: list[str] | None = Field(
        default=None,
        description="Data limitations or caveats",
    )
    follow_up_suggestions: list[str] | None = Field(
        default=None,
        description="Suggested follow-up questions",
    )

    # Backward compatibility (deprecated but maintained)
    explanation: str | None = Field(
        default=None,
        description="Deprecated: use answer_text instead",
    )
    rows: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Deprecated: use table instead",
    )
    visualization_data: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Deprecated: use visualizations instead",
    )
