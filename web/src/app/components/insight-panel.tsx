import {
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Info,
  Target,
  GitCompare,
  Activity,
} from "lucide-react";
import type { Insight as InsightType } from "../types/data";

interface InsightPanelProps {
  insights: InsightType[];
}

function getInsightIcon(type: InsightType["insight_type"]) {
  switch (type) {
    case "summary":
      return Info;
    case "trend":
      return TrendingUp;
    case "anomaly":
      return AlertTriangle;
    case "recommendation":
      return Lightbulb;
    case "comparison":
      return GitCompare;
    case "correlation":
      return Activity;
    default:
      return Target;
  }
}

function getInsightColor(severity: InsightType["severity"]) {
  switch (severity) {
    case "success":
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/20",
        border: "border-emerald-200 dark:border-emerald-800",
        icon: "text-emerald-600 dark:text-emerald-400",
        title: "text-emerald-900 dark:text-emerald-100",
      };
    case "warning":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/20",
        border: "border-amber-200 dark:border-amber-800",
        icon: "text-amber-600 dark:text-amber-400",
        title: "text-amber-900 dark:text-amber-100",
      };
    case "error":
      return {
        bg: "bg-red-50 dark:bg-red-950/20",
        border: "border-red-200 dark:border-red-800",
        icon: "text-red-600 dark:text-red-400",
        title: "text-red-900 dark:text-red-100",
      };
    default:
      return {
        bg: "bg-blue-50 dark:bg-blue-950/20",
        border: "border-blue-200 dark:border-blue-800",
        icon: "text-blue-600 dark:text-blue-400",
        title: "text-blue-900 dark:text-blue-100",
      };
  }
}

export function InsightPanel({ insights }: InsightPanelProps) {
  if (!insights || insights.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        💡 Insights
      </h3>
      <div className="space-y-3">
        {insights.map((insight, index) => {
          const Icon = getInsightIcon(insight.insight_type);
          const colors = getInsightColor(insight.severity);

          return (
            <div
              key={index}
              className={`rounded-lg border ${colors.border} ${colors.bg} p-4 transition-all hover:shadow-sm`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 flex-shrink-0 ${colors.icon}`} />
                <div className="flex-1 space-y-1">
                  {insight.title && (
                    <h4 className={`font-semibold ${colors.title}`}>
                      {insight.title}
                    </h4>
                  )}
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {insight.content}
                  </p>
                  {insight.confidence !== null &&
                    insight.confidence !== undefined &&
                    insight.confidence < 0.8 && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Confidence: {(insight.confidence * 100).toFixed(0)}%
                      </div>
                    )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
