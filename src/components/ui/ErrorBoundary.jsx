import { Component } from 'react';

// Without this, an uncaught render error anywhere in the tree unmounts the
// whole app to a blank white screen with no way to recover except a manual
// hard refresh — this catches it and offers that refresh as a button instead.
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center dark:bg-slate-900">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            Something went wrong.
          </h1>
          <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
