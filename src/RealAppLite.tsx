import React, { useEffect, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, Archive, CheckCircle2, ChevronRight, Clock3, Copy, ExternalLink,
  FileAudio, FilePlus2, FileText, FolderOpen, Globe2, Home, Info, Mic2, Pause, Play,
  RefreshCw, Search, Settings, Sparkles, Square, Upload, WandSparkles, X,
  Edit3, User, UserCheck, UserPlus,
} from 'lucide-react'
import { PrettyText } from './components/PrettyText'

type Page = 'home' | 'live' | 'import' | 'history' | 'results' | 'settings'

interface Source {
  id: string
  label: string
}

interface HistorySession {
  session_id: string
  title: string
  created_at: string
  duration_sec: number
  transcript: string
  summary: string
  engine_used: string
  audio_path: string
}

interface BootstrapLite {
  status: string
  is_recording: boolean
  is_paused: boolean
  is_processing: boolean
  current_session_id: string | null
  save_dir: string
  microphones: Source[]
  desktop_sources: Source[]
  selected_mic: string
  selected_desktop: string
  settings: {
    has_groq_key?: boolean
    has_gemini_key?: boolean
    groq_models?: string[]
    gemini_models?: string[]
    groq_transcription_models?: string[]
    groq_summary_models?: string[]
    gemini_transcription_models?: string[]
    gemini_summary_models?: string[]
    selected_groq_transcription_model?: string
    selected_groq_summary_model?: string
    selected_gemini_transcription_model?: string
    selected_gemini_summary_model?: string
    local_whisper_model?: string
    save_dir?: string
    auto_cleanup?: boolean
  }
  history: HistorySession[]
  groq_speech_models: string[]
  groq_transcription_models?: string[]
  groq_summary_models: string[]
  gemini_models: string[]
  gemini_transcription_models?: string[]
  gemini_summary_models?: string[]
  local_models: string[]
}

