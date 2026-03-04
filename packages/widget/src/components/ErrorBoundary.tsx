import { h, Component, type ComponentChildren } from 'preact';

interface ErrorBoundaryProps {
  children: ComponentChildren;
  fallback?: ComponentChildren;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[bogota-insights] Widget render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              padding: '16px',
              fontSize: '13px',
              color: 'var(--bi-text-secondary, #5F6368)',
              textAlign: 'center',
            }}
          >
            Something went wrong loading the widget.
          </div>
        )
      );
    }
    return this.props.children;
  }
}
