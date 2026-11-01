import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { KPICard as KPICardType } from "../types/data";

interface KPICardProps {
  kpi: KPICardType;
  currency?: string | null;
}

export function KPICard({ kpi, currency }: KPICardProps) {
  const trendIcon = kpi.trend === "up" ? TrendingUp : kpi.trend === "down" ? TrendingDown : Minus;
  const TrendIcon = trendIcon;

  const sentimentColor =
    kpi.sentiment === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : kpi.sentiment === "negative"
      ? "text-red-600 dark:text-red-400"
      : "text-gray-600 dark:text-gray-400";

  const trendColor =
    kpi.trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : kpi.trend === "down"
      ? "text-red-600 dark:text-red-400"
      : "text-gray-500 dark:text-gray-400";

  const formatValue = (val: string | number): string => {
    if (typeof val === "number") {
      if (kpi.unit === "%") {
        return `${val.toFixed(2)}%`;
      }
      if (currency) {
        const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : "€";
        if (Math.abs(val) >= 1_000_000) {
          return `${symbol}${(val / 1_000_000).toFixed(2)}M`;
        }
        if (Math.abs(val) >= 1_000) {
          return `${symbol}${(val / 1_000).toFixed(2)}K`;
        }
        return `${symbol}${val.toFixed(2)}`;
      }
      return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return String(val);
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      {/* Label */}
      <div className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
        {kpi.label}
      </div>

      {/* Value */}
      <div className={`mb-1 text-3xl font-bold ${sentimentColor}`}>
        {formatValue(kpi.value)}
        {kpi.unit && !formatValue(kpi.value).includes(kpi.unit) && (
          <span className="ml-1 text-lg font-normal">{kpi.unit}</span>
        )}
      </div>

      {/* Change indicator */}
      {kpi.change !== null && kpi.change !== undefined && (
        <div className="flex items-center gap-1 text-sm">
          <TrendIcon className={`h-4 w-4 ${trendColor}`} />
          <span className={trendColor}>
            {kpi.change > 0 ? "+" : ""}
            {kpi.change.toFixed(2)}%
          </span>
          {kpi.change_period && (
            <span className="text-gray-500 dark:text-gray-400">
              {kpi.change_period}
            </span>
          )}
        </div>
      )}

      {/* Decorative gradient */}
      <div
        className={`absolute right-0 top-0 h-full w-1 ${
          kpi.sentiment === "positive"
            ? "bg-gradient-to-b from-emerald-500 to-emerald-600"
            : kpi.sentiment === "negative"
            ? "bg-gradient-to-b from-red-500 to-red-600"
            : "bg-gradient-to-b from-gray-400 to-gray-500"
        }`}
      />
    </div>
  );
}
