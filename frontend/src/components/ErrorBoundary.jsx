import React from "react";
import { AlertTriangle } from "lucide-react";
import { errorContext, logger } from "../lib/logger";

export class ErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    logger.error("ui.render_failed", {
      ...errorContext(error),
      componentStack: info.componentStack,
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="min-h-screen bg-base-200 flex items-center justify-center p-4">
        <section role="alert" className="card bg-base-100 shadow-xl max-w-md w-full">
          <div className="card-body items-center text-center">
            <AlertTriangle className="h-12 w-12 text-error" />
            <h1 className="card-title">Something went wrong</h1>
            <p className="text-base-content/70">The error was logged. Reload to try again.</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </section>
      </main>
    );
  }
}
