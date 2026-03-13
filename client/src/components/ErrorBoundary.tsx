import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center px-6 text-center font-sans">
        <div className="w-16 h-16 rounded-2xl bg-white border border-[#E5E5E5] flex items-center justify-center mb-6 text-2xl">
          !
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111] mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-[#666] mb-6 max-w-sm">
          An unexpected error occurred. Please reload the page or go back to the homepage.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="h-10 px-6 rounded-full border border-[#E5E5E5] text-sm font-medium hover:bg-[#F5F5F5] transition-colors"
          >
            Reload
          </button>
          <a
            href="/"
            className="h-10 px-6 rounded-full bg-[#111] text-white text-sm font-medium flex items-center hover:bg-[#222] transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }
}
