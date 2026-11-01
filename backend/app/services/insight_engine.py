"""
Intelligent financial insight generation.

Generates meaningful insights from query results without hallucinating numbers.
Uses actual data to produce summaries, trends, anomalies, and recommendations.
"""

import logging
import statistics
from typing import Any

from app.schemas.ask import Insight, KPICard

logger = logging.getLogger(__name__)


class InsightEngine:
    """Generate financial insights from query results."""

    def __init__(self) -> None:
        pass

    def generate_kpis(
        self,
        rows: list[dict[str, Any]],
        intent: str,
        metric_name: str | None = None,
    ) -> list[KPICard]:
        """Extract KPIs from query results."""
        if not rows:
            return []

        kpis: list[KPICard] = []

        # Try to detect period column
        period_col = self._find_column(rows[0], ["period", "year", "month", "date", "quarter"])
        value_cols = self._find_numeric_columns(rows)

        if not value_cols:
            return []

        # Latest value KPI
        if period_col and len(rows) > 0:
            latest_row = rows[-1]

            for val_col in value_cols[:3]:  # Limit to 3 KPIs
                latest_val = latest_row.get(val_col)
                if isinstance(latest_val, (int, float)):
                    label = self._format_label(val_col)
                    kpi = KPICard(
                        label=label,
                        value=latest_val,
                        unit=self._detect_unit(val_col),
                        trend=self._calculate_trend(rows, period_col, val_col),
                        sentiment=self._determine_sentiment(val_col, self._calculate_trend(rows, period_col, val_col)),
                    )

                    # Calculate change if we have previous period
                    if len(rows) >= 2:
                        prev_val = rows[-2].get(val_col)
                        if isinstance(prev_val, (int, float)) and prev_val != 0:
                            change_pct = ((latest_val - prev_val) / abs(prev_val)) * 100
                            kpi.change = round(change_pct, 2)
                            kpi.change_period = f"vs {self._format_period_label(rows[-2].get(period_col))}"

                    kpis.append(kpi)

        # Aggregate KPIs for non-time-series data
        elif not period_col and value_cols:
            for val_col in value_cols[:3]:  # Limit to 3 KPIs
                values = [r.get(val_col) for r in rows if isinstance(r.get(val_col), (int, float))]
                if values:
                    total = sum(float(v) for v in values)
                    avg = statistics.mean(float(v) for v in values)
                    label = self._format_label(val_col)

                    if intent in ["total", "sum", "aggregate"]:
                        kpis.append(
                            KPICard(
                                label=f"Total {label}",
                                value=total,
                                unit=self._detect_unit(val_col),
                                sentiment="neutral",
                            )
                        )
                    else:
                        kpis.append(
                            KPICard(
                                label=f"Average {label}",
                                value=round(avg, 2),
                                unit=self._detect_unit(val_col),
                                sentiment="neutral",
                            )
                        )

        return kpis

    def generate_insights(
        self,
        rows: list[dict[str, Any]],
        intent: str,
        question: str,
    ) -> list[Insight]:
        """Generate contextual insights from query results."""
        if not rows:
            return [
                Insight(
                    insight_type="warning",
                    content="No data available for the specified query.",
                    severity="warning",
                )
            ]

        insights: list[Insight] = []

        # Summary insight
        summary = self._generate_summary_insight(rows, intent)
        if summary:
            insights.append(summary)

        # Trend insights for time-series data
        period_col = self._find_column(rows[0], ["period", "year", "month", "date", "quarter"])
        if period_col and len(rows) >= 2:
            trend_insight = self._generate_trend_insight(rows, period_col)
            if trend_insight:
                insights.append(trend_insight)

        # Anomaly detection
        if len(rows) >= 5:
            anomaly_insight = self._detect_anomalies(rows)
            if anomaly_insight:
                insights.append(anomaly_insight)

        # Comparison insights
        if intent in ["comparison", "compare"] and len(rows) >= 2:
            comp_insight = self._generate_comparison_insight(rows)
            if comp_insight:
                insights.append(comp_insight)

        # Recommendations (conservative, data-driven)
        if len(insights) > 0:
            recommendation = self._generate_recommendation(rows, intent, insights)
            if recommendation:
                insights.append(recommendation)

        return insights[:5]  # Limit to 5 insights

    def _generate_summary_insight(
        self,
        rows: list[dict[str, Any]],
        intent: str,
    ) -> Insight | None:
        """Generate a summary of the query results."""
        if not rows:
            return None

        value_cols = self._find_numeric_columns(rows)
        if not value_cols:
            return Insight(
                insight_type="summary",
                content=f"Query returned {len(rows)} record(s).",
                severity="info",
            )

        # Calculate basic statistics
        primary_col = value_cols[0]
        values = [r.get(primary_col) for r in rows if isinstance(r.get(primary_col), (int, float))]

        if not values:
            return None

        total = sum(float(v) for v in values)
        avg = statistics.mean(float(v) for v in values)
        max_val = max(float(v) for v in values)
        min_val = min(float(v) for v in values)

        label = self._format_label(primary_col)

        content_parts = []
        content_parts.append(f"Analyzed {len(rows)} record(s).")

        if intent in ["total", "sum", "aggregate"]:
            content_parts.append(f"Total {label}: {self._format_number(total)}.")
        else:
            content_parts.append(f"Average {label}: {self._format_number(avg)}.")

        if len(values) > 1:
            range_info = f"Range: {self._format_number(min_val)} to {self._format_number(max_val)}."
            content_parts.append(range_info)

        return Insight(
            insight_type="summary",
            title="Data Summary",
            content=" ".join(content_parts),
            severity="info",
            confidence=0.95,
        )

    def _generate_trend_insight(
        self,
        rows: list[dict[str, Any]],
        period_col: str,
    ) -> Insight | None:
        """Analyze trends in time-series data."""
        value_cols = self._find_numeric_columns(rows)
        if not value_cols:
            return None

        primary_col = value_cols[0]
        values = [r.get(primary_col) for r in rows if isinstance(r.get(primary_col), (int, float))]

        if len(values) < 2:
            return None

        # Calculate trend direction
        increases = sum(1 for i in range(1, len(values)) if float(values[i]) > float(values[i - 1]))
        decreases = sum(1 for i in range(1, len(values)) if float(values[i]) < float(values[i - 1]))

        if increases > decreases:
            direction = "upward"
            severity = "success"
        elif decreases > increases:
            direction = "downward"
            severity = "warning"
        else:
            direction = "stable"
            severity = "info"

        # Calculate growth rate
        first_val = float(values[0])
        last_val = float(values[-1])
        if first_val != 0:
            growth_pct = ((last_val - first_val) / abs(first_val)) * 100

            label = self._format_label(primary_col)
            first_period = self._format_period_label(rows[0].get(period_col))
            last_period = self._format_period_label(rows[-1].get(period_col))

            content = (
                f"{label} shows a {direction} trend from {first_period} to {last_period}, "
                f"with a {abs(growth_pct):.1f}% {'increase' if growth_pct > 0 else 'decrease'}. "
                f"From {self._format_number(first_val)} to {self._format_number(last_val)}."
            )

            return Insight(
                insight_type="trend",
                title="Trend Analysis",
                content=content,
                severity=severity,
                confidence=0.85,
            )

        return None

    def _detect_anomalies(self, rows: list[dict[str, Any]]) -> Insight | None:
        """Detect statistical anomalies in the data."""
        value_cols = self._find_numeric_columns(rows)
        if not value_cols or len(rows) < 5:
            return None

        primary_col = value_cols[0]
        values = [r.get(primary_col) for r in rows if isinstance(r.get(primary_col), (int, float))]

        if len(values) < 5:
            return None

        mean = statistics.mean(values)
        try:
            std_dev = statistics.stdev(float(v) for v in values)
        except statistics.StatisticsError:
            return None

        if std_dev == 0:
            return None

        # Find outliers (beyond 2 standard deviations)
        anomalies = []
        for i, val in enumerate(values):
            z_score = (val - mean) / std_dev
            if abs(z_score) > 2:
                anomalies.append((i, val, z_score))

        if anomalies:
            label = self._format_label(primary_col)
            anomaly_count = len(anomalies)

            if anomaly_count == 1:
                idx, val, z = anomalies[0]
                period_col = self._find_column(rows[0], ["period", "year", "month", "date"])
                period_label = ""
                if period_col:
                    period_label = f" in {self._format_period_label(rows[idx].get(period_col))}"

                content = (
                    f"Detected 1 anomaly{period_label}: {label} of {self._format_number(val)}, "
                    f"which is {abs(z):.1f} standard deviations from the mean."
                )
            else:
                content = (
                    f"Detected {anomaly_count} anomalies in {label}. "
                    f"These values deviate significantly from the average pattern."
                )

            return Insight(
                insight_type="anomaly",
                title="Anomaly Detected",
                content=content,
                severity="warning",
                confidence=0.75,
            )

        return None

    def _generate_comparison_insight(self, rows: list[dict[str, Any]]) -> Insight | None:
        """Generate insights for comparison queries."""
        value_cols = self._find_numeric_columns(rows)
        if len(value_cols) < 2:
            return None

        col1, col2 = value_cols[0], value_cols[1]
        label1 = self._format_label(col1)
        label2 = self._format_label(col2)

        values1 = [r.get(col1) for r in rows if isinstance(r.get(col1), (int, float))]
        values2 = [r.get(col2) for r in rows if isinstance(r.get(col2), (int, float))]

        if not values1 or not values2:
            return None

        total1 = sum(float(v) for v in values1)
        total2 = sum(float(v) for v in values2)

        if total1 + total2 == 0:
            return None

        pct1 = (total1 / (total1 + total2)) * 100
        pct2 = (total2 / (total1 + total2)) * 100

        content = (
            f"Comparing {label1} and {label2}: "
            f"{label1} totals {self._format_number(total1)} ({pct1:.1f}%), "
            f"while {label2} totals {self._format_number(total2)} ({pct2:.1f}%)."
        )

        return Insight(
            insight_type="comparison",
            title="Comparison Analysis",
            content=content,
            severity="info",
            confidence=0.9,
        )

    def _generate_recommendation(
        self,
        rows: list[dict[str, Any]],
        intent: str,
        existing_insights: list[Insight],
    ) -> Insight | None:
        """Generate data-driven recommendations."""
        # Only recommend when we have meaningful trends or anomalies
        has_negative_trend = any(
            i.insight_type == "trend" and "decrease" in i.content.lower()
            for i in existing_insights
        )
        has_anomaly = any(i.insight_type == "anomaly" for i in existing_insights)

        if has_negative_trend:
            return Insight(
                insight_type="recommendation",
                title="Recommendation",
                content=(
                    "Consider analyzing the factors contributing to the declining trend. "
                    "Review period-by-period details to identify inflection points."
                ),
                severity="info",
                confidence=0.7,
            )

        if has_anomaly:
            return Insight(
                insight_type="recommendation",
                title="Recommendation",
                content=(
                    "Investigate the anomalous periods to understand unusual patterns. "
                    "Verify data accuracy and identify any external factors."
                ),
                severity="info",
                confidence=0.7,
            )

        return None

    def _find_column(self, row: dict[str, Any], candidates: list[str]) -> str | None:
        """Find a column by name candidates (case-insensitive)."""
        if not row:
            return None
        lower_keys = {k.lower(): k for k in row}
        for candidate in candidates:
            actual_key = lower_keys.get(candidate.lower())
            if actual_key:
                return actual_key
        return None

    def _find_numeric_columns(self, rows: list[dict[str, Any]]) -> list[str]:
        """Find all numeric columns in the dataset."""
        if not rows:
            return []

        numeric_cols = []
        first_row = rows[0]

        for key, value in first_row.items():
            # Skip period/label columns
            key_lower = key.lower()
            if any(
                skip in key_lower
                for skip in ["period", "year", "month", "date", "quarter", "name", "label", "category"]
            ):
                continue

            # Check if numeric
            if isinstance(value, (int, float)):
                numeric_cols.append(key)
            elif any(isinstance(r.get(key), (int, float)) for r in rows[:5]):
                numeric_cols.append(key)

        return numeric_cols

    def _calculate_trend(
        self,
        rows: list[dict[str, Any]],
        period_col: str,
        value_col: str,
    ) -> str:
        """Calculate trend direction."""
        if len(rows) < 2:
            return "neutral"

        values = [r.get(value_col) for r in rows if isinstance(r.get(value_col), (int, float))]
        if len(values) < 2:
            return "neutral"

        increases = sum(1 for i in range(1, len(values)) if values[i] > values[i - 1])
        decreases = sum(1 for i in range(1, len(values)) if values[i] < values[i - 1])

        if increases > decreases:
            return "up"
        if decreases > increases:
            return "down"
        return "neutral"

    def _determine_sentiment(self, metric_name: str, trend: str) -> str:
        """Determine sentiment based on metric type and trend."""
        metric_lower = metric_name.lower()

        # Positive metrics (higher is better)
        positive_metrics = ["revenue", "profit", "income", "margin", "growth", "sales"]
        if any(pm in metric_lower for pm in positive_metrics):
            if trend == "up":
                return "positive"
            elif trend == "down":
                return "negative"

        # Negative metrics (lower is better)
        negative_metrics = ["expense", "cost", "loss", "debt", "liability"]
        if any(nm in metric_lower for nm in negative_metrics):
            if trend == "down":
                return "positive"
            elif trend == "up":
                return "negative"

        return "neutral"

    def _detect_unit(self, column_name: str) -> str | None:
        """Detect unit from column name."""
        col_lower = column_name.lower()
        if "pct" in col_lower or "percent" in col_lower or "margin" in col_lower:
            return "%"
        if "ratio" in col_lower:
            return "x"
        if "days" in col_lower:
            return "days"
        return None

    def _format_label(self, column_name: str) -> str:
        """Format column name to human-readable label."""
        # Replace underscores and capitalize
        label = column_name.replace("_", " ").title()
        # Handle common abbreviations
        label = label.replace("Pct", "%")
        label = label.replace("Yoy", "YoY")
        return label

    def _format_number(self, value: float) -> str:
        """Format number for display."""
        if abs(value) >= 1_000_000:
            return f"{value / 1_000_000:.2f}M"
        elif abs(value) >= 1_000:
            return f"{value / 1_000:.2f}K"
        else:
            return f"{value:.2f}"

    def _format_period_label(self, period: Any) -> str:
        """Format period value for display."""
        if period is None:
            return "Unknown"
        return str(period)
