import React from 'react'
import { Monitor, FileAudio, FileText, MessageSquare, Linkedin } from 'lucide-react'

interface ShowcaseHeaderProps {
  currentMode: 'desktop' | 'lite'
  onChangeMode: (mode: 'desktop' | 'lite') => void
  onOpenFeedback: () => void
}

export const ShowcaseHeader: React.FC<ShowcaseHeaderProps> = ({
  currentMode,
  onChangeMode,
  onOpenFeedback
}) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white px-4 py-2.5 shadow-lg select-none">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center font-black text-white shadow-md shadow-rose-900/30">
            T
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white leading-none">
                Transcripto
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                v2.5.5 Interactive Demo
              </span>
            </div>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700/60 shadow-inner">
          <button
            type="button"
            onClick={() => onChangeMode('desktop')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentMode === 'desktop'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Transcripto Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('lite')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentMode === 'lite'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5" />
            <span>Transcripto Lite</span>
          </button>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-2">
          <a
            href="./informe_muestra_transcripto.docx"
            download="informe_muestra_transcripto.docx"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Descargar informe real generado en formato Word .docx con portada y tabla de acuerdos"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden md:inline">Descargar</span> Word (.docx)
          </a>

          <button
            type="button"
            onClick={onOpenFeedback}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow transition"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Feedback</span>
          </button>

          <a
            href="https://www.linkedin.com/in/franarteta/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition shadow"
            title="Ver perfil de Franco Arteta en LinkedIn"
          >
            <Linkedin className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  )
}
