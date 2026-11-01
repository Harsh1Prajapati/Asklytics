/** Shared table shapes (pure types — safe to import from .ts utilities). */

export interface DataRow {
  [key: string]: string | number;
}

export interface SheetData {
  name: string;
  columns: string[];
  rows: DataRow[];
}

export interface UploadedData {
  fileName: string;
  sheets: SheetData[];
  uploadDate: Date;
}

/** Result of local `executeQuery` / CSV formula engine (chat + insights). */
export interface QueryResult {
  sql: string;
  table: DataRow[];
  chartData: Array<{ name: string; [key: string]: unknown }>;
  message: string;
  chartType?: "line" | "bar" | "multi-line" | "multi-bar";
  /** Chart Y-axis: % for margin/ratio queries. */
  chartValueFormat?: "percent" | "currency";
  insight?: string;
  metrics?: string[];
}

/** Enhanced backend response types */
export interface KPICard {
  label: string;
  value: string | number;
  unit?: string | null;
  change?: number | null;
  change_period?: string | null;
  trend?: "up" | "down" | "neutral" | null;
  sentiment?: "positive" | "negative" | "neutral" | null;
}

export interface Visualization {
  viz_type:
    | "bar"
    | "line"
    | "pie"
    | "area"
    | "scatter"
    | "multi_bar"
    | "multi_line"
    | "stacked_bar"
    | "stacked_area";
  data: Array<Record<string, unknown>>;
  title?: string | null;
  x_axis_label?: string | null;
  y_axis_label?: string | null;
  value_format?: "currency" | "percent" | "number" | "integer";
  currency?: string | null;
  show_legend?: boolean;
  colors?: string[] | null;
}

export interface Insight {
  insight_type:
    | "summary"
    | "trend"
    | "anomaly"
    | "recommendation"
    | "warning"
    | "comparison"
    | "correlation";
  title?: string | null;
  content: string;
  severity?: "info" | "success" | "warning" | "error" | null;
  confidence?: number | null;
}

export interface EnhancedAskResponse {
  question: string;
  intent: string;
  sql: string | null;
  execution_method: "sql" | "calculation" | "retrieval" | "explanation";
  answer_text: string;
  table?: Array<Record<string, unknown>> | null;
  kpis?: KPICard[] | null;
  visualizations?: Visualization[] | null;
  insights?: Insight[] | null;
  data_source?: string | null;
  period_coverage?: string | null;
  currency?: string | null;
  units?: string | null;
  confidence: number;
  limitations?: string[] | null;
  follow_up_suggestions?: string[] | null;
  // Backward compatibility
  explanation?: string | null;
  rows: Array<Record<string, unknown>>;
  visualization_data: Array<Record<string, unknown>>;
}
