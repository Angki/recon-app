import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-6 bg-[var(--bg-card)] border border-red-500/20 rounded-2xl text-center shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <h3 className="text-sm font-bold tracking-wider text-[var(--text-primary)] uppercase mb-1">
            {this.props.fallbackTitle || 'Component Render Interrupted'}
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-md mb-4">
            An unexpected error occurred during terminal rendering. State has been captured safely.
          </p>
          {this.state.error && (
            <pre className="text-[11px] font-mono text-red-300 bg-black/40 px-3 py-2 rounded-lg border border-red-500/20 max-w-lg overflow-x-auto mb-4 text-left">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white shadow-md transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Console</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
