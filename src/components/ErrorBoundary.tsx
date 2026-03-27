import React from 'react';
import type { ErrorInfo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
          <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Beklenmeyen Bir Hata Oluştu</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Uygulama çalışırken teknik bir sorun meydana geldi. Lütfen sayfayı yenileyerek tekrar deneyin.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Sayfayı Yenile</span>
          </button>

          {import.meta.env.MODE === 'development' && this.state.error && (
            <div className="mt-8 w-full max-w-2xl text-left">
              <p className="font-semibold text-rose-500 mb-2">Hata Detayı (Sadece Geliştirici Ortamı):</p>
              <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-x-auto text-xs text-slate-700 dark:text-slate-300">
                {this.state.error.toString()}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
