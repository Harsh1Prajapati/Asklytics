import { useState, useEffect, useRef } from "react";
import { Navbar } from "../components/navbar";
import { useMotionPageEffects } from "../hooks/use-motion-page-effects";
import { Send, User, Sparkles, Copy, Check, Upload, Download, X, ArrowRight } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useData } from "../contexts/data-context";
import { useHistory } from "../contexts/history-context";
import { executeQuery } from "../utils/query-executor";
import { parseFile } from "../utils/file-parser";
import { ingestRowsToUploadedData } from "../utils/ingest-to-uploaded-data";
import { HttpApiError, ask as apiAsk, ingestImage, ingestPdf } from "@/lib/api";
import { getToken, setToken } from "@/lib/auth";
import { KPICard } from "../components/kpi-card";
import { InsightPanel } from "../components/insight-panel";
import { EnhancedChart } from "../components/enhanced-chart";
import type { EnhancedAskResponse, KPICard as KPICardType, Visualization, Insight } from "../types/data";

function formatApiErrorForChat(err: unknown): string {
  if (err instanceof HttpApiError && err.status === 401) {
    setToken(null);
    return "Your session expired or is invalid. Please open **Login** and sign in again, then upload the file again.";
  }
  if (err instanceof Error) return err.message;
  return "Request failed";
}

interface ImageIngestMeta {
  source: "layoutlm" | "ocr_fallback";
  confidence_summary: { avg_confidence: number; high_confidence_rows: number } | null;
}

interface Message {
  id: number;
  type: "user" | "ai";
  content: string;
  sql?: string;
  table?: Array<Record<string, any>>;
  chartData?: Array<Record<string, any>>;
  chartType?: "line" | "bar" | "multi-line" | "multi-bar";
  chartValueFormat?: "percent" | "currency";
  insight?: string;
  metrics?: string[];
  imageIngestMeta?: ImageIngestMeta;
  // Enhanced fields
  kpis?: KPICardType[];
  visualizations?: Visualization[];
  insights?: Insight[];
  currency?: string | null;
  follow_up_suggestions?: string[];
  limitations?: string[];
}

function metricCellClass(metricVal: unknown): string {
  const m = String(metricVal ?? "").toLowerCase();
  if (m === "revenue" || m.includes("revenue")) return "text-emerald-700 dark:text-emerald-400 font-semibold";
  if (m === "expense" || m.includes("expense")) return "text-red-700 dark:text-red-400 font-semibold";
  if (m === "profit" || m.includes("profit")) return "text-blue-700 dark:text-blue-400 font-semibold";
  return "";
}

function ocrConfidenceLabel(avg: number): "High" | "Medium" | "Low" {
  if (avg >= 0.65) return "High";
  if (avg >= 0.45) return "Medium";
  return "Low";
}

function currencySymbol(code: string | null | undefined): string {
  if (!code) return "";
  if (code === "INR") return "₹";
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  return "";
}

function formatMoney(value: number, currency: string | null | undefined): string {
  const sym = currencySymbol(currency);
  try {
    return `${sym}${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)}`;
  } catch {
    return `${sym}${value}`;
  }
}

function messageCurrency(message: Message): string | null {
  const cur = (message.table?.[0] as any)?.currency;
  return cur ? String(cur) : null;
}

/** Legend / tooltip name for single-series charts from `executeQuery` metrics. */
function chartSeriesDisplayName(message: Message): string {
  if (message.chartValueFormat === "percent") return "Profit margin";
  const m = message.metrics?.[0];
  if (m === "revenue") return "Revenue";
  if (m === "expenses") return "Total expenses";
  if (m === "other_income") return "Other income";
  if (m === "net_profit") return "Net profit";
  if (typeof m === "string" && m.length) return m.replace(/_/g, " ");
  return "Value";
}

