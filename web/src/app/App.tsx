import { RouterProvider } from "react-router";
import { router } from "./routes";
import { DataProvider } from "./contexts/data-context";
import { HistoryProvider } from "./contexts/history-context";
import { ThemeProvider } from "./contexts/theme-context";
import { AppErrorBoundary } from "./components/app-error-boundary";

export default function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <DataProvider>
          <HistoryProvider>
            <RouterProvider router={router} />
          </HistoryProvider>
        </DataProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
