import re


class ExplainService:
    """Enhanced explanation service with dynamic, context-aware responses."""

    def explain(self, sql: str, rows: list[dict] | None = None, intent: str = "lookup") -> str:
        """Generate explanation based on SQL and actual results."""
        low = sql.lower()

        # Financial ratio queries
        if self._is_margin_query(low):
            return self._explain_margin_query(low, rows)

        if self._is_ratio_dashboard_query(low):
            return self._explain_ratio_dashboard(rows)

        if self._is_growth_query(low):
            return self._explain_growth_query(rows)

        if self._is_comparison_query(low):
            return self._explain_comparison(rows)

        if self._is_aggregation_query(low):
            return self._explain_aggregation(low, rows)

        # Default explanation
        return self._default_explanation(sql, rows)

    def _is_margin_query(self, sql: str) -> bool:
        """Check if query is about profit margins."""
        return "margin_pct" in sql or "margin" in sql

    def _is_ratio_dashboard_query(self, sql: str) -> bool:
        """Check if query returns multiple ratios."""
        return "from enriched" in sql or sql.count("_pct") >= 3

    def _is_growth_query(self, sql: str) -> bool:
        """Check if query calculates growth rates."""
        return "yoy" in sql or "growth" in sql or "lag(" in sql

    def _is_comparison_query(self, sql: str) -> bool:
        """Check if query compares multiple metrics."""
        case_whens = sql.count("case when")
        return case_whens >= 2

    def _is_aggregation_query(self, sql: str) -> bool:
        """Check if query performs aggregations."""
        return any(agg in sql for agg in ["sum(", "avg(", "max(", "min(", "count("])

    def _explain_margin_query(self, sql: str, rows: list[dict] | None) -> str:
        """Explain margin calculations."""
        if "gross_margin" in sql:
            base = "Gross profit margin shows profitability after direct costs (revenue - COGS) as a percentage of revenue."
        elif "operating_margin" in sql:
            base = "Operating margin indicates operational efficiency after operating expenses."
        elif "ebitda_margin" in sql:
            base = "EBITDA margin shows earnings before interest, tax, depreciation, and amortization as % of revenue."
        else:
            base = "Net profit margin represents final profitability after all expenses."

        if rows and len(rows) > 0:
            count = len(rows)
            base += f" Calculated for {count} period(s) using your ingested financial data."

        return base

    def _explain_ratio_dashboard(self, rows: list[dict] | None) -> str:
        """Explain comprehensive ratio analysis."""
        base = "Computed financial ratios from your financial_facts table."

        if rows:
            null_count = sum(
                1 for row in rows
                for val in row.values()
                if val is None
            )
            if null_count > 0:
                base += (
                    " Some ratios are NULL because underlying metrics are not yet ingested "
                    "(e.g., balance sheet items for ROE/ROA, shares for EPS)."
                )

        return base

    def _explain_growth_query(self, rows: list[dict] | None) -> str:
        """Explain growth calculations."""
        base = "Year-over-year (YoY) growth compares each period to the same period in the previous year."

        if rows and len(rows) >= 2:
            base += f" Calculated across {len(rows)} periods."

        return base

    def _explain_comparison(self, rows: list[dict] | None) -> str:
        """Explain comparison queries."""
        if rows and len(rows) > 0:
            return f"Comparing metrics across {len(rows)} period(s) from your financial data."
        return "Comparative analysis of multiple financial metrics."

    def _explain_aggregation(self, sql: str, rows: list[dict] | None) -> str:
        """Explain aggregation queries."""
        agg_type = "Total" if "sum(" in sql else "Average" if "avg(" in sql else "Maximum" if "max(" in sql else "Aggregated"

        if rows and len(rows) > 0:
            return f"{agg_type} calculated from {len(rows)} record(s)."
        return f"{agg_type} value from your financial data."

    def _default_explanation(self, sql: str, rows: list[dict] | None) -> str:
        """Default explanation for general queries."""
        if rows:
            record_count = len(rows)
            if record_count == 0:
                return "Query executed successfully, but no matching records were found."
            return f"Retrieved {record_count} record(s) using safe read-only SQL."
        return "Query executed successfully against your financial data."
