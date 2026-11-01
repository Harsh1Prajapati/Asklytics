import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";

export function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  const title = isNotFound ? "Page not found" : "We couldn't load this page";
  const message = isNotFound
    ? "The page you requested does not exist or may have moved."
    : "Please try again. If the problem continues, return to your workspace and retry the action.";

  return (
    <main className="min-h-screen bg-background px-4 py-12 text-foreground sm:px-6">
      <section className="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-primary">ASKLYTICS</p>
        <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Go back
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Try again
          </button>
        </div>
      </section>
    </main>
  );
}
