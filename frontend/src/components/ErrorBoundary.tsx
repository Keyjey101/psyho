import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#FAF6F1] p-8 text-center">
          <img
            src="/illustrations/opt/error_network.webp"
            alt=""
            className="h-40 w-40 object-contain opacity-80"
          />
          <p className="text-lg text-[#5C4B3A]">Что-то пошло не так.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-[#B8785A] px-6 py-2 text-sm font-medium text-white hover:bg-[#A06748]"
          >
            Обновить страницу
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
