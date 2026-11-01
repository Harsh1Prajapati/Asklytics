import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Visualization } from "../types/data";

interface EnhancedChartProps {
  visualization: Visualization;
  currency?: string | null;
}

const DEFAULT_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

function formatValue(
  value: number,
  format: string,
  currency?: string | null
): string {
  if (format === "percent") {
    return `${value.toFixed(2)}%`;
  }
  if (format === "currency" && currency) {
    const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : "€";
    if (Math.abs(value) >= 1_000_000) {
      return `${symbol}${(value / 1_000_000).toFixed(2)}M`;
    }
    if (Math.abs(value) >= 1_000) {
      return `${symbol}${(value / 1_000).toFixed(2)}K`;
    }
    return `${symbol}${value.toFixed(2)}`;
  }
  if (format === "integer") {
    return value.toFixed(0);
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function EnhancedChart({ visualization, currency }: EnhancedChartProps) {
  const colors = visualization.colors || DEFAULT_COLORS;
  const valueFormat = visualization.value_format || "number";

  // Bar Chart
  if (visualization.viz_type === "bar") {
    const dataKeys = Object.keys(visualization.data[0] || {}).filter(
      (k) => k !== "category" && k !== "name" && k !== "period"
    );
    const xKey = visualization.data[0]?.category
      ? "category"
      : visualization.data[0]?.name
      ? "name"
      : "period";

    return (
      <div className="w-full">
        {visualization.title && (
          <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {visualization.title}
          </h4>
        )}
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={visualization.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey={xKey}
              stroke="#6b7280"
              fontSize={12}
              tick={{ fill: "#6b7280" }}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tick={{ fill: "#6b7280" }}
              label={
                visualization.y_axis_label
                  ? {
                      value: visualization.y_axis_label,
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: "#6b7280" },
                    }
                  : undefined
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                border: "1px solid #e5e7eb",
                borderRadius: "0.5rem",
              }}
              formatter={(value: number) =>
                formatValue(value, valueFormat, currency)
              }
            />
            <Bar dataKey={dataKeys[0] || "value"} fill={colors[0]} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Multi Bar Chart
  if (visualization.viz_type === "multi_bar") {
    const dataKeys = Object.keys(visualization.data[0] || {}).filter(
      (k) => k !== "category" && k !== "name" && k !== "period"
    );
    const xKey = visualization.data[0]?.category
      ? "category"
      : visualization.data[0]?.name
      ? "name"
      : "period";

    return (
      <div className="w-full">
        {visualization.title && (
          <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {visualization.title}
          </h4>
        )}
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={visualization.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey={xKey} stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip
              formatter={(value: number) =>
                formatValue(value, valueFormat, currency)
              }
            />
            <Legend />
            {dataKeys.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[idx % colors.length]}
                radius={[8, 8, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Line Chart
  if (visualization.viz_type === "line") {
    const dataKeys = Object.keys(visualization.data[0] || {}).filter(
      (k) => k !== "period" && k !== "name"
    );
    const xKey = visualization.data[0]?.period ? "period" : "name";

    return (
      <div className="w-full">
        {visualization.title && (
          <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {visualization.title}
          </h4>
        )}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={visualization.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey={xKey} stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip
              formatter={(value: number) =>
                formatValue(value, valueFormat, currency)
              }
            />
            {!visualization.show_legend && (
              <Legend />
            )}
            <Line
              type="monotone"
              dataKey={dataKeys[0] || "value"}
              stroke={colors[0]}
              strokeWidth={2}
              dot={{ r: 4, fill: colors[0] }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Multi Line Chart
  if (visualization.viz_type === "multi_line") {
    const dataKeys = Object.keys(visualization.data[0] || {}).filter(
      (k) => k !== "period" && k !== "name"
    );
    const xKey = visualization.data[0]?.period ? "period" : "name";

    return (
      <div className="w-full">
        {visualization.title && (
          <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {visualization.title}
          </h4>
        )}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={visualization.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey={xKey} stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip
              formatter={(value: number) =>
                formatValue(value, valueFormat, currency)
              }
            />
            <Legend />
            {dataKeys.map((key, idx) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[idx % colors.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Pie Chart
  if (visualization.viz_type === "pie") {
    const dataKey = Object.keys(visualization.data[0] || {}).find(
      (k) => k !== "category" && k !== "name"
    ) || "value";
    const nameKey = visualization.data[0]?.category ? "category" : "name";

    return (
      <div className="w-full">
        {visualization.title && (
          <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {visualization.title}
          </h4>
        )}
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={visualization.data}
              dataKey={dataKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={(entry) =>
                `${entry[nameKey]}: ${formatValue(
                  entry[dataKey],
                  valueFormat,
                  currency
                )}`
              }
            >
              {visualization.data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            {visualization.show_legend && <Legend />}
            <Tooltip
              formatter={(value: number) =>
                formatValue(value, valueFormat, currency)
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Visualization type "{visualization.viz_type}" not yet implemented.
      </p>
    </div>
  );
}
