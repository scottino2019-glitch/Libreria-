import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: any;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-wood-dark flex items-center justify-center p-8">
          <div className="paper-texture p-12 max-w-2xl brass-border text-center">
            <h1 className="font-display text-4xl text-wood-dark mb-4 italic">Un Inconveniente nel Manoscritto</h1>
            <p className="font-serif text-wood-dark/70 mb-8 leading-relaxed">
              Sembra che il bibliotecario abbia incontrato un errore imprevisto durante la consultazione dei volumi.
            </p>
            <div className="bg-red-900/10 p-4 rounded-sm border border-red-900/20 text-red-900 text-xs font-mono text-left overflow-auto max-h-40 mb-8">
              {this.state.error?.message || String(this.state.error)}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-gold text-white font-serif hover:bg-gold/80 transition-all rounded-sm shadow-md"
            >
              Riavvia la Biblioteca
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
