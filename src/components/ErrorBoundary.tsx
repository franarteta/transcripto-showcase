import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[420px] p-8 text-center bg-white rounded-2xl m-6 shadow-sm border border-slate-200">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 text-2xl shadow-inner">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            No se pudo cargar la vista seleccionada
          </h2>
          <p className="text-sm text-slate-600 max-w-md mb-6 leading-relaxed">
            {this.state.error?.message || 'Ocurrió un error inesperado de renderizado.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-rose-900/20"
            >
              Recargar aplicación
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
              }}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition"
            >
              Reintentar
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