/** Table/chart rows from the API may be null or sparse; never pass those to Object.keys. */
function isDataRow(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function parseNumericCell(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = parseFloat(String(v).replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function findColumnKey(row: Record<string, unknown>, candidates: string[]): string | null {
  const byLower = new Map<string, string>();
  for (const k of Object.keys(row)) {
    byLower.set(k.toLowerCase(), k);
  }
  for (const c of candidates) {
    const k = byLower.get(c.toLowerCase());
    if (k) return k;
  }
  return null;
}

/** Backend formula SQL uses `*_pct` for margins and returns `gross_margin_pct`, not `profit_margin_pct`. */
const KNOWN_PCT_METRIC_KEYS = [
  "profit_margin_pct",
  "gross_margin_pct",
  "operating_margin_pct",
  "ebitda_margin_pct",
  "net_profit_margin_pct",
  "roe_pct",
  "roa_pct",
  "roce_pct",
  "yoy_revenue_growth_pct",
  "yoy_net_income_growth_pct",
] as const;

function findPercentSeriesKey(row: Record<string, unknown>): string | null {
  const fromList = findColumnKey(row, [...KNOWN_PCT_METRIC_KEYS]);
  if (fromList != null && parseNumericCell(row[fromList]) != null) return fromList;
  for (const k of Object.keys(row)) {
    if (k.toLowerCase() === "period") continue;
    if (!k.toLowerCase().endsWith("_pct")) continue;
    if (parseNumericCell(row[k]) != null) return k;
  }
  return null;
}

/**
 * `/ask` returns flat SQL rows. Legacy function now handled by backend visualizations.
 * Kept for backward compatibility with local CSV processing.
 */
function _buildChartSpecFromServerRows(rows: Array<Record<string, unknown>>): {
  chartData: Array<Record<string, unknown>>;
  chartType: "line" | "bar" | "multi-line" | "multi-bar";
  chartValueFormat?: "percent" | "currency";
} | null {
  if (!rows.length || !isDataRow(rows[0])) return null;
  const row0 = rows[0];
  const keys = Object.keys(row0);

  const labelKeys = ["period", "year", "month", "quarter", "date", "name", "label", "category"];
  const labelKey = labelKeys.find((k) => keys.includes(k)) ?? keys[0];
  if (!labelKey) return null;

  const marginPctKey = findPercentSeriesKey(row0);
  if (marginPctKey != null) {
    const chartData: Array<{ name: string; sales: number }> = [];
    for (const row of rows) {
      if (!isDataRow(row)) continue;
      const num = parseNumericCell(row[marginPctKey]);
      if (num == null) continue;
      const lbl = row[labelKey];
      const name = lbl != null && String(lbl) !== "" ? String(lbl) : "—";
      chartData.push({ name, sales: num });
    }
    if (!chartData.length) return null;
    const timeLike = new Set(["period", "year", "month", "date", "quarter"]);
    const chartType: "line" | "bar" = timeLike.has(labelKey) ? "line" : "bar";
    return { chartData, chartType, chartValueFormat: "percent" };
  }

  const revenueKey = findColumnKey(row0, ["revenue"]);
  const expensesKey = findColumnKey(row0, ["expenses"]);
  if (revenueKey && expensesKey) {
    const chartData: Array<Record<string, unknown>> = [];
    for (const row of rows) {
      if (!isDataRow(row)) continue;
      const r = parseNumericCell(row[revenueKey]);
      const e = parseNumericCell(row[expensesKey]);
      if (r == null && e == null) continue;
      const lbl = row[labelKey];
      const name = lbl != null && String(lbl) !== "" ? String(lbl) : "—";
      chartData.push({
        name,
        revenue: r ?? 0,
        expenses: e ?? 0,
      });
    }
    if (!chartData.length) return null;
    const timeLike = new Set(["period", "year", "month", "date", "quarter"]);
    const chartType: "multi-line" | "multi-bar" = timeLike.has(labelKey) ? "multi-line" : "multi-bar";
    return { chartData, chartType };
  }

  const valueKeys = [
    "revenue",
    "value",
    "sales",
    "amount",
    "total",
    "net_income",
    "profit",
    "expenses",
  ];
  let valueKey =
    valueKeys.find((k) => keys.includes(k) && parseNumericCell(row0[k]) != null) ?? null;
  if (valueKey == null) {
    valueKey =
      keys.find((k) => k !== labelKey && parseNumericCell(row0[k]) != null) ?? null;
  }
  if (valueKey == null) return null;

  const chartData: Array<{ name: string; sales: number }> = [];
  for (const row of rows) {
    if (!isDataRow(row)) continue;
    const num = parseNumericCell(row[valueKey]);
    if (num == null) continue;

    const lbl = row[labelKey];
    const name = lbl != null && String(lbl) !== "" ? String(lbl) : "—";
    chartData.push({ name, sales: num });
  }
  if (!chartData.length) return null;

  const timeLike = new Set(["period", "year", "month", "date", "quarter"]);
  const chartType: "line" | "bar" = timeLike.has(labelKey) ? "line" : "bar";
  return { chartData, chartType };
}

const LS_UPLOADED_FILE_NAME = "uploaded_file";
const LS_UPLOADED_FILE_KIND = "asklytics_uploaded_file_kind";

function nextMessageId(prev: Message[]): number {
  return 1 + Math.max(0, ...prev.map((m) => m.id));
}

export function Chat() {
  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Chat is a functional screen: skip scroll-scrub hero/tilt on the thread (it fought layout + scroll).
  useMotionPageEffects({
    root: rootRef,
    header: navRef,
  });

  const { data, setData, isDataLoaded } = useData();
  const { addToHistory } = useHistory();

  /** PDF/image: ingested on upload when logged in; file reused for /ask without re-ingesting. */
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileIngestedToServer, setFileIngestedToServer] = useState(false);

  const clearPendingUpload = () => {
    setUploadedFile(null);
    setFileIngestedToServer(false);
    try {
      localStorage.removeItem(LS_UPLOADED_FILE_NAME);
      localStorage.removeItem(LS_UPLOADED_FILE_KIND);
    } catch {
      /* ignore */
    }
  };

  const canChat = Boolean(getToken()) || isDataLoaded;
  
  // Load messages from localStorage with version checking
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("asklytics_chat_messages");
    const version = localStorage.getItem("asklytics_chat_version");
    
    // Current version includes insights feature
    const CURRENT_VERSION = "2.0";
    
    // If version mismatch, clear old messages
    if (version !== CURRENT_VERSION) {
      console.log("🔄 Clearing old chat messages - version upgrade");
      localStorage.setItem("asklytics_chat_version", CURRENT_VERSION);
      localStorage.removeItem("asklytics_chat_messages");
    } else if (saved) {
      try {
        const parsed = JSON.parse(saved) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log("📥 Loaded messages from localStorage:", parsed.length);
          // Sequential ids fix duplicate keys / stale id schemes from older builds.
          return parsed.map((m, i) => ({ ...m, id: i + 1 }));
        }
      } catch {
        // If parsing fails, return default message
        console.log("❌ Failed to parse saved messages");
      }
    }
    
    return [
      {
        id: 1,
        type: "ai",
        content: isDataLoaded
          ? `Hello! I'm your Asklytics AI assistant. I can see you have uploaded ${data?.fileName}. Ask me anything about your data, and I'll convert it to SQL and show you the results.`
          : "Hello! I'm your Asklytics AI assistant. Please upload a financial statement file (CSV, Excel, etc.) to get started with data analysis.",
      },
    ];
  });
  
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("asklytics_chat_messages", JSON.stringify(messages));
  }, [messages]);

  // Lenis (root layout) smooth-scrolls the window; drive this pane explicitly so wheels aren't swallowed.
  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const t = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(t);
  }, [messages]);

  // REMOVED: generateResponse() function with hardcoded mock data
  // All responses now come from the intelligent backend or local query executor

  const handleSend = async () => {
    const q = input.trim();
    if (!q || !canChat) return;

    // SEARCH TAGS:
    // - @ui:ask_local_engine     → local query execution (`query-executor.ts`)
    // - @ui:ask_backend_sql      → `/ask` backend route (SQL templates + sql_guard)
    // - @ui:ingest_on_send       → lazy ingest PDFs/images only when user asks (auth required)
    //
    // In-memory sheet (CSV/Excel or PDF/image facts in the same shape): run the same client pipeline as CSV
    // (financial formula engine, heuristics, display SQL). Avoids /ask + sql_guard for ratio-style questions.
    const token = getToken();
    let ingestPrefix = "";
    let imageMeta: ImageIngestMeta | undefined;
    // Prefer client-side engine whenever the sheet has headers — even if rows are empty.
    let rows = data?.sheets?.[0]?.rows ?? [];
    let cols = data?.sheets?.[0]?.columns ?? [];

    // @ui:ingest_on_send
    // PDFs/images can be uploaded before auth; if user is logged in and then asks a question,
    // ingest to the backend first so `financial_facts` exists.
    if (token && uploadedFile && !fileIngestedToServer) {
      const lower = uploadedFile.name.toLowerCase();
      const isPdf = lower.endsWith(".pdf");
      const isImage = /\.(png|jpg|jpeg)$/i.test(lower);
      if (isPdf || isImage) {
        setInput("");
        try {
          const company = localStorage.getItem("asklytics_company") || "WebUpload";
          if (isPdf) {
            const ing = await ingestPdf(company, uploadedFile, token);
            ingestPrefix = `Imported **${uploadedFile.name}** (${ing.inserted_rows} fact(s)). `;
            const uploaded = ingestRowsToUploadedData(uploadedFile.name, ing.rows, {
              detectedCurrency: ing.detected_currency,
            });
            setFileIngestedToServer(true);
            setData(uploaded);
            rows = uploaded.sheets[0].rows;
            cols = uploaded.sheets[0].columns;
          } else {
            const ing = await ingestImage(company, uploadedFile, token);
            ingestPrefix = `Imported **${uploadedFile.name}** (${ing.extracted_items} row(s)). `;
            imageMeta = {
              source: ing.source,
              confidence_summary: ing.confidence_summary,
            };
            const uploaded = ingestRowsToUploadedData(uploadedFile.name, ing.rows, {
              detectedCurrency: ing.currency,
            });
            setFileIngestedToServer(true);
            setData(uploaded);
            rows = uploaded.sheets[0].rows;
            cols = uploaded.sheets[0].columns;
          }
        } catch (err) {
          const msg = formatApiErrorForChat(err);
          setMessages((prev) => {
            const uid = nextMessageId(prev);
            return [
              ...prev,
              { id: uid, type: "user", content: q },
              { id: uid + 1, type: "ai", content: `Error: ${msg}` },
            ];
          });
          return;
        }
      }
    }

    // PDF/image financial statements are already persisted in financial_facts.
    // Send their questions through the backend smart planner so semantic language
    // is normalized before deterministic financial SQL executes.
    const serverFinancialFile =
      !!token &&
      !!uploadedFile &&
      /\.(pdf|png|jpg|jpeg)$/i.test(uploadedFile.name);

    if (serverFinancialFile) {
      setInput("");
      try {
        const res = await apiAsk(q, token!) as EnhancedAskResponse;
        const table = (res.table || res.rows || []) as Array<Record<string, any>>;
        
        // Build response from enhanced backend
        const responseData: Omit<Message, "id"> = {
          type: "ai",
          content: ingestPrefix + (res.answer_text || res.explanation || "Here are your results."),
          sql: res.sql || undefined,
          table: table.length > 0 ? table : undefined,
          kpis: res.kpis || undefined,
          visualizations: res.visualizations || undefined,
          insights: res.insights || undefined,
          currency: res.currency,
          follow_up_suggestions: res.follow_up_suggestions || undefined,
          limitations: res.limitations || undefined,
          imageIngestMeta: imageMeta,
          // Legacy fallback for old frontend code
          chartData: res.visualization_data,
          insight: res.insights?.[0]?.content,
        };

        setMessages((prev) => {
          const uid = nextMessageId(prev);
          return [...prev, { id: uid, type: "user", content: q }, { id: uid + 1, ...responseData }];
        });

        if (res.sql && table.length) {
          addToHistory({
            question: q,
            sql: res.sql,
            result: {
              table,
              chartData: res.visualization_data ?? [],
              message: responseData.content,
            },
          });
        }
      } catch (err) {
        const msg = formatApiErrorForChat(err);
        setMessages((prev) => {
          const uid = nextMessageId(prev);
          return [
            ...prev,
            { id: uid, type: "user", content: q },
            { id: uid + 1, type: "ai", content: `Error: ${msg}` },
          ];
        });
      }
      return;
    }

    if (cols.length > 0) {
      console.log("🔍 Executing query with data:", {
        input: q,
        rows: rows.length,
        columns: cols,
        sampleData: rows.slice(0, 2),
      });

      const queryResult = executeQuery(q, rows, cols);

      console.log("✅ Query result:", {
        sql: queryResult.sql,
        tableRows: queryResult.table?.length,
        chartDataLength: queryResult.chartData?.length,
        chartType: queryResult.chartType,
        hasInsight: !!queryResult.insight,
      });

      const responseData: Omit<Message, "id"> = {
        type: "ai",
        content: ingestPrefix + queryResult.message,
        sql: queryResult.sql,
        table: queryResult.table,
        chartData: queryResult.chartData,
        chartType: queryResult.chartType,
        chartValueFormat: queryResult.chartValueFormat,
        insight: queryResult.insight,
        metrics: queryResult.metrics,
        imageIngestMeta: imageMeta,
      };

      setMessages((prev) => {
        const uid = nextMessageId(prev);
        return [...prev, { id: uid, type: "user", content: q }, { id: uid + 1, ...responseData }];
      });
      setInput("");

      if (responseData.sql && responseData.table) {
        addToHistory({
          question: q,
          sql: responseData.sql,
          result: {
            table: responseData.table,
            chartData: responseData.chartData || [],
            message: responseData.content,
          },
        });
      }
      return;
    }

    // Logged in and no in-memory sheet headers: /ask against server financial_facts only
    if (token) {
      setInput("");
      try {
        const res = await apiAsk(q, token) as EnhancedAskResponse;
        const table = (res.table || res.rows || []) as Array<Record<string, any>>;
        
        const responseData: Omit<Message, "id"> = {
          type: "ai",
          content: res.answer_text || res.explanation || "Here are your results.",
          sql: res.sql || undefined,
          table: table.length > 0 ? table : undefined,
          kpis: res.kpis || undefined,
          visualizations: res.visualizations || undefined,
          insights: res.insights || undefined,
          currency: res.currency,
          follow_up_suggestions: res.follow_up_suggestions || undefined,
          limitations: res.limitations || undefined,
          // Legacy fallback
          chartData: res.visualization_data,
          insight: res.insights?.[0]?.content,
        };

        setMessages((prev) => {
          const uid = nextMessageId(prev);
          const aiMessage: Message = { id: uid + 1, ...responseData };
          return [...prev, { id: uid, type: "user", content: q }, aiMessage];
        });

        if (res.sql && table.length) {
          addToHistory({
            question: q,
            sql: res.sql,
            result: {
              table,
              chartData: res.visualization_data ?? [],
              message: res.answer_text || res.explanation || "",
            },
          });
        }
      } catch (err) {
        const msg = formatApiErrorForChat(err);
        setMessages((prev) => {
          const uid = nextMessageId(prev);
          return [
            ...prev,
            { id: uid, type: "user", content: q },
            { id: uid + 1, type: "ai", content: `Error: ${msg}` },
          ];
        });
      }
      return;
    }

    // No data loaded and not authenticated - inform user
    if (!canChat) {
      setMessages((prev) => {
        const uid = nextMessageId(prev);
        return [
          ...prev,
          { id: uid, type: "user", content: q },
          {
            id: uid + 1,
            type: "ai",
            content:
              "Please either login to use the intelligent financial analytics engine, or upload a CSV/Excel file to analyze your data locally.",
          },
        ];
      });
      setInput("");
    }
  };

  const handleCopy = (sql: string, id: number) => {
    navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // SEARCH TAGS:
    // - @ui:upload_router     → file-type routing (image/pdf/csv/xlsx)
    // - @ui:upload_pdf        → backend ingestPdf (table extract + OCR fallback)
    // - @ui:upload_image      → backend ingestImage (OCR/LayoutLM + FinBERT)
    // - @ui:upload_csv_local  → local parsing into UploadedData (no auth required)
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const lower = file.name.toLowerCase();
    const isImage = /\.(png|jpg|jpeg)$/.test(lower);
    const isPdf = /\.pdf$/.test(lower);

    // @ui:upload_image
    if (isImage) {
      const token = getToken();
      if (!token) {
        setMessages((prev) => {
          const uid = nextMessageId(prev);
          return [
            ...prev,
            {
              id: uid,
              type: "ai",
              content:
                "Log in to extract structured rows from financial statement images (LayoutLM + FinBERT pipeline).",
            },
          ];
        });
        setIsUploading(false);
        event.target.value = "";
        return;
      }
      try {
        const company = localStorage.getItem("asklytics_company") || "WebUpload";
        const ing = await ingestImage(company, file, token);
        setUploadedFile(file);
        setFileIngestedToServer(true);
        setData(
          ingestRowsToUploadedData(file.name, ing.rows, { detectedCurrency: ing.currency }),
        );
        try {
          localStorage.setItem(LS_UPLOADED_FILE_NAME, file.name);
          localStorage.setItem(LS_UPLOADED_FILE_KIND, "image");
        } catch {
          /* ignore */
        }
        setMessages((prev) => {
          const uid = nextMessageId(prev);
          return [
            ...prev,
            {
              id: uid,
              type: "ai",
              content: `Imported **${file.name}** (${ing.extracted_items} row(s)). Open **Analytics** for charts, or ask a question here.`,
            },
          ];
        });
      } catch (err) {
        const msg = formatApiErrorForChat(err);
        setUploadedFile(file);
        setFileIngestedToServer(false);
        setMessages((prev) => {
          const uid = nextMessageId(prev);
          return [
            ...prev,
            {
              id: uid,
              type: "ai",
              content: `Could not extract from image: ${msg}`,
            },
          ];
        });
      } finally {
        setIsUploading(false);
        event.target.value = "";
      }
      return;
    }

    // @ui:upload_pdf
    if (isPdf) {
      const token = getToken();
      if (!token) {
        setMessages((prev) => {
          const uid = nextMessageId(prev);
          return [
            ...prev,
            {
              id: uid,
              type: "ai",
              content: "Log in to ingest PDFs using the backend PDF table extraction pipeline.",
            },
          ];
        });
        setIsUploading(false);
        event.target.value = "";
        return;
      }
      try {
        const company = localStorage.getItem("asklytics_company") || "WebUpload";
        const ing = await ingestPdf(company, file, token);
        setUploadedFile(file);
        setFileIngestedToServer(true);
        setData(
          ingestRowsToUploadedData(file.name, ing.rows, { detectedCurrency: ing.detected_currency }),
        );
        try {
          localStorage.setItem(LS_UPLOADED_FILE_NAME, file.name);
          localStorage.setItem(LS_UPLOADED_FILE_KIND, "pdf");
        } catch {
          /* ignore */
        }
        setMessages((prev) => {
          const uid = nextMessageId(prev);
          return [
            ...prev,
            {
              id: uid,
              type: "ai",
              content: `Imported **${file.name}** (${ing.inserted_rows} fact(s)). Open **Analytics** for charts, or ask a question here.`,
            },
          ];
        });
      } catch (err) {
        const msg = formatApiErrorForChat(err);
        setUploadedFile(file);
        setFileIngestedToServer(false);
        setMessages((prev) => {
          const uid = nextMessageId(prev);
          return [
            ...prev,
            {
              id: uid,
              type: "ai",
              content: `Could not ingest PDF: ${msg}`,
            },
          ];
        });
      } finally {
        setIsUploading(false);
        event.target.value = "";
      }
      return;
    }

    const result = await parseFile(file);

    if (result.success) {
      clearPendingUpload();

      setData({
        fileName: file.name,
        sheets: result.sheets,
        uploadDate: new Date(),
      });

      // Calculate total rows and columns from all sheets
      const totalRows = result.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
      const totalColumns = result.sheets[0]?.columns.length || 0;

      // Update welcome message
      setMessages([
        {
          id: 1,
          type: "ai",
          content: `Great! I've loaded ${file.name} with ${result.sheets.length} sheet(s), ${totalRows} total rows and ${totalColumns} columns. Ask me anything about your data!`,
        },
      ]);

      setIsUploading(false);
    } else {
      // Show error message in chat
      setMessages((prev) => {
        const uid = nextMessageId(prev);
        return [
          ...prev,
          {
            id: uid,
            type: "ai",
            content: `⚠️ ${result.error}`,
          },
        ];
      });
      setIsUploading(false);
    }
  };

  const downloadMessage = (message: Message, format: "single" | "all" = "single") => {
    let csvContent = "";

    if (format === "all") {
      // Download entire chat
      const aiMessages = messages.filter(
        (m) => m.type === "ai" && ((m.table && m.table.length > 0) || (m.chartData && m.chartData.length > 0)),
      );

      aiMessages.forEach((msg, index) => {
        csvContent += `\n=== Query ${index + 1} ===\n`;
        csvContent += `Question: ${messages.find(m => m.id === msg.id - 1)?.content || "N/A"}\n`;
        csvContent += `SQL: ${msg.sql || "N/A"}\n\n`;

        if (msg.table && msg.table.length > 0 && isDataRow(msg.table[0])) {
          const headers = Object.keys(msg.table[0]);
          csvContent += headers.join(",") + "\n";
          msg.table.filter(isDataRow).forEach((row) => {
            csvContent += headers.map((h) => JSON.stringify(row[h] ?? "")).join(",") + "\n";
          });
        }
        if (msg.chartData && msg.chartData.length > 0 && isDataRow(msg.chartData[0])) {
          csvContent += "\nChart Data:\n";
          const ch = Object.keys(msg.chartData[0]);
          csvContent += ch.join(",") + "\n";
          msg.chartData.filter(isDataRow).forEach((row) => {
            csvContent += ch.map((h) => JSON.stringify(row[h] ?? "")).join(",") + "\n";
          });
        }
        csvContent += "\n";
      });
    } else {
      // Download single message
      csvContent = `Question: ${messages.find(m => m.id === message.id - 1)?.content || "N/A"}\n`;
      csvContent += `SQL Query: ${message.sql || "N/A"}\n\n`;
      
      if (message.table && message.table.length > 0 && isDataRow(message.table[0])) {
        const headers = Object.keys(message.table[0]);
        csvContent += headers.join(",") + "\n";
        message.table.filter(isDataRow).forEach((row) => {
          csvContent += headers.map((h) => JSON.stringify(row[h] ?? "")).join(",") + "\n";
        });
      }

      if (message.chartData && message.chartData.length > 0 && isDataRow(message.chartData[0])) {
        csvContent += "\nChart Data:\n";
        const chartHeaders = Object.keys(message.chartData[0]);
        csvContent += chartHeaders.join(",") + "\n";
        message.chartData.filter(isDataRow).forEach((row) => {
          csvContent += chartHeaders.map((h) => JSON.stringify(row[h] ?? "")).join(",") + "\n";
        });
      }
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", format === "all" ? "asklytics_chat_export.csv" : `asklytics_query_${message.id}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div ref={rootRef} className="h-[100dvh] min-h-0 flex flex-col bg-background overflow-hidden">
      <Navbar ref={navRef} />

      <div className="flex flex-1 flex-col min-h-0 min-w-0 max-w-5xl mx-auto w-full px-4 pt-5 pb-0">
        <div className="mb-3 shrink-0 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="mb-2">Chat Interface</h1>
            <p className="text-muted-foreground">
              Ask business questions in natural language
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              clearPendingUpload();
              setData(null);
              setMessages([
                {
                  id: 1,
                  type: "ai",
                  content: getToken()
                    ? "Chat cleared. Upload a file or ask about your server data."
                    : "Hello! I'm your Asklytics AI assistant. Please upload a financial statement file (CSV, Excel, etc.) to get started with data analysis.",
                },
              ]);
            }}
            className="text-sm px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors shrink-0"
          >
            Clear chat
          </button>
        </div>

        {/* Scroll only the thread — fixed composer used to cover later messages */}
        <div
          ref={messagesScrollRef}
          data-lenis-prevent
          className="flex-1 min-h-0 touch-pan-y overflow-y-auto overflow-x-hidden overscroll-y-auto"
        >
          <div className="space-y-6 py-2 pr-1 min-w-0 max-w-full">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-4 min-w-0 max-w-full ${message.type === "user" ? "justify-end" : ""}`}
            >
              {message.type === "ai" && (
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
              )}

              <div
                className={`min-w-0 ${message.type === "user" ? "max-w-2xl flex" : "flex-1 max-w-full"}`}
              >
                {message.type === "user" ? (
                  <div className="bg-primary text-primary-foreground rounded-2xl px-6 py-4 ml-auto">
                    <p>{message.content}</p>
                  </div>
                ) : (
                  <div className="space-y-4 min-w-0 max-w-full">
                    <div className="bg-card border border-border rounded-xl px-4 sm:px-6 py-4 min-w-0 max-w-full overflow-hidden">
                      <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-pretty">
                        {message.content}
                      </p>
                      {message.imageIngestMeta && (
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-muted px-3 py-1 font-medium">
                            AI:{" "}
                            {message.imageIngestMeta.source === "layoutlm"
                              ? "LayoutLM + FinBERT"
                              : "OCR fallback + FinBERT"}
                          </span>
                          <span className="rounded-full bg-muted px-3 py-1">
                            OCR confidence:{" "}
                            {ocrConfidenceLabel(
                              message.imageIngestMeta.confidence_summary?.avg_confidence ?? 0,
                            )}
                            {" "}
                            (avg{" "}
                            {(message.imageIngestMeta.confidence_summary?.avg_confidence ?? 0).toFixed(
                              3,
                            )}
                            )
                          </span>
                        </div>
                      )}
                    </div>

                    {/* SQL Query */}
                    {message.sql && (
                      <div className="bg-card border border-border rounded-xl overflow-hidden min-w-0 max-w-full">
                        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-muted/30 border-b border-border min-w-0">
                          <span className="text-sm font-medium shrink-0">Generated SQL Query</span>
                          <button
                            onClick={() => handleCopy(message.sql!, message.id)}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          >
                            {copiedId === message.id ? (
                              <>
                                <Check className="w-4 h-4" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="p-3 sm:p-4 overflow-x-auto max-w-full text-xs sm:text-sm">
                          <code className="text-secondary whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                            {message.sql}
                          </code>
                        </pre>
                      </div>
                    )}

                    {/* Table Results */}
                    {message.table &&
                      message.table.length > 0 &&
                      isDataRow(message.table[0]) && (
                      <div className="bg-card border border-border rounded-xl overflow-hidden min-w-0 max-w-full">
                        <div className="px-4 py-3 bg-muted/30 border-b border-border">
                          <span className="text-sm font-medium">Query Results</span>
                        </div>
                        <div className="overflow-x-auto max-w-full overscroll-x-contain">
                          <table className="w-full text-sm table-fixed">
                            <thead className="bg-muted/20">
                              <tr>
                                {Object.keys(message.table[0] as Record<string, unknown>).map((key) => (
                                  <th
                                    key={key}
                                    className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium align-top break-words [overflow-wrap:anywhere]"
                                  >
                                    {key.replace(/_/g, " ").toUpperCase()}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {message.table.filter(isDataRow).map((row, idx) => (
                                <tr key={idx} className="border-t border-border hover:bg-muted/20">
                                  {Object.entries(row).map(([key, value]) => (
                                    <td
                                      key={key}
                                      className={`px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm break-words [overflow-wrap:anywhere] align-top ${
                                        key === "metric" ? metricCellClass(value) : ""
                                      }`}
                                    >
                                      {String(value)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {message.table &&
                      message.table.length > 0 &&
                      isDataRow(message.table[0]) &&
                      (!message.chartData || message.chartData.length === 0) && (
                      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        No chart for this answer: every plottable value is empty (often{" "}
                        <code className="text-xs">NULL</code> in the results). For example,{" "}
                        <strong>gross margin</strong> needs both <strong>revenue</strong> and{" "}
                        <strong>COGS</strong> ingested into <code className="text-xs">financial_facts</code>{" "}
                        on the server you are calling. Re-upload/ingest on production or use a persistent
                        database so data does not reset after deploy.
                      </div>
                    )}

                    {/* Chart Visualization */}
                    {message.chartData &&
                      message.chartData.length > 0 &&
                      isDataRow(message.chartData[0]) && (
                      <div className="bg-card border border-border rounded-xl p-3 sm:p-6 min-w-0 max-w-full overflow-hidden">
                        <div className="mb-3 sm:mb-4">
                          <span className="text-sm font-medium">Visualization</span>
                        </div>
                        <div className="w-full min-w-0 h-[260px] sm:h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          {(message.chartType === "multi-line" || message.chartType === "multi-bar") ? (
                            // Multi-metric chart
                            message.chartType === "multi-line" ? (
                              <LineChart data={message.chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#64748b" />
                                <YAxis stroke="#64748b" />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "8px",
                                  }}
                                />
                                {/* Render lines for each metric */}
                                {(() => {
                                  const colors = ["#1e7a5c", "#ef4444", "#22c55e", "#f59e0b"];
                                  const firstRow = message.chartData?.[0];
                                  if (!isDataRow(firstRow)) return null;

                                  const dataKeys = Object.keys(firstRow).filter(
                                    (key) => key !== "name" && typeof firstRow[key] === "number",
                                  );

                                  console.log("📊 Multi-line dataKeys:", dataKeys);

                                  return dataKeys.map((dataKey, idx) => (
                                    <Line
                                      key={dataKey}
                                      dataKey={dataKey}
                                      stroke={colors[idx % colors.length]}
                                      strokeWidth={3}
                                      dot={{ fill: colors[idx % colors.length], r: 5 }}
                                      activeDot={{ r: 7 }}
                                    />
                                  ));
                                })()}
                              </LineChart>
                            ) : (
                              <BarChart data={message.chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#64748b" />
                                <YAxis stroke="#64748b" />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "8px",
                                  }}
                                />
                                {/* Render bars for each metric */}
                                {(() => {
                                  const colors = ["#1e7a5c", "#ef4444", "#22c55e", "#f59e0b"];
                                  const firstRow = message.chartData?.[0];
                                  if (!isDataRow(firstRow)) return null;

                                  const dataKeys = Object.keys(firstRow).filter(
                                    (key) => key !== "name" && typeof firstRow[key] === "number",
                                  );

                                  console.log("📊 Multi-bar dataKeys:", dataKeys);

                                  return dataKeys.map((dataKey, idx) => (
                                    <Bar
                                      key={dataKey}
                                      dataKey={dataKey}
                                      fill={colors[idx % colors.length]}
                                      radius={[8, 8, 0, 0]}
                                    />
                                  ));
                                })()}
                              </BarChart>
                            )
                          ) : message.chartType === "line" ? (
                            <LineChart data={message.chartData}>
                              <CartesianGrid key="chat-grid" strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis key="chat-xaxis" dataKey="name" stroke="#64748b" />
                              <YAxis
                                key="chat-yaxis"
                                stroke="#64748b"
                                tickFormatter={(v) => {
                                  if (message.chartValueFormat === "percent") return `${v}%`;
                                  if (typeof v !== "number" || !Number.isFinite(v)) return String(v);
                                  if (message.chartValueFormat === "currency") {
                                    const code = messageCurrency(message);
                                    const sym = currencySymbol(code);
                                    return sym
                                      ? `${sym}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                      : v.toLocaleString();
                                  }
                                  return v.toLocaleString();
                                }}
                              />
                              <Tooltip
                                key="chat-tooltip"
                                formatter={(value: any, name: any) => {
                                  if (typeof value === "number") {
                                    if (message.chartValueFormat === "percent") {
                                      return [
                                        `${value.toFixed(2)}%`,
                                        typeof name === "string" ? name : "Profit margin",
                                      ];
                                    }
                                    return formatMoney(value, messageCurrency(message));
                                  }
                                  return value;
                                }}
                                contentStyle={{
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "8px",
                                }}
                              />
                              {(() => {
                                const firstRow = message.chartData?.[0];
                                if (!isDataRow(firstRow)) return null;

                                const valueKey =
                                  Object.keys(firstRow).find(
                                    (key) => key !== "name" && typeof firstRow[key] === "number",
                                  ) || "sales";

                                return (
                                  <Line
                                    key="value-line-chart"
                                    dataKey={valueKey}
                                    name={chartSeriesDisplayName(message)}
                                    stroke="#1e7a5c"
                                    strokeWidth={3}
                                    dot={{ fill: "#1e7a5c", r: 5 }}
                                    activeDot={{ r: 7 }}
                                  />
                                );
                              })()}
                            </LineChart>
                          ) : (
                            <BarChart data={message.chartData}>
                              <CartesianGrid key="chat-grid" strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis key="chat-xaxis" dataKey="name" stroke="#64748b" />
                              <YAxis
                                key="chat-yaxis"
                                stroke="#64748b"
                                tickFormatter={(v) => {
                                  if (message.chartValueFormat === "percent") return `${v}%`;
                                  if (typeof v !== "number" || !Number.isFinite(v)) return String(v);
                                  if (message.chartValueFormat === "currency") {
                                    const code = messageCurrency(message);
                                    const sym = currencySymbol(code);
                                    return sym
                                      ? `${sym}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                      : v.toLocaleString();
                                  }
                                  return v.toLocaleString();
                                }}
                              />
                              <Tooltip
                                key="chat-tooltip"
                                formatter={(value: any, name: any) => {
                                  if (typeof value === "number") {
                                    if (message.chartValueFormat === "percent") {
                                      return [
                                        `${value.toFixed(2)}%`,
                                        typeof name === "string" ? name : "Profit margin",
                                      ];
                                    }
                                    return formatMoney(value, messageCurrency(message));
                                  }
                                  return value;
                                }}
                                contentStyle={{
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "8px",
                                }}
                              />
                              {(() => {
                                const firstRow = message.chartData?.[0];
                                if (!isDataRow(firstRow)) return null;

                                const valueKey =
                                  Object.keys(firstRow).find(
                                    (key) => key !== "name" && typeof firstRow[key] === "number",
                                  ) || "sales";

                                return (
                                  <Bar
                                    key="value-bar-chart"
                                    dataKey={valueKey}
                                    name={chartSeriesDisplayName(message)}
                                    fill="#1e7a5c"
                                    radius={[8, 8, 0, 0]}
                                  />
                                );
                              })()}
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* KPI Cards */}
                    {message.kpis && message.kpis.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          📊 Key Metrics
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {message.kpis.map((kpi, index) => (
                            <KPICard key={index} kpi={kpi} currency={message.currency} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Enhanced Visualizations */}
                    {message.visualizations && message.visualizations.length > 0 && (
                      <div className="space-y-4">
                        {message.visualizations.map((viz, index) => (
                          <div
                            key={index}
                            className="bg-card border border-border rounded-xl p-4 sm:p-6"
                          >
                            <EnhancedChart visualization={viz} currency={message.currency} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* AI Insights */}
                    {message.insights && message.insights.length > 0 && (
                      <InsightPanel insights={message.insights} />
                    )}

                    {/* Follow-up Suggestions */}
                    {message.follow_up_suggestions && message.follow_up_suggestions.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          🔍 Suggested Follow-ups
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {message.follow_up_suggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => setInput(suggestion)}
                              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-muted dark:text-gray-300"
                            >
                              <ArrowRight className="h-3 w-3" />
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Limitations Warning */}
                    {message.limitations && message.limitations.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                          ⚠️ Data Limitations
                        </p>
                        <ul className="mt-2 space-y-1 text-sm text-amber-800 dark:text-amber-200">
                          {message.limitations.map((limitation, index) => (
                            <li key={index}>• {limitation}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Legacy AI Insight (fallback for old responses) */}
                    {!message.insights &&
                      message.insight &&
                      ((message.table && message.table.length > 0) ||
                        (message.chartData && message.chartData.length > 0)) && (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-2 border-green-200 dark:border-green-800 rounded-xl px-4 sm:px-6 py-5 shadow-sm min-w-0 max-w-full overflow-hidden">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                              💡 Key Insights
                            </h3>
                            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 break-words [overflow-wrap:anywhere]">
                              {message.insight}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Download Options — CSV / JSON / TXT whenever there is tabular or chart data */}
                    {((message.table && message.table.length > 0) ||
                      (message.chartData && message.chartData.length > 0)) && (
                      <div className="border-t border-border pt-4 mt-2 min-w-0 max-w-full">
                        <div className="space-y-3 min-w-0">
                          {/* Download this output */}
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Download this output:</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => downloadMessage(message, "single")}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
                              >
                                <Download className="w-4 h-4" />
                                <span>CSV</span>
                              </button>
                              <button
                                onClick={() => {
                                  const payload = {
                                    table: message.table ?? [],
                                    chartData: message.chartData ?? [],
                                    imageIngest: message.imageIngestMeta ?? null,
                                  };
                                  const jsonContent = JSON.stringify(payload, null, 2);
                                  const blob = new Blob([jsonContent], { type: "application/json" });
                                  const link = document.createElement("a");
                                  link.href = URL.createObjectURL(blob);
                                  link.download = `asklytics_query_${message.id}.json`;
                                  link.click();
                                }}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
                              >
                                <Download className="w-4 h-4" />
                                <span>JSON</span>
                              </button>
                              <button
                                onClick={() => {
                                  const txtContent = `Question: ${messages.find(m => m.id === message.id - 1)?.content || "N/A"}\n\nSQL / notes:\n${message.sql || "N/A"}\n\nTable:\n${JSON.stringify(message.table ?? [], null, 2)}\n\nChart data:\n${JSON.stringify(message.chartData ?? [], null, 2)}\n\nImage ingest meta:\n${JSON.stringify(message.imageIngestMeta ?? null, null, 2)}\n\nInsight:\n${message.insight || "No insight available"}`;
                                  const blob = new Blob([txtContent], { type: "text/plain" });
                                  const link = document.createElement("a");
                                  link.href = URL.createObjectURL(blob);
                                  link.download = `asklytics_query_${message.id}.txt`;
                                  link.click();
                                }}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
                              >
                                <Download className="w-4 h-4" />
                                <span>TXT</span>
                              </button>
                            </div>
                          </div>
                          
                          {/* Download entire chat */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Download entire chat:</p>
                            <button
                              onClick={() => downloadMessage(message, "all")}
                              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              <span>Export Full Conversation (CSV)</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {message.type === "user" && (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} className="h-px w-full shrink-0" aria-hidden />
          </div>
        </div>
      </div>

      {/* Composer: in document flow so it never covers the message list */}
      <div className="shrink-0 border-t border-border bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-5xl mx-auto w-full px-4 pt-3">
          {!isDataLoaded && !uploadedFile && !getToken() && (
            <div className="mb-3 p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm text-center">
              <p className="text-primary">
                ⚠️ Please upload a financial statement file to start analyzing your data
              </p>
            </div>
          )}
          <div className="flex gap-3">
            {/* Always show upload button */}
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.json,.txt,.pdf,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              className="hidden"
              id="chat-file-upload"
            />
            <label
              htmlFor="chat-file-upload"
              className="px-4 py-3 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors cursor-pointer flex items-center gap-2 flex-shrink-0"
              title={
                uploadedFile
                  ? `Replace file (current: ${uploadedFile.name})`
                  : isDataLoaded
                    ? "Upload another file"
                    : "Upload file"
              }
            >
              <Upload className="w-5 h-5" />
              <span className="hidden sm:inline">{isUploading ? "Uploading..." : "Upload"}</span>
            </label>
            {uploadedFile && (
              <button
                type="button"
                onClick={() => clearPendingUpload()}
                className="px-3 py-3 rounded-lg border border-border bg-background hover:bg-muted/60 flex-shrink-0"
                title={`Remove ${uploadedFile.name}`}
                aria-label="Remove uploaded file"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={
                getToken()
                  ? uploadedFile && !fileIngestedToServer
                    ? "Ask a question — PDF/image will be processed when you send…"
                    : uploadedFile && fileIngestedToServer
                      ? "Ask another question (same file is already in the database)…"
                      : "Ask a question about your financial data (server)…"
                  : isDataLoaded
                    ? "Ask a question about your data…"
                    : "Upload a file first, or log in to query the server…"
              }
              disabled={!canChat}
              className="flex-1 px-4 py-3 bg-input-background text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 caret-slate-900 dark:caret-slate-100 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ WebkitTextFillColor: "currentColor" } as React.CSSProperties}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!canChat}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}