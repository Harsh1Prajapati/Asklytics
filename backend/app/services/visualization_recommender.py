"""
Intelligent visualization recommendation engine.

Selects appropriate chart types based on:
- Data characteristics (time-series, categorical, distributions)
- User intent (trend, comparison, composition)
- Data cardinality and value ranges
"""

import logging
from typing import Any

from app.schemas.ask import Visualization

logger = logging.getLogger(__name__)


class VisualizationRecommender:
    """Recommend appropriate visualizations for query results."""

    def __init__(self) -> None:
        pass

    def recommend(
        self,
        rows: list[dict[str, Any]],
        intent: str,
        question: str,
    ) -> list[Visualization]:
        """Recommend visualizations based on data and intent."""
        if not rows or len(rows) == 0:
            return []

        # Detect data characteristics
        period_col = self._find_column(rows[0], ["period", "year", "month", "date", "quarter"])
        category_col = self._find_column(
            rows[0],
            ["category", "name", "product", "region", "segment", "type"],
        )
        value_cols = self._find_numeric_columns(rows)

        if not value_cols:
            return []  # No numeric data to visualize

        visualizations: list[Visualization] = []

        # Time-series data
        if period_col and len(rows) >= 2:
            visualizations.extend(
                self._create_time_series_viz(rows, period_col, value_cols, intent)
            )

        # Categorical comparisons
        elif category_col and len(rows) >= 2:
            visualizations.extend(
                self._create_categorical_viz(rows, category_col, value_cols, intent)
            )

        # Single aggregate or small result set
        elif len(rows) <= 10 and value_cols:
            visualizations.extend(
                self._create_simple_viz(rows, value_cols, intent)
            )

        # Limit to 3 visualizations
        return visualizations[:3]

    def _create_time_series_viz(
        self,
        rows: list[dict[str, Any]],
        period_col: str,
        value_cols: list[str],
        intent: str,
    ) -> list[Visualization]:
        """Create time-series visualizations."""
        vizs: list[Visualization] = []

        # Detect currency from first row
        currency = self._detect_currency(rows[0], value_cols)
        value_format = self._detect_value_format(value_cols[0])

        # Single metric line chart
        if len(value_cols) == 1:
            data = []
            for row in rows:
                period_val = row.get(period_col)
                value_val = row.get(value_cols[0])
                if period_val is not None and isinstance(value_val, (int, float)):
                    data.append({
                        "period": str(period_val),
                        "value": value_val,
                    })

            if data:
                label = self._format_label(value_cols[0])
                vizs.append(
                    Visualization(
                        viz_type="line",
                        data=data,
                        title=f"{label} Over Time",
                        x_axis_label="Period",
                        y_axis_label=label,
                        value_format=value_format,
                        currency=currency,
                        show_legend=False,
                    )
                )

        # Multi-metric comparison (e.g., revenue vs expenses)
        elif len(value_cols) >= 2:
            # Check if this is a comparison intent
            is_comparison = intent in ["comparison", "compare"] or any(
                kw in intent.lower()
                for kw in ["vs", "versus", "compare", "contrast"]
            )

            data = []
            for row in rows:
                period_val = row.get(period_col)
                if period_val is None:
                    continue

                point: dict[str, Any] = {"period": str(period_val)}
                for val_col in value_cols[:4]:  # Limit to 4 series
                    value = row.get(val_col)
                    if isinstance(value, (int, float)):
                        point[val_col] = value

                if len(point) > 1:  # Has period + at least one value
                    data.append(point)

            if data:
                viz_type = "multi_line" if is_comparison else "line"
                vizs.append(
                    Visualization(
                        viz_type=viz_type,
                        data=data,
                        title="Trend Analysis",
                        x_axis_label="Period",
                        y_axis_label="Value",
                        value_format=value_format,
                        currency=currency,
                        show_legend=True,
                    )
                )

        return vizs

    def _create_categorical_viz(
        self,
        rows: list[dict[str, Any]],
        category_col: str,
        value_cols: list[str],
        intent: str,
    ) -> list[Visualization]:
        """Create categorical comparison visualizations."""
        vizs: list[Visualization] = []

        currency = self._detect_currency(rows[0], value_cols)
        value_format = self._detect_value_format(value_cols[0])

        # Single metric bar chart
        if len(value_cols) == 1:
            data = []
            for row in rows:
                cat_val = row.get(category_col)
                value_val = row.get(value_cols[0])
                if cat_val is not None and isinstance(value_val, (int, float)):
                    data.append({
                        "category": str(cat_val),
                        "value": value_val,
                    })

            if data:
                # Use pie chart for composition/percentage questions with few categories
                use_pie = (
                    len(data) <= 6
                    and any(kw in intent.lower() for kw in ["share", "composition", "breakdown", "distribution"])
                )

                label = self._format_label(value_cols[0])
                vizs.append(
                    Visualization(
                        viz_type="pie" if use_pie else "bar",
                        data=data,
                        title=f"{label} by Category",
                        x_axis_label="Category" if not use_pie else None,
                        y_axis_label=label if not use_pie else None,
                        value_format=value_format,
                        currency=currency,
                        show_legend=use_pie,
                    )
                )

        # Multi-metric grouped bar chart
        elif len(value_cols) >= 2 and len(rows) <= 15:
            data = []
            for row in rows:
                cat_val = row.get(category_col)
                if cat_val is None:
                    continue

                point: dict[str, Any] = {"category": str(cat_val)}
                for val_col in value_cols[:3]:  # Limit to 3 series
                    value = row.get(val_col)
                    if isinstance(value, (int, float)):
                        point[val_col] = value

                if len(point) > 1:
                    data.append(point)

            if data:
                vizs.append(
                    Visualization(
                        viz_type="multi_bar",
                        data=data,
                        title="Comparison by Category",
                        x_axis_label="Category",
                        y_axis_label="Value",
                        value_format=value_format,
                        currency=currency,
                        show_legend=True,
                    )
                )

        return vizs

    def _create_simple_viz(
        self,
        rows: list[dict[str, Any]],
        value_cols: list[str],
        intent: str,
    ) -> list[Visualization]:
        """Create simple visualizations for small datasets."""
        vizs: list[Visualization] = []

        if len(rows) == 1:
            # Single row - no chart needed, KPIs are sufficient
            return []

        # Find any label column
        first_row = rows[0]
        label_col = None
        for key in first_row.keys():
            if not isinstance(first_row[key], (int, float)):
                label_col = key
                break

        if label_col and value_cols:
            currency = self._detect_currency(rows[0], value_cols)
            value_format = self._detect_value_format(value_cols[0])

            data = []
            for row in rows:
                label_val = row.get(label_col)
                value_val = row.get(value_cols[0])
                if label_val is not None and isinstance(value_val, (int, float)):
                    data.append({
                        "name": str(label_val),
                        "value": value_val,
                    })

            if data:
                metric_label = self._format_label(value_cols[0])
                vizs.append(
                    Visualization(
                        viz_type="bar",
                        data=data,
                        title=metric_label,
                        x_axis_label="",
                        y_axis_label=metric_label,
                        value_format=value_format,
                        currency=currency,
                        show_legend=False,
                    )
                )

        return vizs

    def _find_column(self, row: dict[str, Any], candidates: list[str]) -> str | None:
        """Find a column by name candidates (case-insensitive)."""
        if not row:
            return None
        lower_keys = {k.lower(): k for k in row.keys()}
        for candidate in candidates:
            actual_key = lower_keys.get(candidate.lower())
            if actual_key:
                return actual_key
        return None

    def _find_numeric_columns(self, rows: list[dict[str, Any]]) -> list[str]:
        """Find all numeric columns."""
        if not rows:
            return []

        numeric_cols = []
        first_row = rows[0]

        for key, value in first_row.items():
            # Skip obvious label columns
            key_lower = key.lower()
            if any(
                skip in key_lower
                for skip in ["period", "year", "month", "date", "quarter", "name", "label", "category", "id"]
            ):
                continue

            # Check if numeric
            if isinstance(value, (int, float)):
                numeric_cols.append(key)
            elif any(isinstance(r.get(key), (int, float)) for r in rows[:5]):
                numeric_cols.append(key)

        return numeric_cols

    def _detect_currency(self, row: dict[str, Any], value_cols: list[str]) -> str | None:
        """Detect currency from row data."""
        # Check for explicit currency column
        currency_col = self._find_column(row, ["currency"])
        if currency_col:
            curr_val = row.get(currency_col)
            if isinstance(curr_val, str):
                return curr_val

        # Infer from column names
        for col in value_cols:
            col_lower = col.lower()
            if "inr" in col_lower or "rupee" in col_lower:
                return "INR"
            if "usd" in col_lower or "dollar" in col_lower:
                return "USD"
            if "eur" in col_lower or "euro" in col_lower:
                return "EUR"

        return None

    def _detect_value_format(self, column_name: str) -> str:
        """Detect value format from column name."""
        col_lower = column_name.lower()
        if "pct" in col_lower or "percent" in col_lower or "margin" in col_lower or "ratio" in col_lower:
            return "percent"
        return "currency"

    def _format_label(self, column_name: str) -> str:
        """Format column name to human-readable label."""
        label = column_name.replace("_", " ").title()
        label = label.replace("Pct", "%")
        label = label.replace("Yoy", "YoY")
        return label