const defaultBoot: BootstrapLite = {
  status: 'Listo',
  is_recording: false,
  is_paused: false,
  is_processing: false,
  current_session_id: null,
  save_dir: '',
  microphones: [
    { id: 'default', label: 'Micrófono predeterminado de Windows' },
    { id: 'none', label: 'Desactivado (No grabar micrófono)' }
  ],
  desktop_sources: [
    { id: 'loop::default', label: 'Audio del sistema predeterminado' },
    { id: 'none', label: 'Desactivado (No grabar audio del sistema)' }
  ],
  selected_mic: 'default',
  selected_desktop: 'loop::default',
  settings: {
    has_groq_key: false,
    has_gemini_key: false,
    groq_models: ['whisper-large-v3', 'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    gemini_models: ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
    local_whisper_model: 'medium',
    auto_cleanup: true,
  },
  history: [],
  groq_speech_models: ['whisper-large-v3', 'whisper-large-v3-turbo', 'distil-whisper-large-v3-en'],
  groq_summary_models: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  gemini_models: ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  local_models: ['medium', 'small', 'base']
}

declare global {
  interface Window {
    pywebview?: { api: Record<string, (...args: any[]) => Promise<any>> }
    transcriptoLiteEvent?: (event: any) => void
    __onLiteEvent?: (name: string, payload: any) => void
  }
}

const call = async (name: string, ...args: any[]) => {
  const fn = window.pywebview?.api?.[name]
  if (!fn) throw new Error('La interfaz nativa se está iniciando...')
  return fn(...args)
}

const formatSeconds = (sec = 0) => {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rem = s % 60
  return h
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`
}

function SpeakerModalLite({
  isOpen,
  currentSpeaker,
  segmentIndex,
  existingSpeakers,
  onRenameGlobal,
  onReassignSegment,
  onClose,
}: {
  isOpen: boolean
  currentSpeaker: string
  segmentIndex: number | null
  existingSpeakers: string[]
  onRenameGlobal: (newName: string) => Promise<void>
  onReassignSegment: (newName: string) => Promise<void>
  onClose: () => void
}) {
  const [globalName, setGlobalName] = useState(currentSpeaker)
  const [newParticipant, setNewParticipant] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setGlobalName(currentSpeaker)
    setNewParticipant('')
  }, [currentSpeaker, isOpen])

  if (!isOpen) return null

  const handleGlobal = async () => {
    const trimmed = globalName.trim()
    if (!trimmed) return
    setLoading(true)
    try {
      await onRenameGlobal(trimmed)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleReassign = async (targetName: string) => {
    const trimmed = targetName.trim()
    if (!trimmed) return
    setLoading(true)
    try {
      await onReassignSegment(trimmed)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0', overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f0f9ff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={18} color="#0284c7" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Identificar Hablante</h3>
          </div>
          <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Renombrar a "{currentSpeaker}" en toda la grabación
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={globalName}
                onChange={e => setGlobalName(e.target.value)}
                placeholder="Ej. Franco, Dra. González…"
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
                  fontSize: 14, outline: 'none'
                }}
                onKeyDown={e => { if (e.key === 'Enter') handleGlobal() }}
              />
              <button
                className="btn primary"
                disabled={loading || !globalName.trim() || globalName.trim() === currentSpeaker}
                onClick={handleGlobal}
                style={{ whiteSpace: 'nowrap', padding: '8px 14px', fontSize: 13, background: '#0284c7' }}
              >
                <UserCheck size={14} style={{ marginRight: 4 }} />
                Aplicar a todos
              </button>
            </div>
            <p style={{ margin: '5px 0 0', fontSize: 11.5, color: '#64748b' }}>
              Actualiza esta etiqueta en todos los párrafos y regenera el informe Word .docx.
            </p>
          </div>

          {segmentIndex !== null && (
            <div style={{ marginBottom: 12, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                O reasignar sólo este párrafo a otro participante:
              </label>
              {existingSpeakers.filter(sp => sp !== currentSpeaker).length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {existingSpeakers.filter(sp => sp !== currentSpeaker).map(sp => (
                    <button
                      key={sp}
                      type="button"
                      disabled={loading}
                      onClick={() => handleReassign(sp)}
                      style={{
                        padding: '5px 10px', borderRadius: 20, border: '1px solid #bae6fd',
                        background: '#f0f9ff', color: '#0369a1', fontSize: 12.5, fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
                      }}
                    >
                      <User size={12} color="#0284c7" />
                      {sp}
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ margin: '0 0 10px', fontSize: 12, color: '#94a3b8' }}>
                  No hay otros participantes registrados todavía.
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  type="text"
                  value={newParticipant}
                  onChange={e => setNewParticipant(e.target.value)}
                  placeholder="+ Nuevo participante para esta frase…"
                  style={{
                    flex: 1, padding: '7px 11px', borderRadius: 8, border: '1px solid #cbd5e1',
                    fontSize: 13, outline: 'none'
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && newParticipant.trim()) handleReassign(newParticipant.trim()) }}
                />
                <button
                  type="button"
                  className="btn ghost"
                  disabled={loading || !newParticipant.trim()}
                  onClick={() => handleReassign(newParticipant.trim())}
                  style={{ padding: '7px 12px', fontSize: 12.5 }}
                >
                  <UserPlus size={14} style={{ marginRight: 4 }} />
                  Asignar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function validateWebUrl(rawUrl: string): { valid: boolean; error?: string; cleanUrl?: string } {
  let url = (rawUrl || '').trim()
  if (!url) {
    return { valid: false, error: 'Ingresá una dirección web (URL) para transcribir.' }
  }
  for (let i = 0; i < 3; i++) {
    url = url.replace(/[.,;:]+$/, '').trim()
    if (
      (url.startsWith('"') && url.endsWith('"')) ||
      (url.startsWith("'") && url.endsWith("'")) ||
      (url.startsWith('<') && url.endsWith('>')) ||
      (url.startsWith('(') && url.endsWith(')')) ||
      (url.startsWith('[') && url.endsWith(']')) ||
      (url.startsWith('{') && url.endsWith('}')) ||
      (url.startsWith('«') && url.endsWith('»'))
    ) {
      url = url.slice(1, -1).trim()
    } else {
      break
    }
  }
  url = url.replace(/[.,;:]+$/, '').trim()
  if (
    /^(?:localhost(?::\d+)?|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?::\d+)?)(?:\/.*)?$/i.test(url) &&
    !url.includes('://')
  ) {
    url = 'https://' + url
  }
  const lower = url.toLowerCase()
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    return { valid: false, error: 'La dirección web no es válida. Debe comenzar con http:// o https://.' }
  }
  try {
    const parsed = new URL(url)
    if (!parsed.hostname) {
      return { valid: false, error: 'La dirección web no es válida. Falta el nombre del servidor o dominio.' }
    }
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()
    if (
      (host.includes('drive.google.com') || host.includes('docs.google.com')) &&
      (path.includes('/drive/folders/') || path.includes('/folders/') || path.includes('embeddedfolderview'))
    ) {
      return { valid: false, error: 'El enlace corresponde a una carpeta de Google Drive. Ingresá el enlace a un archivo individual, no a una carpeta.' }
    }
    if (
      host.includes('dropbox.com') &&
      (path.includes('/scl/fo/') || path.includes('/sh/'))
    ) {
      return { valid: false, error: 'El enlace corresponde a una carpeta de Dropbox. Ingresá el enlace a un archivo individual, no a una carpeta.' }
    }
    return { valid: true, cleanUrl: url }
  } catch {
    return { valid: false, error: 'La dirección web no tiene un formato válido.' }
  }
}

function getProviderBadgeStyle(provider: string) {
  switch (provider) {
    case 'youtube':
      return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5', label: 'YouTube' }
    case 'google_drive':
      return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0', label: 'Google Drive' }
    case 'zoom':
      return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', label: 'Zoom Cloud' }
    case 'dropbox':
      return { bg: '#f0f9ff', text: '#0284c7', border: '#bae6fd', label: 'Dropbox' }
    case 'direct':
      return { bg: '#f8fafc', text: '#334155', border: '#cbd5e1', label: 'Enlace directo' }
    case 'generic':
      return { bg: '#f8fafc', text: '#475569', border: '#cbd5e1', label: 'Audio / Video web' }
    default:
      return { bg: '#f8fafc', text: '#475569', border: '#cbd5e1', label: 'Audio / Video web' }
  }
}

export default function AppLite() {
  const [page, setPage] = useState<Page>('home')
  const [boot, setBoot] = useState<BootstrapLite>(defaultBoot)
  const [status, setStatus] = useState('Listo')
  const [toast, setToast] = useState('')
  const [progress, setProgress] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [result, setResult] = useState<any | null>(null)
  const [transcriptViewMode, setTranscriptViewMode] = useState<'blocks' | 'text'>('blocks')
  const [speakerModalOpen, setSpeakerModalOpen] = useState(false)
  const [activeSpeaker, setActiveSpeaker] = useState('')
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null)

  // Recording form state
  const [selectedMic, setSelectedMic] = useState('default')
  const [selectedDesktop, setSelectedDesktop] = useState('loop::default')
  const [saveDir, setSaveDir] = useState('')

  // Import form state
  const [importMode, setImportMode] = useState<'file' | 'url'>('file')
  const [importFile, setImportFile] = useState<any | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [urlMeta, setUrlMeta] = useState<any | null>(null)
  const [urlError, setUrlError] = useState('')
  const [isInspectingUrl, setIsInspectingUrl] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isWindowDragging, setIsWindowDragging] = useState(false)
  const dragCounterRef = useRef(0)
  const inspectSeqRefLite = useRef(0)
  const urlInputRefLite = useRef<HTMLInputElement>(null)
  const [enhanceAudio, setEnhanceAudio] = useState(true)
  const dropActive = Boolean(isDragging || isWindowDragging)

  useEffect(() => {
    if (importFile) setImportMode('file')
  }, [importFile])

  useEffect(() => {
    if (page === 'import' && importMode === 'url') {
      const t = window.setTimeout(() => urlInputRefLite.current?.focus(), 50)
      return () => window.clearTimeout(t)
    }
  }, [page, importMode])

  // Level monitoring
  const [micLevel, setMicLevel] = useState(0)
  const [desktopLevel, setDesktopLevel] = useState(0)

  const timerRef = useRef<any>(null)

  const notify = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 4000)
  }

  const refreshBoot = async () => {
    try {
      const data = await call('bootstrap')
      if (data) {
        setBoot(prev => ({ ...prev, ...data }))
        if (data.status) setStatus(data.status)
        if (data.save_dir && !saveDir) setSaveDir(data.save_dir)
        if (data.selected_mic) setSelectedMic(data.selected_mic)
        if (data.selected_desktop) setSelectedDesktop(data.selected_desktop)
        if (data.is_recording !== undefined) setIsRecording(data.is_recording)
        if (data.is_paused !== undefined) setIsPaused(data.is_paused)
        if (data.is_processing !== undefined) setIsProcessing(data.is_processing)
      }
    } catch (e: any) {
      console.debug('Error refreshing bootstrap:', e)
    }
  }

  // Initial connect
  useEffect(() => {
    let attempts = 0
    let cancelled = false
    const init = async () => {
      attempts++
      try {
        await refreshBoot()
      } catch (e) {
        if (!cancelled && attempts < 10) {
          window.setTimeout(init, 300)
        }
      }
    }
    window.addEventListener('pywebviewready', init)
    init()
    return () => {
      cancelled = true
      window.removeEventListener('pywebviewready', init)
    }
  }, [])

  // Event handlers
  useEffect(() => {
    const handleEvent = (event: any) => {
      if (!event) return
      const kind = event.kind || event.event_name
      if (kind === 'state_changed') {
        if (event.is_recording !== undefined) setIsRecording(event.is_recording)
        if (event.is_paused !== undefined) setIsPaused(event.is_paused)
        if (event.is_processing !== undefined) setIsProcessing(event.is_processing)
        if (event.status) setStatus(event.status)
      } else if (kind === 'progress') {
        const val = event.value !== undefined ? Number(event.value) : 0.5
        setProgress(val)
        if (event.message) setStatus(event.message)
      } else if (kind === 'audio_level') {
        if (event.mic_rms !== undefined) setMicLevel(event.mic_rms)
        if (event.desktop_rms !== undefined) setDesktopLevel(event.desktop_rms)
      } else if (kind === 'pipeline_completed' || kind === 'result') {
        setIsProcessing(false)
        setProgress(1)
        setStatus('¡Procesamiento finalizado con éxito!')
        const res = event.result || event
        setResult(res)
        setPage('results')
        notify('Transcripción y resumen completados.')
        refreshBoot()
      } else if (kind === 'pipeline_error' || kind === 'error') {
        setIsProcessing(false)
        setStatus('Listo')
        notify(event.error || event.message || 'Error durante el procesamiento')
      }
    }

    window.transcriptoLiteEvent = handleEvent
    window.__onLiteEvent = (name, payload) => handleEvent({ kind: name, ...payload })

    return () => {
      delete window.transcriptoLiteEvent
      delete window.__onLiteEvent
    }
  }, [])

  // Timer effect
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordSeconds(s => s + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRecording, isPaused])

  // Recording controls
  const handleStartRecording = async () => {
    try {
      setStatus('Iniciando captura de audio...')
      const res = await call('start_recording', selectedMic, selectedDesktop, saveDir)
      if (res.success) {
        setIsRecording(true)
        setIsPaused(false)
        setRecordSeconds(0)
        setActiveSessionId(res.session_id)
        setStatus('Grabando reunión...')
        notify('Grabación de audio iniciada.')
      } else {
        notify(res.error || 'No se pudo iniciar la grabación.')
      }
    } catch (e: any) {
      notify(e.message || 'Error al iniciar grabación')
    }
  }

  const handlePauseRecording = async () => {
    try {
      const res = await call('pause_recording')
      if (res.success) {
        setIsPaused(res.is_paused)
        setStatus(res.is_paused ? 'Grabación en pausa' : 'Grabando reunión...')
      }
    } catch (e: any) {
      notify(e.message)
    }
  }

  const handleStopRecording = async () => {
    try {
      setStatus('Deteniendo grabación y preparando audio...')
      setIsRecording(false)
      setIsProcessing(true)
      setProgress(0.05)
      const res = await call('stop_recording')
      if (res.success) {
        notify('Audio guardado. Procesando transcripción y resumen...')
      } else {
        notify(res.error || 'Error al detener grabación')
        setIsProcessing(false)
      }
    } catch (e: any) {
      notify(e.message)
      setIsProcessing(false)
    }
  }

  // Import controls
  const handleChooseMedia = async () => {
    try {
      const chosen = await call('choose_media')
      if (chosen) setImportFile(chosen)
    } catch (e: any) {
      notify(e.message || 'Error al seleccionar archivo')
    }
  }

  const processDroppedFile = async (dropped: File) => {
    setIsWindowDragging(false)
    setIsDragging(false)
    dragCounterRef.current = 0
    const filePath = (dropped as any).path
    if (filePath) {
      try {
        const inspected = await call('inspect_file', filePath)
        if (inspected) {
          setImportFile(inspected)
          setPage('import')
          notify(`Archivo cargado: ${inspected.name}`)
        }
      } catch (err: any) {
        notify(err?.message || 'No se pudo leer el archivo')
      }
    } else {
      if (dropped.size > 150 * 1024 * 1024) {
        notify('El archivo es mayor a 150 MB. Usá el botón para seleccionar el archivo directamente desde el disco.')
        return
      }
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1]
          const inspected = await call('save_dropped_file', dropped.name, base64)
          if (inspected) {
            setImportFile(inspected)
            setPage('import')
            notify(`Archivo cargado: ${inspected.name}`)
          }
        } catch (err: any) {
          notify(err?.message || 'Error al procesar el archivo arrastrado')
        }
      }
      reader.readAsDataURL(dropped)
    }
  }

  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }
    const handleGlobalDragEnter = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
      dragCounterRef.current++
      if (dragCounterRef.current === 1) {
        setIsWindowDragging(true)
      }
    }
    const handleGlobalDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current--
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0
        setIsWindowDragging(false)
      }
    }
    const handleGlobalDrop = async (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setIsWindowDragging(false)
      setIsDragging(false)
      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        await processDroppedFile(files[0])
      }
    }
    const handleCancelDrag = () => {
      dragCounterRef.current = 0
      setIsWindowDragging(false)
      setIsDragging(false)
    }

    window.addEventListener('dragover', handleGlobalDragOver, false)
    window.addEventListener('dragenter', handleGlobalDragEnter, false)
    window.addEventListener('dragleave', handleGlobalDragLeave, false)
    window.addEventListener('drop', handleGlobalDrop, false)
    window.addEventListener('dragend', handleCancelDrag, false)
    window.addEventListener('blur', handleCancelDrag, false)
    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver, false)
      window.removeEventListener('dragenter', handleGlobalDragEnter, false)
      window.removeEventListener('dragleave', handleGlobalDragLeave, false)
      window.removeEventListener('drop', handleGlobalDrop, false)
      window.removeEventListener('dragend', handleCancelDrag, false)
      window.removeEventListener('blur', handleCancelDrag, false)
    }
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (!files || files.length === 0) return
    await processDroppedFile(files[0])
  }

  const handleRunImport = async () => {
    if (!importFile) return
    try {
      setIsProcessing(true)
      setProgress(0.05)
      setStatus(`Importando ${importFile.name}...`)
      await call('transcribe_file', { path: importFile.path, folder: saveDir })
      notify('Procesando audio importado...')
    } catch (e: any) {
      notify(e.message || 'Error al procesar archivo')
      setIsProcessing(false)
    }
  }

  const handleInspectUrlLite = async (rawUrl?: string) => {
    const targetUrl = (rawUrl !== undefined ? rawUrl : urlInput).trim()
    if (!targetUrl) {
      setUrlError('Ingresá una dirección web (URL) para transcribir.')
      return
    }
    const validation = validateWebUrl(targetUrl)
    if (!validation.valid) {
      setUrlError(validation.error || 'Dirección web no válida.')
      return
    }
    const cleanUrl = validation.cleanUrl || targetUrl
    if (cleanUrl !== urlInput) {
      setUrlInput(cleanUrl)
    }
    setUrlError('')
    const reqId = ++inspectSeqRefLite.current
    setIsInspectingUrl(true)
    try {
      const meta = await call('inspect_url', cleanUrl)
      if (inspectSeqRefLite.current !== reqId) return
      setUrlMeta(meta)
    } catch (err: any) {
      if (inspectSeqRefLite.current !== reqId) return
      setUrlMeta(null)
      setUrlError(err?.message || 'No se pudo obtener información del enlace. Verificá que sea accesible.')
    } finally {
      if (inspectSeqRefLite.current === reqId) {
        setIsInspectingUrl(false)
      }
    }
  }

  const handlePasteUrlLite = async () => {
    try {
      if (!navigator?.clipboard?.readText) {
        setUrlError('El acceso al portapapeles no está disponible en este navegador. Pegá el enlace manualmente (Ctrl+V).')
        return
      }
      const text = await navigator.clipboard.readText()
      const clean = (text || '').trim()
      if (!clean) {
        setUrlError('El portapapeles está vacío. Copiá un enlace primero.')
        return
      }
      inspectSeqRefLite.current++
      setUrlInput(clean)
      setUrlError('')
      setUrlMeta(null)
      void handleInspectUrlLite(clean)
    } catch {
      setUrlError('No se pudo leer el portapapeles. Verificá los permisos o pegá el enlace manualmente (Ctrl+V).')
    }
  }

  const handleRunImportUrl = async () => {
    const cleanInput = urlInput.trim()
    if (!cleanInput) {
      notify('Ingresá una dirección web (URL) para transcribir.')
      setUrlError('Ingresá una dirección web (URL) para transcribir.')
      return
    }
    const validation = validateWebUrl(cleanInput)
    if (!validation.valid) {
      notify(validation.error || 'Dirección web no válida.')
      setUrlError(validation.error || 'Dirección web no válida.')
      return
    }
    const finalUrl = validation.cleanUrl || cleanInput
    const isMetaMatching = urlMeta && (urlMeta.url === cleanInput || urlMeta.url === finalUrl)
    const finalTitle = isMetaMatching ? (urlMeta?.title || '') : ''

    setImportFile(null)

    try {
      setIsProcessing(true)
      setProgress(0.02)
      setStatus('Conectando al enlace web...')
      const res = await call('transcribe_url', {
        url: finalUrl,
        title: finalTitle,
        folder: saveDir,
      })
      if (res && res.success === false) {
        setIsProcessing(false)
        notify(res.error || 'Error al procesar enlace web')
      } else {
        notify('Descargando y procesando audio del enlace web...')
      }
    } catch (e: any) {
      setIsProcessing(false)
      notify(e.message || 'Error al transcribir enlace')
    }
  }

  const handleChooseFolder = async () => {
    try {
      const chosen = await call('choose_folder', saveDir)
      if (chosen) {
        setSaveDir(chosen)
        notify(`Carpeta seleccionada: ${chosen}`)
      }
    } catch (e: any) {
      notify(e.message || 'Error al seleccionar carpeta')
    }
  }

  const handleOpenUrl = async (url: string) => {
    try {
      await call('open_external_url', url)
    } catch (e: any) {
      window.open(url, '_blank')
    }
  }

  const distinctSpeakers: string[] = Array.from(
    new Set(((result?.segments || []) as any[]).map(s => s.speaker).filter(Boolean) as string[])
  )

  const handleOpenSpeakerModal = (speaker: string, index: number | null) => {
    setActiveSpeaker(speaker || 'Micrófono')
    setActiveSegmentIndex(index)
    setSpeakerModalOpen(true)
  }

  const handleRenameGlobal = async (newName: string) => {
    const sId = result?.session_id || boot.current_session_id || ''
    try {
      const updated = await call('rename_speaker', sId, activeSpeaker, newName, null)
      if (updated) {
        setResult(updated)
      }
      notify(`Hablante "${activeSpeaker}" renombrado a "${newName}" en toda la reunión.`)
    } catch (e: any) {
      notify(e.message || 'No se pudo renombrar el hablante')
    }
  }

  const handleReassignSegment = async (targetName: string) => {
    const sId = result?.session_id || boot.current_session_id || ''
    try {
      const updated = await call('rename_speaker', sId, activeSpeaker, targetName, activeSegmentIndex)
      if (updated) {
        setResult(updated)
      }
      notify(`Párrafo reasignado a "${targetName}".`)
    } catch (e: any) {
      notify(e.message || 'No se pudo reasignar el párrafo')
    }
  }

  const nav = [
    ['home', 'Inicio', Home],
    ['live', 'Grabar reunión', Mic2],
    ['import', 'Importar archivo', FilePlus2],
    ['history', 'Historial', Archive],
  ] as const

  return (
    <div className="app">
      {/* Rail Sidebar - Idéntico a Transcripto Base */}
      <aside className="rail">
        <div
          className="logo"
          style={{
            background: 'linear-gradient(145deg, #38bdf8, #0284c7)',
            boxShadow: '0 9px 22px rgba(2, 132, 199, 0.25)',
          }}
          title="Transcripto Lite"
        >
          TL
        </div>

        {nav.map(([id, label, Icon]) => (
          <button
            key={id}
            data-tip={label}
            className={`nav-btn ${id === 'live' ? 'record' : ''} ${page === id ? 'active' : ''}`}
            onClick={() => setPage(id)}
          >
            <Icon size={22} />
          </button>
        ))}

        <div className="rail-spacer" />

        <button
          data-tip="Configuración"
          className={`nav-btn ${page === 'settings' ? 'active' : ''}`}
          onClick={() => setPage('settings')}
        >
          <Settings size={22} />
        </button>

        <div className="privacy-dot" title="Procesamiento local disponible" />
      </aside>

      {/* Main Workspace */}
      <main className="workspace">
        <header className="titlebar">
          <div />
          <span className="window-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            transcripto <span style={{ fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>LITE</span>
          </span>
          <span className="status-pill">
            <i style={{ background: isRecording ? '#ef4444' : isProcessing ? '#f59e0b' : '#22c55e' }} />
            {status}
          </span>
        </header>

        {/* 1. Página Inicio */}
        {page === 'home' && (
          <div className="page narrow">
            <section className="hero" style={{ background: 'linear-gradient(130deg, #f0f9ff, #e0f2fe)', borderColor: '#bae6fd' }}>
              <div>
                <div className="eyebrow" style={{ color: '#0284c7' }}>LITE · SIMPLE · PRIVADO</div>
                <h1>Convertí conversaciones en decisiones claras.</h1>
                <p>Grabá tus reuniones con un clic, limpiá las voces con filtros acústicos avanzados y recibí el resumen al instante.</p>
                <div className="actions">
                  <button className="btn danger" onClick={() => setPage('live')}>
                    <Mic2 size={18} /> Grabar reunión
                  </button>
                  <button className="btn ghost" onClick={() => setPage('import')}>
                    <Upload size={18} /> Importar archivo
                  </button>
                </div>
              </div>
              <div className="hero-visual">
                <div
                  className="orb"
                  style={{
                    background: 'radial-gradient(circle at 35% 35%, #7dd3fc, #0284c7 60%, #0369a1)',
                    boxShadow: '0 25px 70px rgba(2, 132, 199, 0.28)',
                  }}
                >
                  <Activity size={66} />
                </div>
              </div>
            </section>

            <div className="grid-3" style={{ marginTop: 20 }}>
              <div className="card feature">
                <div className="feature-icon" style={{ color: '#0284c7', background: '#e0f2fe' }}><Mic2 size={20} /></div>
                <b>Grabador de un solo botón</b>
                <p>Captura simultánea de tu micrófono y el audio de la reunión (Zoom, Google Meet, Teams).</p>
              </div>
              <div className="card feature">
                <div className="feature-icon" style={{ color: '#0284c7', background: '#e0f2fe' }}><WandSparkles size={20} /></div>
                <b>Limpieza acústica DSP</b>
                <p>Filtro de frecuencias molestas, eliminación de ruido de fondo y normalización a -16 LUFS.</p>
              </div>
              <div className="card feature">
                <div className="feature-icon" style={{ color: '#0284c7', background: '#e0f2fe' }}><Sparkles size={20} /></div>
                <b>Transcripción y resumen</b>
                <p>Groq ultra rápido, Gemini multimodal o Whisper local cuando no hay conexión a Internet.</p>
              </div>
            </div>
          </div>
        )}

        {/* 2. Página Grabar Reunión */}
        {page === 'live' && (
          <div className="page narrow">
            <div className="page-header">
              <div>
                <div className="eyebrow" style={{ color: '#0284c7' }}>GRABACIÓN DE VOZ</div>
                <h1>Grabar reunión</h1>
                <p>Elegí tus dispositivos de entrada y grabá la conversación. Al detener, se procesa el resumen.</p>
              </div>
              <button className="btn ghost" onClick={refreshBoot} title="Actualizar dispositivos">
                <RefreshCw size={16} /> Actualizar fuentes
              </button>
            </div>

            {/* Selector de Dispositivos */}
            <div className="card card-pad" style={{ marginBottom: 20 }}>
              <div className="grid-2">
                <div className="field">
                  <label>Micrófono</label>
                  <select value={selectedMic} onChange={e => setSelectedMic(e.target.value)} disabled={isRecording || isProcessing}>
                    {boot.microphones.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Audio del sistema (Reunión / Zoom / Meet)</label>
                  <select value={selectedDesktop} onChange={e => setSelectedDesktop(e.target.value)} disabled={isRecording || isProcessing}>
                    {boot.desktop_sources.map(d => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label>Carpeta de guardado</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={saveDir} readOnly placeholder="Carpeta de Documentos/Grabaciones" />
                  <button className="btn ghost" onClick={handleChooseFolder} disabled={isRecording || isProcessing} title="Elegir carpeta">
                    <FolderOpen size={16} /> Examinar...
                  </button>
                </div>
              </div>
            </div>

            {/* Consola Central de Grabación */}
            <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ marginBottom: 16 }}>
                <span className={`status-pill`} style={{ display: 'inline-flex', padding: '8px 16px', fontSize: 14 }}>
                  <i style={{ background: isRecording ? '#ef4444' : isProcessing ? '#f59e0b' : '#22c55e' }} />
                  {isRecording ? (isPaused ? 'En pausa' : 'Grabando reunión en vivo...') : isProcessing ? 'Procesando transcripción y resumen...' : 'Listo para grabar'}
                </span>
              </div>

              {/* Cronómetro Digital */}
              <div style={{ fontSize: 56, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '-0.03em', color: '#0f172a', margin: '20px 0' }}>
                {formatSeconds(recordSeconds)}
              </div>

              {/* Botón Central y Acciones */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                {!isRecording && !isProcessing && (
                  <button
                    className="btn danger"
                    style={{ height: 64, padding: '0 36px', borderRadius: 32, fontSize: 18 }}
                    onClick={handleStartRecording}
                  >
                    <Mic2 size={24} /> Iniciar grabación
                  </button>
                )}

                {isRecording && (
                  <>
                    <button
                      className="btn ghost"
                      style={{ height: 52, padding: '0 24px', borderRadius: 26 }}
                      onClick={handlePauseRecording}
                    >
                      {isPaused ? <Play size={20} /> : <Pause size={20} />}
                      {isPaused ? 'Reanudar' : 'Pausar'}
                    </button>
                    <button
                      className="btn danger"
                      style={{ height: 52, padding: '0 28px', borderRadius: 26 }}
                      onClick={handleStopRecording}
                    >
                      <Square size={20} /> Detener y procesar
                    </button>
                  </>
                )}
              </div>

              {/* Barra de Progreso en Vivo durante el procesamiento */}
              {isProcessing && (
                <div style={{ maxWidth: 640, margin: '32px auto 0', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                    <b>{status}</b>
                    <span style={{ fontWeight: 700, color: '#0284c7' }}>{Math.round(progress * 100)}%</span>
                  </div>
                  <div className="progress" style={{ height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.max(5, progress * 100)}%`, background: '#0284c7', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. Página Importar Archivo */}
        {page === 'import' && (
          <div className="page narrow">
            <div className="page-header">
              <div>
                <div className="eyebrow" style={{ color: '#0284c7' }}>IMPORTAR</div>
                <h1>Audio o video a texto</h1>
                <p>Elegí cualquier archivo multimedia o pegá un enlace web para limpiarlo, transcribirlo y generar el informe de la reunión.</p>
              </div>
            </div>

            <div style={{ display: 'inline-flex', background: '#f1f5f9', borderRadius: 10, padding: 3, marginBottom: 18 }}>
              <button
                type="button"
                className="btn ghost"
                disabled={isProcessing}
                style={{
                  fontSize: 13, padding: '6px 14px', borderRadius: 8, border: 'none',
                  background: importMode === 'file' ? '#0284c7' : 'transparent',
                  color: importMode === 'file' ? '#ffffff' : '#64748b',
                  fontWeight: importMode === 'file' ? 600 : 500,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  opacity: isProcessing ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: 6
                }}
                onClick={() => setImportMode('file')}
              >
                <Upload size={14} />
                Archivo local
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={isProcessing}
                style={{
                  fontSize: 13, padding: '6px 14px', borderRadius: 8, border: 'none',
                  background: importMode === 'url' ? '#0284c7' : 'transparent',
                  color: importMode === 'url' ? '#ffffff' : '#64748b',
                  fontWeight: importMode === 'url' ? 600 : 500,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  opacity: isProcessing ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: 6
                }}
                onClick={() => setImportMode('url')}
              >
                <Globe2 size={14} />
                Pegar enlace web
              </button>
            </div>

            <div className="grid-2">
              <div>
                {importMode === 'file' ? (
                  <div
                    className={`dropzone ${dropActive ? 'dragging' : ''}`}
                    onClick={handleChooseMedia}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={{
                      minHeight: 260,
                      ...(dropActive ? { borderColor: '#0284c7', background: 'rgba(2, 132, 199, 0.08)', transform: 'scale(1.01)', transition: 'all 0.15s ease' } : {})
                    }}
                  >
                    {importFile ? (
                      <div>
                        <CheckCircle2 size={48} color="#22c55e" style={{ margin: '0 auto' }} />
                        <h2 style={{ marginTop: 14 }}>{importFile.name}</h2>
                        <p>{importFile.details}</p>
                        <button className="btn ghost" style={{ marginTop: 12 }}>Cambiar archivo</button>
                      </div>
                    ) : (
                      <div>
                        <div className="drop-icon"><Upload size={28} /></div>
                        <h2>{dropActive ? 'Soltá el archivo acá' : 'Elegí o arrastrá un audio o video'}</h2>
                        <p>MP3, WAV, M4A, MP4, MOV, MKV, FLAC, WEBM</p>
                        <button className="btn primary" style={{ background: '#0284c7', marginTop: 14 }}>Explorar archivos</button>
                        <button
                          type="button"
                          className="btn soft"
                          style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          onClick={e => {
                            e.stopPropagation()
                            handleChooseMedia()
                          }}
                        >
                          <Sparkles size={14} color="#0284c7" />
                          <span>Cargar archivo de muestra</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="card card-pad" style={{ minHeight: 260, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: 14 }}>
                      <label
                        htmlFor="web-url-input-lite"
                        style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}
                      >
                        Dirección web del audio o video
                      </label>
                      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#64748b', lineHeight: 1.45 }}>
                        Pegá un enlace de YouTube, Google Drive, Zoom Cloud, Dropbox o una URL directa para transcribirlo.
                      </p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input
                          ref={urlInputRefLite}
                          id="web-url-input-lite"
                          type="url"
                          aria-label="Dirección web del audio o video"
                          aria-invalid={Boolean(urlError)}
                          aria-describedby={urlError ? 'web-url-error-lite' : undefined}
                          aria-busy={isInspectingUrl}
                          value={urlInput}
                          onChange={e => {
                            const val = e.target.value
                            inspectSeqRefLite.current++
                            setUrlInput(val)
                            setUrlError('')
                            if (urlMeta && urlMeta.url !== val.trim()) {
                              setUrlMeta(null)
                            }
                          }}
                          onPaste={e => {
                            const pasted = e.clipboardData?.getData('text') || ''
                            const cleanPasted = pasted.trim()
                            if (cleanPasted) {
                              e.preventDefault()
                              inspectSeqRefLite.current++
                              const validation = validateWebUrl(cleanPasted)
                              if (validation.valid) {
                                const cleanUrl = validation.cleanUrl || cleanPasted
                                setUrlInput(cleanUrl)
                                setUrlError('')
                                setUrlMeta(null)
                                void handleInspectUrlLite(cleanUrl)
                              } else {
                                setUrlInput(cleanPasted)
                                setUrlMeta(null)
                                setUrlError(validation.error || 'Dirección web no válida.')
                              }
                            }
                          }}
                          placeholder="Pegá un enlace de YouTube, Google Drive, Zoom Cloud o Dropbox..."
                          disabled={isProcessing || isInspectingUrl}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              if (isProcessing || isInspectingUrl) return
                              const clean = urlInput.trim()
                              const isMetaMatching = urlMeta && (urlMeta.url === clean || urlMeta.url === validateWebUrl(clean).cleanUrl)
                              if (isMetaMatching) {
                                void handleRunImportUrl()
                              } else {
                                void handleInspectUrlLite()
                              }
                            }
                          }}
                          style={{
                            flex: '1 1 200px',
                            minWidth: 0,
                            padding: '9px 12px',
                            borderRadius: 8,
                            border: urlError ? '1px solid #f87171' : '1px solid #cbd5e1',
                            fontSize: 13.5,
                            outline: 'none',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={handlePasteUrlLite}
                            disabled={isProcessing || isInspectingUrl}
                            title="Pegar enlace desde el portapapeles"
                            style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', borderRadius: 8 }}
                          >
                            <Copy size={14} />
                            <span>Pegar</span>
                          </button>
                          <button
                            type="button"
                            className="btn soft"
                            onClick={() => {
                              inspectSeqRefLite.current++
                              const demoUrl = 'https://www.youtube.com/watch?v=demo-transcripto-ia'
                              setUrlInput(demoUrl)
                              setUrlError('')
                              setUrlMeta(null)
                              void handleInspectUrlLite(demoUrl)
                            }}
                            disabled={isProcessing || isInspectingUrl}
                            title="Cargar un enlace de YouTube de muestra para la demo"
                            style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', borderRadius: 8 }}
                          >
                            <Sparkles size={14} color="#0284c7" />
                            <span>Ejemplo</span>
                          </button>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => void handleInspectUrlLite()}
                            disabled={isProcessing || isInspectingUrl || !urlInput.trim()}
                            title="Inspeccionar información del enlace"
                            style={{ padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', borderRadius: 8 }}
                          >
                            {isInspectingUrl ? <RefreshCw className="spin" size={14} /> : <Search size={14} />}
                            <span>{isInspectingUrl ? 'Inspeccionando…' : 'Inspeccionar'}</span>
                          </button>
                        </div>
                      </div>

                      {urlError && (
                        <div
                          id="web-url-error-lite"
                          role="alert"
                          aria-live="assertive"
                          style={{
                            marginTop: 10,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            padding: '10px 12px',
                            borderRadius: 8,
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: '#b91c1c',
                            fontSize: 12.5,
                            lineHeight: 1.4
                          }}
                        >
                          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>{urlError}</span>
                        </div>
                      )}
                    </div>

                    {urlMeta ? (
                      <div
                        role="region"
                        aria-label="Vista previa de metadatos del enlace"
                        aria-live="polite"
                        style={{
                          marginTop: 4,
                          padding: 14,
                          borderRadius: 10,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 10px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            background: getProviderBadgeStyle(urlMeta.provider).bg,
                            color: getProviderBadgeStyle(urlMeta.provider).text,
                            border: `1px solid ${getProviderBadgeStyle(urlMeta.provider).border}`
                          }}>
                            <Globe2 size={13} />
                            {urlMeta.provider_label || getProviderBadgeStyle(urlMeta.provider).label}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            {urlMeta.duration_str && urlMeta.duration_str !== 'Desconocida' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                                <Clock3 size={13} />
                                {urlMeta.duration_str}
                              </span>
                            )}
                            {urlMeta.size_str && urlMeta.size_str !== 'Desconocido' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                                {urlMeta.size_str}
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', margin: '0 0 4px', lineHeight: 1.35, wordBreak: 'break-word' }}>
                            {urlMeta.title || urlMeta.name || 'Audio web'}
                          </h3>
                          <p style={{ margin: 0, fontSize: 12, color: '#64748b', wordBreak: 'break-all' }}>
                            {urlMeta.details || urlMeta.url}
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #edf2f7' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                            <CheckCircle2 size={14} color="#16a34a" />
                            Enlace verificado y listo
                          </span>
                          <button
                            type="button"
                            className="btn ghost"
                            style={{ padding: '3px 8px', fontSize: 11, borderRadius: 6 }}
                            onClick={() => {
                              inspectSeqRefLite.current++
                              setIsInspectingUrl(false)
                              setUrlMeta(null)
                              setUrlInput('')
                              setUrlError('')
                              window.setTimeout(() => urlInputRefLite.current?.focus(), 50)
                            }}
                            disabled={isProcessing}
                          >
                            Cambiar enlace
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                        <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Servicios compatibles:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>YouTube</span>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#ecfdf5', color: '#065f46', fontWeight: 600 }}>Google Drive</span>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#1e40af', fontWeight: 600 }}>Zoom Cloud</span>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#f0f9ff', color: '#0369a1', fontWeight: 600 }}>Dropbox</span>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#f8fafc', color: '#475569', fontWeight: 600 }}>Audio directo (MP3/WAV/M4A)</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isProcessing && (
                  <div className="card card-pad" style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <b>{status}</b>
                      <span style={{ color: '#0284c7', fontWeight: 700 }}>{Math.round(progress * 100)}%</span>
                    </div>
                    <div className="progress" style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', width: `${Math.max(5, progress * 100)}%`, background: '#0284c7', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="card card-pad">
                <div className="section-title"><Sparkles size={18} /><h2>Destino y procesamiento</h2></div>
                <div className="field">
                  <label>Carpeta de guardado</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={saveDir} readOnly placeholder="Carpeta de guardado" />
                    <button className="btn ghost" onClick={handleChooseFolder} disabled={isProcessing} title="Elegir carpeta">
                      <FolderOpen size={16} />
                    </button>
                  </div>
                </div>

                <div style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 10,
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  fontSize: 13,
                  lineHeight: 1.5,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start'
                }}>
                  <Sparkles size={18} style={{ flexShrink: 0, marginTop: 2, color: '#15803d' }} />
                  <div>
                    <strong>Limpieza acústica automática:</strong> Las voces se aíslan, el ruido de ambiente se suprime y el volumen se normaliza automáticamente a -16 LUFS antes de transcribir.
                  </div>
                </div>

                {importMode === 'file' ? (
                  <button
                    className="btn primary"
                    style={{ width: '100%', marginTop: 24, background: '#0284c7' }}
                    disabled={!importFile || isProcessing}
                    onClick={handleRunImport}
                  >
                    <WandSparkles size={18} />
                    {isProcessing ? 'Procesando archivo...' : 'Empezar transcripción y resumen'}
                  </button>
                ) : (
                  <button
                    className="btn primary"
                    style={{ width: '100%', marginTop: 24, background: '#0284c7' }}
                    disabled={(!urlMeta && !urlInput.trim()) || isProcessing || isInspectingUrl}
                    onClick={handleRunImportUrl}
                  >
                    <WandSparkles size={18} />
                    {isProcessing ? 'Procesando enlace...' : 'Transcribir enlace web'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. Página Resultados */}
        {page === 'results' && (
          <div className="page narrow">
            <div className="page-header">
              <div>
                <div className="eyebrow" style={{ color: '#0284c7' }}>RESULTADOS</div>
                <h1>{result?.title || 'Reunión procesada'}</h1>
                <p>{result?.engine_used || 'Transcripción y análisis completados'}</p>
              </div>
              <div className="actions">
                <button className="btn ghost" onClick={() => setPage('history')}><Archive size={16} /> Historial</button>
                <button
                  className="btn ghost"
                  onClick={async () => {
                    if (result?.transcript) {
                      await call('copy_to_clipboard', `${result.summary}\n\n---\n\n${result.transcript}`)
                      notify('Texto y resumen copiados al portapapeles.')
                    }
                  }}
                >
                  <Copy size={16} /> Copiar todo
                </button>
                <button
                  className="btn ghost"
                  style={{ color: '#0284c7', borderColor: '#bae6fd' }}
                  onClick={async () => {
                    if (result?.docx_path) {
                      const ok = await call('open_file', result.docx_path)
                      if (!ok) {
                        if (result?.save_dir) await call('open_folder', result.save_dir)
                        notify('Abriendo carpeta con el informe Word (.docx)...')
                      }
                    } else if (result?.save_dir) {
                      await call('open_folder', result.save_dir)
                    }
                  }}
                >
                  <FileText size={16} /> Abrir Word (.docx)
                </button>
                <button
                  className="btn primary"
                  style={{ background: '#0284c7' }}
                  onClick={async () => {
                    if (result?.save_dir) await call('open_folder', result.save_dir)
                  }}
                >
                  <FolderOpen size={16} /> Abrir carpeta
                </button>
              </div>
            </div>

            <div className="grid-2">
              <div className="card card-pad">
                <div className="section-title"><Sparkles size={18} /><h2>Resumen ejecutivo</h2></div>
                <div className="markdown" style={{ marginTop: 14 }}>
                  <PrettyText text={result?.summary || 'No se generó resumen.'} />
                </div>
              </div>

              <div className="card card-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div className="section-title" style={{ margin: 0 }}><Mic2 size={18} /><h2>Transcripción</h2></div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 }}>
                      <button
                        className="btn ghost"
                        style={{
                          fontSize: 12, padding: '3px 9px', borderRadius: 6,
                          background: transcriptViewMode === 'blocks' ? '#0284c7' : 'transparent',
                          color: transcriptViewMode === 'blocks' ? '#ffffff' : '#64748b',
                          fontWeight: transcriptViewMode === 'blocks' ? 600 : 500,
                        }}
                        onClick={() => setTranscriptViewMode('blocks')}
                        title="Ver con marcas de tiempo por bloques"
                      >
                        Bloques [00:00]
                      </button>
                      <button
                        className="btn ghost"
                        style={{
                          fontSize: 12, padding: '3px 9px', borderRadius: 6,
                          background: transcriptViewMode === 'text' ? '#0284c7' : 'transparent',
                          color: transcriptViewMode === 'text' ? '#ffffff' : '#64748b',
                          fontWeight: transcriptViewMode === 'text' ? 600 : 500,
                        }}
                        onClick={() => setTranscriptViewMode('text')}
                        title="Ver texto continuo"
                      >
                        Texto continuo
                      </button>
                    </div>
                    <button
                      className="btn ghost"
                      style={{ fontSize: 12, padding: '4px 8px' }}
                      title="Copiar transcripción"
                      onClick={async () => {
                        const txt = result?.transcript || ''
                        if (txt) {
                          await call('copy_to_clipboard', txt)
                          notify('Transcripción copiada al portapapeles.')
                        }
                      }}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ maxHeight: 480, overflowY: 'auto', marginTop: 14, paddingRight: 4 }}>
                  {transcriptViewMode === 'blocks' && result?.segments && result.segments.length > 0 ? (
                    result.segments.map((s: any, i: number) => (
                      <div className="line" key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, lineHeight: 1.55 }}>
                        <time style={{ color: '#0284c7', fontWeight: 600, fontSize: 13, flexShrink: 0, fontFamily: 'monospace', paddingTop: 2 }}>
                          [{formatSeconds(s.start)}]
                        </time>
                        <div style={{ flex: 1 }}>
                          <button
                            type="button"
                            title="Clic para renombrar en toda la reunión o cambiar el hablante de este párrafo"
                            onClick={() => handleOpenSpeakerModal(s.speaker || 'Micrófono', i)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 7px',
                              marginRight: 6,
                              borderRadius: 6,
                              border: '1px solid #bae6fd',
                              background: '#f0f9ff',
                              color: '#0284c7',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <User size={12} />
                            {s.speaker || 'Hablante'}
                            <Edit3 size={10} style={{ opacity: 0.6 }} />
                          </button>
                          <span style={{ fontSize: 14.5, color: '#334155' }}>{s.text}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, fontSize: 14.5, color: '#334155' }}>
                      {result?.transcript || 'No hay texto disponible.'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. Página Historial */}
        {page === 'history' && (
          <div className="page narrow">
            <div className="page-header">
              <div>
                <div className="eyebrow" style={{ color: '#0284c7' }}>HISTORIAL LOCAL</div>
                <h1>Reuniones anteriores</h1>
                <p>Todas las grabaciones y análisis guardados en este equipo.</p>
              </div>
              <button className="btn ghost" onClick={refreshBoot}><RefreshCw size={16} /> Actualizar</button>
            </div>

            <div className="card meeting-list">
              {boot.history.length > 0 ? (
                boot.history.map(item => (
                  <div
                    key={item.session_id || (item as any).id}
                    className="meeting"
                    onClick={async () => {
                      const sessId = item.session_id || (item as any).id
                      try {
                        const full = await call('get_session', sessId)
                        if (full) {
                          setResult(full)
                          setPage('results')
                          return
                        }
                      } catch {}
                      setResult({
                        session_id: sessId,
                        title: item.title,
                        transcript: item.transcript,
                        summary: item.summary,
                        segments: (item as any).segments || [],
                        engine_used: item.engine_used,
                        save_dir: item.audio_path ? item.audio_path : saveDir,
                      })
                      setPage('results')
                    }}
                  >
                    <div className="meeting-icon"><FileAudio size={20} /></div>
                    <div style={{ flex: 1 }}>
                      <strong>{item.title}</strong>
                      <small>{item.created_at ? item.created_at.slice(0, 16).replace('T', ' ') : ''} · {formatSeconds(item.duration_sec)} · {item.engine_used}</small>
                    </div>
                    <ChevronRight size={18} color="#94a3b8" />
                  </div>
                ))
              ) : (
                <div className="empty-live" style={{ padding: 40, textAlign: 'center' }}>
                  <p>Todavía no hay reuniones grabadas ni importadas.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. Página Configuración */}
        {page === 'settings' && (
          <SettingsLitePage boot={boot} notify={notify} refresh={refreshBoot} onOpenUrl={handleOpenUrl} />
        )}
      </main>

      <SpeakerModalLite
        isOpen={speakerModalOpen}
        currentSpeaker={activeSpeaker}
        segmentIndex={activeSegmentIndex}
        existingSpeakers={distinctSpeakers}
        onRenameGlobal={handleRenameGlobal}
        onReassignSegment={handleReassignSegment}
        onClose={() => setSpeakerModalOpen(false)}
      />

      {toast && <div className="toast">{toast}</div>}
      {isWindowDragging && page !== 'import' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(2, 132, 199, 0.16)',
          backdropFilter: 'blur(3px)',
          border: '3px dashed #0284c7',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          color: '#0369a1',
          fontWeight: 700,
          fontSize: 22,
          gap: 12,
          boxShadow: 'inset 0 0 40px rgba(2, 132, 199, 0.25)',
        }}>
          <Upload size={54} color="#0284c7" />
          <span>Soltá tu audio o video para transcribirlo</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#0369a1' }}>MP3, WAV, M4A, MP4, MOV, MKV, FLAC, WEBM</span>
        </div>
      )}
    </div>
  )
}

function SettingsLitePage({
  boot,
  notify,
  refresh,
  onOpenUrl
}: {
  boot: BootstrapLite
  notify: (msg: string) => void
  refresh: () => Promise<void>
  onOpenUrl: (url: string) => Promise<void>
}) {
  const [groqKey, setGroqKey] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  const [showGroq, setShowGroq] = useState(false)
  const [showGemini, setShowGemini] = useState(false)

  // Testing status
  const [testingGroq, setTestingGroq] = useState(false)
  const [testingGemini, setTestingGemini] = useState(false)
  const [groqFeedback, setGroqFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const [geminiFeedback, setGeminiFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  // Dynamic model catalogs
  const [groqTransList, setGroqTransList] = useState<string[]>(
    boot.groq_transcription_models && boot.groq_transcription_models.length > 0
      ? boot.groq_transcription_models
      : boot.groq_speech_models || ['whisper-large-v3', 'whisper-large-v3-turbo', 'distil-whisper-large-v3-en']
  )
  const [groqSummList, setGroqSummList] = useState<string[]>(
    boot.groq_summary_models && boot.groq_summary_models.length > 0
      ? boot.groq_summary_models
      : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768']
  )
  const [geminiTransList, setGeminiTransList] = useState<string[]>(
    boot.gemini_transcription_models && boot.gemini_transcription_models.length > 0
      ? boot.gemini_transcription_models
      : boot.gemini_models || ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
  )
  const [geminiSummList, setGeminiSummList] = useState<string[]>(
    boot.gemini_summary_models && boot.gemini_summary_models.length > 0
      ? boot.gemini_summary_models
      : boot.gemini_models || ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
  )

  // Selected models
  const [groqTransModel, setGroqTransModel] = useState(
    boot.settings.selected_groq_transcription_model || boot.settings.groq_models?.[0] || 'whisper-large-v3'
  )
  const [groqSummModel, setGroqSummModel] = useState(
    boot.settings.selected_groq_summary_model || boot.settings.groq_models?.[1] || 'llama-3.3-70b-versatile'
  )
  const [geminiTransModel, setGeminiTransModel] = useState(
    boot.settings.selected_gemini_transcription_model || boot.settings.gemini_models?.[0] || 'gemini-2.5-flash'
  )
  const [geminiSummModel, setGeminiSummModel] = useState(
    boot.settings.selected_gemini_summary_model || boot.settings.gemini_models?.[0] || 'gemini-2.5-flash'
  )
  const [localWhisper, setLocalWhisper] = useState(boot.settings.local_whisper_model || 'medium')

  const [hasGroq, setHasGroq] = useState(Boolean(boot.settings.has_groq_key))
  const [hasGemini, setHasGemini] = useState(Boolean(boot.settings.has_gemini_key))

  // Test Groq connection in real time
  const handleTestGroq = async () => {
    try {
      setTestingGroq(true)
      setGroqFeedback(null)
      const res = await call('test_connection', 'groq', groqKey.trim())
      if (res.success) {
        setHasGroq(true)
        setGroqFeedback({ ok: true, msg: res.message || 'Conexión exitosa' })
        if (res.transcription_models && res.transcription_models.length > 0) {
          setGroqTransList(res.transcription_models)
        }
        if (res.summary_models && res.summary_models.length > 0) {
          setGroqSummList(res.summary_models)
        }
        if (res.selected_transcription_model) setGroqTransModel(res.selected_transcription_model)
        if (res.selected_summary_model) setGroqSummModel(res.selected_summary_model)
        notify('Conexión con Groq verificada correctamente.')
        await refresh()
      } else {
        setGroqFeedback({ ok: false, msg: res.error || 'Error al conectar con Groq' })
        notify(res.error || 'No se pudo conectar con Groq.')
      }
    } catch (e: any) {
      setGroqFeedback({ ok: false, msg: e.message || 'Error de conexión' })
      notify(e.message || 'Error de conexión')
    } finally {
      setTestingGroq(false)
    }
  }

  // Test Gemini connection in real time
  const handleTestGemini = async () => {
    try {
      setTestingGemini(true)
      setGeminiFeedback(null)
      const res = await call('test_connection', 'gemini', geminiKey.trim())
      if (res.success) {
        setHasGemini(true)
        setGeminiFeedback({ ok: true, msg: res.message || 'Conexión exitosa' })
        if (res.transcription_models && res.transcription_models.length > 0) {
          setGeminiTransList(res.transcription_models)
          setGeminiSummList(res.summary_models || res.transcription_models)
        }
        if (res.selected_transcription_model) setGeminiTransModel(res.selected_transcription_model)
        if (res.selected_summary_model) setGeminiSummModel(res.selected_summary_model)
        notify('Conexión con Google Gemini verificada correctamente.')
        await refresh()
      } else {
        setGeminiFeedback({ ok: false, msg: res.error || 'Error al conectar con Google Gemini' })
        notify(res.error || 'No se pudo conectar con Google Gemini.')
      }
    } catch (e: any) {
      setGeminiFeedback({ ok: false, msg: e.message || 'Error de conexión' })
      notify(e.message || 'Error de conexión')
    } finally {
      setTestingGemini(false)
    }
  }

  const saveConfig = async () => {
    try {
      const payload: any = {
        selected_groq_transcription_model: groqTransModel,
        selected_groq_summary_model: groqSummModel,
        selected_gemini_transcription_model: geminiTransModel,
        selected_gemini_summary_model: geminiSummModel,
        groq_transcription_models: groqTransList,
        groq_summary_models: groqSummList,
        gemini_transcription_models: geminiTransList,
        gemini_summary_models: geminiSummList,
        groq_models: [groqTransModel, groqSummModel],
        gemini_models: [geminiTransModel, geminiSummModel],
        local_whisper_model: localWhisper,
      }
      if (groqKey.trim()) payload.groq_api_key = groqKey.trim()
      if (geminiKey.trim()) payload.gemini_api_key = geminiKey.trim()

      const res = await call('save_settings', payload)
      if (res.success) {
        setGroqKey('')
        setGeminiKey('')
        notify('Configuración guardada correctamente.')
        await refresh()
      } else {
        notify(res.error || 'Error al guardar configuración')
      }
    } catch (e: any) {
      notify(e.message || 'Error al guardar')
    }
  }

  return (
    <div className="page narrow">
      <div className="page-header">
        <div>
          <div className="eyebrow" style={{ color: '#0284c7' }}>CONFIGURACIÓN</div>
          <h1>Conexiones y Modelos</h1>
          <p>Vinculá tus cuentas gratuitas de Groq o Google Gemini, probá la conexión en vivo y seleccioná los modelos reales disponibles.</p>
        </div>
      </div>

      <div className="grid-2">
        {/* Groq Card */}
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>
              <Sparkles size={20} color="#f97316" />
              <h2>Groq (Ultrarrápido)</h2>
            </div>
            {hasGroq && (!groqFeedback || groqFeedback.ok) && (
              <span style={{ fontSize: 12, background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: 999, fontWeight: 700 }}>
                Conectado
              </span>
            )}
            {groqFeedback && !groqFeedback.ok && (
              <span style={{ fontSize: 12, background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: 999, fontWeight: 700 }}>
                Error de clave
              </span>
            )}
          </div>

          <p style={{ fontSize: 13, marginBottom: 12 }}>
            Groq ofrece transcripciones de audio con Whisper a velocidad extrema y resúmenes con modelos Llama 3.
          </p>

          <button
            className="btn ghost compact"
            style={{ marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => onOpenUrl('https://console.groq.com/keys')}
          >
            <ExternalLink size={13} /> Obtener API Key en Groq Console
          </button>

          <div className="field">
            <label>Clave API de Groq</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showGroq ? 'text' : 'password'}
                value={groqKey}
                onChange={e => setGroqKey(e.target.value)}
                placeholder={hasGroq ? '••••••••  (Clave guardada en Windows)' : 'gsk_...'}
              />
              <button className="btn ghost compact" type="button" onClick={() => setShowGroq(!showGroq)}>
                {showGroq ? 'Ocultar' : 'Ver'}
              </button>
              <button
                className="btn ghost compact"
                type="button"
                disabled={testingGroq || (!hasGroq && !groqKey.trim())}
                onClick={handleTestGroq}
                title="Probar conexión y traer modelos en tiempo real"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 120, justifyContent: 'center' }}
              >
                <RefreshCw size={13} className={testingGroq ? 'animate-spin' : ''} />
                {testingGroq ? 'Probando...' : 'Probar conexión'}
              </button>
            </div>
            <span className="small muted">Las claves se guardan cifradas de forma segura en Windows DPAPI / Keyring.</span>
          </div>

          {/* Feedback de conexión Groq */}
          {groqFeedback && (
            <div style={{
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 12.5,
              background: groqFeedback.ok ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${groqFeedback.ok ? '#a7f3d0' : '#fecaca'}`,
              color: groqFeedback.ok ? '#065f46' : '#991b1b',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              {groqFeedback.ok ? <CheckCircle2 size={16} /> : <X size={16} />}
              <span>{groqFeedback.msg}</span>
            </div>
          )}

          <div className="field" style={{ marginTop: 14 }}>
            <label>Modelo de Transcripción (Audio a Texto)</label>
            <select value={groqTransModel} onChange={e => setGroqTransModel(e.target.value)}>
              {groqTransList.map(m => (
                <option key={m} value={m}>
                  {m === 'whisper-large-v3' ? 'whisper-large-v3 (Recomendado - Máxima precisión)' : m === 'whisper-large-v3-turbo' ? 'whisper-large-v3-turbo (Ultra rápido)' : m}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Modelo de Resumen Ejecutivo</label>
            <select value={groqSummModel} onChange={e => setGroqSummModel(e.target.value)}>
              {groqSummList.map(m => (
                <option key={m} value={m}>
                  {m === 'llama-3.3-70b-versatile' ? 'llama-3.3-70b-versatile (Recomendado - Calidad superior)' : m === 'llama-3.1-8b-instant' ? 'llama-3.1-8b-instant (Ultra veloz)' : m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Gemini Card */}
        <div className="card card-pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>
              <Sparkles size={20} color="#3b82f6" />
              <h2>Google Gemini</h2>
            </div>
            {hasGemini && (!geminiFeedback || geminiFeedback.ok) && (
              <span style={{ fontSize: 12, background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: 999, fontWeight: 700 }}>
                Conectado
              </span>
            )}
            {geminiFeedback && !geminiFeedback.ok && (
              <span style={{ fontSize: 12, background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: 999, fontWeight: 700 }}>
                Error de clave
              </span>
            )}
          </div>

          <p style={{ fontSize: 13, marginBottom: 12 }}>
            Modelos multimodales de Google capaces de procesar audio directamente y sintetizar reuniones extensas.
          </p>

          <button
            className="btn ghost compact"
            style={{ marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => onOpenUrl('https://aistudio.google.com/app/apikey')}
          >
            <ExternalLink size={13} /> Obtener API Key en Google AI Studio
          </button>

          <div className="field">
            <label>Clave API de Gemini</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={showGemini ? 'text' : 'password'}
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                placeholder={hasGemini ? '••••••••  (Clave guardada en Windows)' : 'AIzaSy...'}
              />
              <button className="btn ghost compact" type="button" onClick={() => setShowGemini(!showGemini)}>
                {showGemini ? 'Ocultar' : 'Ver'}
              </button>
              <button
                className="btn ghost compact"
                type="button"
                disabled={testingGemini || (!hasGemini && !geminiKey.trim())}
                onClick={handleTestGemini}
                title="Probar conexión y traer modelos en tiempo real"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 120, justifyContent: 'center' }}
              >
                <RefreshCw size={13} className={testingGemini ? 'animate-spin' : ''} />
                {testingGemini ? 'Probando...' : 'Probar conexión'}
              </button>
            </div>
            <span className="small muted">Las claves se guardan cifradas de forma segura en Windows DPAPI / Keyring.</span>
          </div>

          {/* Feedback de conexión Gemini */}
          {geminiFeedback && (
            <div style={{
              marginTop: 10,
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 12.5,
              background: geminiFeedback.ok ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${geminiFeedback.ok ? '#a7f3d0' : '#fecaca'}`,
              color: geminiFeedback.ok ? '#065f46' : '#991b1b',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              {geminiFeedback.ok ? <CheckCircle2 size={16} /> : <X size={16} />}
              <span>{geminiFeedback.msg}</span>
            </div>
          )}

          <div className="field" style={{ marginTop: 14 }}>
            <label>Modelo de Transcripción (Audio a Texto)</label>
            <select value={geminiTransModel} onChange={e => setGeminiTransModel(e.target.value)}>
              {geminiTransList.map(m => (
                <option key={m} value={m}>
                  {m === 'gemini-2.5-flash' ? 'gemini-2.5-flash (Recomendado - Nueva generación)' : m === 'gemini-1.5-flash' ? 'gemini-1.5-flash (Rápido y liviano)' : m === 'gemini-1.5-pro' ? 'gemini-1.5-pro (Razonamiento profundo)' : m}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Modelo de Resumen Ejecutivo</label>
            <select value={geminiSummModel} onChange={e => setGeminiSummModel(e.target.value)}>
              {geminiSummList.map(m => (
                <option key={m} value={m}>
                  {m === 'gemini-2.5-flash' ? 'gemini-2.5-flash (Recomendado - Síntesis estructurada)' : m === 'gemini-1.5-flash' ? 'gemini-1.5-flash (Rápido)' : m === 'gemini-1.5-pro' ? 'gemini-1.5-pro (Análisis exhaustivo)' : m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Modelo Local de Respaldo */}
      <div className="card card-pad" style={{ marginTop: 20 }}>
        <div className="section-title">
          <Sparkles size={18} color="#0284c7" />
          <h2>Modelo Local de Respaldo (Sin Conexión)</h2>
        </div>
        <p style={{ fontSize: 13, marginBottom: 12 }}>
          Este modelo local Faster-Whisper se activará automáticamente si no hay conexión a internet o si se agota la cuota en los servicios de la nube.
        </p>
        <div className="field" style={{ maxWidth: 460 }}>
          <select value={localWhisper} onChange={e => setLocalWhisper(e.target.value)}>
            {boot.local_models.map(m => (
              <option key={m} value={m}>
                {m === 'medium' ? 'Whisper Medium (Recomendado - Excelente fidelidad en español)' : m === 'small' ? 'Whisper Small (Equilibrado)' : 'Whisper Base (Ultra liviano)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <button className="btn primary" style={{ background: '#0284c7', padding: '12px 32px', fontSize: 15 }} onClick={saveConfig}>
          Guardar cambios
        </button>
      </div>
    </div>
  )
}
