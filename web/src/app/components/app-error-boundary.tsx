import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Keeps a rendering failure from leaving users on a blank, unrecoverable page.
 * Route-level failures are handled separately by the router error element.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Preserve diagnostic information without muting browser errors globally.
    console.error("Asklytics render error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6">
          <section className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="mb-4 rounded-full bg-destructive/10 p-3 text-destructive">
              <AlertTriangle aria-hidden="true" className="size-7" />
            </div>
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your data has not been changed. Refresh the page to continue working in Asklytics.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Refresh Asklytics
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
