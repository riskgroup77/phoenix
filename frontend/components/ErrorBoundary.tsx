import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { captureClientException } from '../utils/monitoring';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Kutilmagan xatolarda butun ilova «qora ekran» bo‘lmasin.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Noma\'lum xatolik' };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
    captureClientException(error, { componentStack: info.componentStack });
    try {
      window.dispatchEvent(
        new CustomEvent('phoenix-client-error', {
          detail: { message: error?.message, stack: error?.stack },
        })
      );
    } catch {
      /* ignore */
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50/90 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-xl p-8 text-center shadow-[0_24px_80px_-24px_rgba(15,23,42,0.2)]">
            <h1 className="text-xl font-bold text-slate-900 mb-2">Kutilmagan xatolik</h1>
            <p className="text-sm text-slate-500 mb-6">
              Sahifani yangilang yoki bosh sahifaga qayting. Muammo takrorlansa, administratorga xabar bering.
            </p>
            {import.meta.env.DEV && (
              <pre className="text-left text-xs text-red-800/90 bg-black/40 rounded-lg p-3 mb-6 overflow-auto max-h-32">
                {this.state.message}
              </pre>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm"
              >
                Sahifani yangilash
              </button>
              <Link
                to="/dashboard"
                className="px-5 py-2.5 rounded-xl border border-slate-300/80 text-slate-700 hover:bg-slate-100/70 font-semibold text-sm inline-flex items-center justify-center"
              >
                Bosh sahifa
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
