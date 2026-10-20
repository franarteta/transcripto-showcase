/**
 * mockBridge.ts
 * Emulador completo del puente IPC de PyWebView para ejecutar
 * App.tsx y AppLite.tsx directamente en el navegador con fidelidad del 100%.
 */

import { REALTIME_CONVERSATION, SAMPLE_SUMMARY_MARKDOWN } from './mockData'

interface DialogueTurn {
  id: string
  speakerTag: string
  role: 'mic' | 'system'
  startSec: number
  commitSec: number
  text: string
  interimText: string
}

export const DIALOGUE_TIMELINE: DialogueTurn[] = [
  {
    id: 'turn-1',
    speakerTag: 'Franco Arteta (Micrófono)',
    role: 'mic',
    startSec: 1,
    commitSec: 7,
    text: 'Buenas tardes a todos. Iniciamos la sesión de sincronización técnica de Transcripto. Como acordamos, hoy revisamos el desacoplamiento de captura WASAPI y la resiliencia en streaming continuo.',
    interimText: 'Buenas tardes a todos. Iniciamos la sesión de sincronización técnica…'
  },
  {
    id: 'turn-2',
    speakerTag: 'Audio del sistema (Tech Lead)',
    role: 'system',
    startSec: 8,
    commitSec: 15,
    text: 'Hola Franco. Excelente. Estuve revisando el PR del pipeline de audio. El desacoplamiento del bucle de captura mediante colas de frames PCM eliminó por completo el backlog que teníamos en grabaciones largas.',
    interimText: 'Hola Franco. Excelente. Estuve revisando el PR del pipeline de audio…'
  },
  {
    id: 'turn-3',
    speakerTag: 'Franco Arteta (Micrófono)',
    role: 'mic',
    startSec: 16,
    commitSec: 24,
    text: 'Exacto. Ahora la captura corre en hilos de máxima prioridad con pacing calibrado a 1.0x. Además, integramos el fallback automático ante errores 429 de cuota en Groq, conmutando a Gemini 2.5 Flash en menos de 200 milisegundos.',
    interimText: 'Exacto. Ahora la captura corre en hilos de máxima prioridad…'
  },
  {
    id: 'turn-4',
    speakerTag: 'Audio del sistema (Tech Lead)',
    role: 'system',
    startSec: 25,
    commitSec: 33,
    text: 'Esa conmutación transparente es clave para reuniones de producción de más de una hora. ¿Cómo quedó la integración de descarga directa desde enlaces de YouTube y Google Drive?',
    interimText: 'Esa conmutación transparente es clave para reuniones de producción…'
  },
  {
    id: 'turn-5',
    speakerTag: 'Franco Arteta (Micrófono)',
    role: 'mic',
    startSec: 34,
    commitSec: 42,
    text: 'Quedó operativa en la pestaña de Importar. El downloader extrae únicamente el flujo de audio Opus o AAC sin bajar video pesado, y lo normaliza a 16 kHz WAV para Whisper y Groq.',
    interimText: 'Quedó operativa en la pestaña de Importar. El downloader extrae únicamente…'
  },
  {
    id: 'turn-6',
    speakerTag: 'Audio del sistema (Tech Lead)',
    role: 'system',
    startSec: 43,
    commitSec: 51,
    text: 'Perfecto. Y la exportación de informes ejecutivos a Microsoft Word (.docx) con tabla de acuerdos y participantes en portada cubre exactamente lo que piden los directores. Procedamos con el release.',
    interimText: 'Perfecto. Y la exportación de informes ejecutivos a Microsoft Word…'
  }
]

let currentSpeakersMap: Record<string, string> = {
  'Franco Arteta': 'Micrófono (Franco Arteta)',
  'Tech Lead': 'Audio del sistema (Tech Lead)'
}

const getSampleSession = () => ({
  id: 'demo-session-2026',
  session_id: 'demo-session-2026',
  meeting_id: 'demo-session-2026',
  title: 'Sincronización Técnica y Auditoría de Streaming',
  created_at: '19/10/2026 18:30:00',
  duration: 1122,
  duration_sec: 1122,
  language: 'es-AR',
  engine: 'groq_whisper',
  engine_used: 'Groq Whisper Large v3',
  summary: SAMPLE_SUMMARY_MARKDOWN,
  analysis: 'Auditoría completa de latencia cero, pacing 1.0x y tolerancia a cuota 429.',
  visual_timeline: `**00:00 - 00:08**: Apertura de sesión y auditoría de la arquitectura de buffers desacoplados.\n**00:08 - 00:23**: Validación del desacoplamiento WASAPI Loopback y colas en hilos de máxima prioridad.\n**00:23 - 00:35**: Prueba del failover automático ante errores 429 de Groq hacia Gemini 2.5 Flash en <200ms.\n**00:35 - 00:45**: Revisión de exportación a Microsoft Word (.docx) corporativa y aprobación para release.`,
  transcript: DIALOGUE_TIMELINE.map(t => `${t.role === 'system' ? 'Tech Lead (Videollamada)' : 'Franco Arteta (Micrófono)'}: ${t.text}`).join('\n\n'),
  segments: DIALOGUE_TIMELINE.map(t => ({
    start: t.startSec,
    end: t.commitSec,
    text: t.text,
    speaker: t.role === 'system' ? 'Audio del sistema (Tech Lead)' : 'Micrófono (Franco Arteta)'
  })),
  source: {
    name: 'Reunion_Sincronizacion_2026.mp3',
    duration: 1122
  },
  audio_path: 'C:\\Users\\Franco\\Documentos\\Transcripto\\audio_reunion_2026.wav',
  save_dir: 'C:\\Users\\Franco\\Documentos\\Transcripto',
  docx_path: './informe_muestra_transcripto.docx',
  speaker_names: currentSpeakersMap
})

let liveInterval: ReturnType<typeof setInterval> | null = null
let liveSecond = 0
let isRecordingActive = false
let isPausedActive = false

export function setupMockBridge() {
  if (typeof window === 'undefined') return

  const triggerDownload = (filename: string, path: string) => {
    const link = document.createElement('a')
    link.href = path
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const mockApi: Record<string, (...args: any[]) => Promise<any>> = {
    bootstrap: async () => {
      const session = getSampleSession()
      return {
        status: 'Listo',
        is_recording: isRecordingActive,
        is_paused: isPausedActive,
        is_processing: false,
        current_session_id: isRecordingActive ? 'demo-session-2026' : null,
        save_dir: 'C:\\Users\\Franco\\Documentos\\Transcripto',
        version: '2.5.5',
        settings: {
          has_groq_key: true,
          has_gemini_key: true,
          live_model: 'whisper-large-v3',
          live_language: 'es-AR',
          analysis_provider: 'groq',
          whisper_model: 'large-v3',
          language: 'es-AR',
          enhance_speech: true,
          auto_cleanup: false,
          save_dir: 'C:\\Users\\Franco\\Documentos\\Transcripto',
          selected_groq_transcription_model: 'whisper-large-v3',
          selected_groq_summary_model: 'openai/gpt-oss-120b',
          selected_gemini_transcription_model: 'gemini-2.5-flash',
          selected_gemini_summary_model: 'gemini-2.5-flash',
          local_whisper_model: 'medium'
        },
        microphones: [
          { id: 'default', label: 'Micrófono Realtek High Definition Audio (WASAPI)' },
          { id: 'headset', label: 'Auriculares USB con Cancelación Activa de Ruido' },
          { id: 'none', label: 'Desactivado (No grabar micrófono)' }
        ],
        desktop_sources: [
          { id: 'loop::default', label: 'Audio del Sistema (WASAPI Loopback - Altavoces)' },
          { id: 'loop::comms', label: 'Audio de Comunicaciones (Teams / Zoom / Meet)' },
          { id: 'none', label: 'Desactivado (No grabar audio del sistema)' }
        ],
        selected_mic: 'default',
        selected_desktop: 'loop::default',
        sources: [
          { id: 'mic_default', label: 'Micrófono Principal (WASAPI)' },
          { id: 'loop_default', label: 'Mezcla Stereo / Loopback' }
        ],
        groq_speech_models: ['whisper-large-v3', 'whisper-large-v3-turbo', 'distil-whisper-large-v3-en'],
        groq_transcription_models: ['whisper-large-v3', 'whisper-large-v3-turbo'],
        groq_summary_models: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
        gemini_models: ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
        gemini_transcription_models: ['gemini-2.5-flash', 'gemini-1.5-flash'],
        gemini_summary_models: ['gemini-2.5-flash', 'gemini-1.5-pro'],
        local_models: ['medium', 'small', 'base', 'tiny'],
        models: ['whisper-large-v3 (Groq 20x)', 'gemini-2.5-flash', 'Whisper Medium Local'],
        languages: [
          { label: 'Español (Argentina / Latam)', value: 'es-AR' },
          { label: 'Español (España)', value: 'es-ES' },
          { label: 'Inglés (EE.UU.)', value: 'en-US' },
          { label: 'Portugués (Brasil)', value: 'pt-BR' }
        ],
        templates: ['Reunión técnica de sincronización', 'Entrevista profesional', 'Clase magistral', 'Acta formal'],
        export_folder: 'C:\\Users\\Franco\\Documentos\\Transcripto',
        providers: ['groq', 'gemini', 'ollama'],
        provider_configured: { groq: true, gemini: true, ollama: true },
        provider_models: {
          groq: ['whisper-large-v3', 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b'],
          gemini: ['gemini-2.5-flash', 'gemini-1.5-pro'],
          ollama: ['llama3.2:latest', 'qwen2.5:7b']
        },
        provider_selected_models: {
          groq: 'openai/gpt-oss-120b',
          gemini: 'gemini-2.5-flash',
          ollama: 'llama3.2:latest'
        },
        diarization: {
          module_installed: true,
          token_configured: true,
          verified: true,
          ready: true,
          reason: 'Detección acústica dual activada',
          model: 'pyannote/speaker-diarization-3.1'
        },
        live_local_models: ['medium', 'small', 'base'],
        live_gemini_models: [
          { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash Live (Ultrarrápido)', available: true },
          { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', available: true }
        ],
        history: [
          {
            meeting_id: 'demo-session-2026',
            session_id: 'demo-session-2026',
            title: 'Sincronización Técnica y Auditoría de Streaming',
            created_at: '19/10/2026 18:30:00',
            duration: 1122,
            duration_sec: 1122,
            language: 'es-AR',
            engine: 'groq_whisper',
            engine_used: 'Groq Whisper Large v3',
            transcript: session.transcript,
            summary: session.summary,
            summary_preview: 'Auditoría del pipeline en tiempo real, eliminación de backlog y fallback 429...',
            audio_path: session.audio_path
          }
        ]
      }
    },

    refresh_sources: async () => {
      return (await mockApi.bootstrap())
    },

    choose_media: async () => {
      return {
        path: 'C:\\Users\\Franco\\Grabaciones\\Reunion_Sincronizacion_2026.mp3',
        name: 'Reunion_Sincronizacion_2026.mp3',
        size_mb: 41.2,
        duration: 1122,
        duration_formatted: '18m 42s',
        format: 'MP3 Audio (16 kHz mono compatible)',
        channels: 2,
        sample_rate: 44100
      }
    },

    choose_folder: async () => {
      return 'C:\\Users\\Franco\\Documentos\\Transcripto'
    },

    inspect_file: async (filePath: any) => {
      if (typeof filePath === 'object' && filePath !== null) {
        return filePath
      }
      return {
        path: filePath || 'C:\\Users\\Franco\\Grabaciones\\Reunion_Sincronizacion_2026.mp3',
        name: 'Reunion_Sincronizacion_2026.mp3',
        size_mb: 41.2,
        duration: 1122,
        duration_formatted: '18m 42s',
        format: 'MP3 Audio (16 kHz mono compatible)',
        channels: 2,
        sample_rate: 44100
      }
    },

    inspect_url: async (url: string) => {
      return {
        url: url || 'https://www.youtube.com/watch?v=demo-transcripto-ia',
        provider: 'YouTube',
        title: 'Arquitectura de Streaming y Modelos Whisper en Producción',
        duration: 860,
        duration_formatted: '14:20',
        audio_quality: '16 kHz Mono Float32 (Stream directo sin video)'
      }
    },

    start_live: async (config?: any) => {
      isRecordingActive = true
      isPausedActive = false
      liveSecond = 0

      if (window.transcriptoEvent) {
        window.transcriptoEvent({
          kind: 'live_state',
          recording: true,
          busy: false,
          status: 'Grabando en tiempo real con WASAPI Loopback + Micrófono'
        })
        window.transcriptoEvent({
          kind: 'live_segments',
          segments: []
        })
      }

      if (liveInterval) clearInterval(liveInterval)
      liveInterval = setInterval(() => {
        if (isPausedActive) return
        liveSecond += 1

        // Identificar el turno activo en el segundo actual
        const currentTurn = DIALOGUE_TIMELINE.find(t => liveSecond >= t.startSec && liveSecond <= t.commitSec)
        
        let micPercent = 5
        let deskPercent = 5

        if (currentTurn) {
          if (currentTurn.role === 'mic') {
            // Habla Franco por Micrófono (oscila 65% - 85%)
            micPercent = Math.min(95, Math.max(45, Math.floor(Math.sin(liveSecond * 3) * 20 + 70)))
            deskPercent = Math.floor(Math.random() * 4 + 3)

            if (window.transcriptoEvent) {
              window.transcriptoEvent({
                kind: 'live_interim',
                speaker: 'Micrófono',
                text: currentTurn.interimText
              })
            }
          } else {
            // Habla el Tech Lead por Videollamada / Audio del Sistema (oscila 70% - 90%)
            micPercent = Math.floor(Math.random() * 4 + 3)
            deskPercent = Math.min(95, Math.max(50, Math.floor(Math.cos(liveSecond * 3) * 20 + 75)))

            if (window.transcriptoEvent) {
              window.transcriptoEvent({
                kind: 'live_interim',
                speaker: 'Audio del sistema',
                text: currentTurn.interimText
              })
            }
          }
        } else {
          // Pausa entre oradores
          micPercent = Math.floor(Math.random() * 4 + 3)
          deskPercent = Math.floor(Math.random() * 4 + 3)
        }

        // Segmentos consolidados hasta el momento
        const committedTurns = DIALOGUE_TIMELINE.filter(t => t.commitSec <= liveSecond)
        const segmentsToEmit = committedTurns.map(t => ({
          start: t.startSec,
          end: t.commitSec,
          text: t.text,
          speaker: t.role === 'system' ? 'Audio del sistema (Tech Lead)' : 'Micrófono (Franco Arteta)'
        }))

        if (window.transcriptoEvent) {
          window.transcriptoEvent({
            kind: 'live_level',
            percent: Math.max(micPercent, deskPercent),
            mic_percent: micPercent,
            desktop_percent: deskPercent
          })

          window.transcriptoEvent({
            kind: 'live_segments',
            segments: segmentsToEmit
          })
        }
      }, 1000)

      return { success: true }
    },

    stop_live: async () => {
      isRecordingActive = false
      isPausedActive = false
      if (liveInterval) {
        clearInterval(liveInterval)
        liveInterval = null
      }

      const session = getSampleSession()
      if (window.transcriptoEvent) {
        window.transcriptoEvent({
          kind: 'live_state',
          recording: false,
          busy: false,
          status: 'Sesión finalizada y procesada con éxito'
        })
        window.transcriptoEvent({
          kind: 'result',
          result: session
        })
      }
      return session
    },

    pause_live: async () => {
      isPausedActive = true
      if (window.transcriptoEvent) {
        window.transcriptoEvent({
          kind: 'live_state',
          recording: true,
          paused: true,
          status: 'Grabación pausada'
        })
      }
      return { success: true }
    },

    resume_live: async () => {
      isPausedActive = false
      if (window.transcriptoEvent) {
        window.transcriptoEvent({
          kind: 'live_state',
          recording: true,
          paused: false,
          status: 'Grabando en tiempo real'
        })
      }
      return { success: true }
    },

    // Métodos para Transcripto Lite
    start_recording: async (config?: any) => {
      isRecordingActive = true
      isPausedActive = false
      liveSecond = 0

      if (liveInterval) clearInterval(liveInterval)
      liveInterval = setInterval(() => {
        if (isPausedActive) return
        liveSecond += 1

        const currentTurn = DIALOGUE_TIMELINE.find(t => liveSecond >= t.startSec && liveSecond <= t.commitSec)
        let micLvl = 0.05
        let deskLvl = 0.05

        if (currentTurn) {
          if (currentTurn.role === 'mic') {
            micLvl = 0.65 + Math.sin(liveSecond * 2) * 0.2
            deskLvl = 0.04
          } else {
            micLvl = 0.04
            deskLvl = 0.75 + Math.cos(liveSecond * 2) * 0.15
          }
        }

        if (window.transcriptoLiteEvent) {
          window.transcriptoLiteEvent({
            type: 'level',
            mic_level: micLvl,
            desktop_level: deskLvl
          })
        }
        if (window.__onLiteEvent) {
          window.__onLiteEvent('level', {
            mic_level: micLvl,
            desktop_level: deskLvl
          })
        }
      }, 500)

      return { success: true, session_id: 'demo-session-2026' }
    },

    stop_recording: async () => {
      isRecordingActive = false
      isPausedActive = false
      if (liveInterval) {
        clearInterval(liveInterval)
        liveInterval = null
      }

      const session = getSampleSession()

      const emitLite = (payload: any) => {
        if (window.transcriptoLiteEvent) window.transcriptoLiteEvent(payload)
        if (window.__onLiteEvent) window.__onLiteEvent(payload.kind || payload.type, payload)
      }

      // Progresión visual inmediata que avanza rápidamente y abre Resultados
      setTimeout(() => {
        emitLite({ kind: 'progress', value: 0.35, message: 'Guardando y preparando pista de audio…' })

        setTimeout(() => {
          emitLite({ kind: 'progress', value: 0.75, message: 'Transcribiendo audio y extrayendo acuerdos con IA…' })

          setTimeout(() => {
            emitLite({ kind: 'progress', value: 1.0, message: '¡Procesamiento finalizado con éxito!' })
            emitLite({ kind: 'pipeline_completed', result: session })
          }, 250)
        }, 250)
      }, 50)

      return {
        success: true,
        session_id: 'demo-session-2026',
        session: session
      }
    },

    pause_recording: async () => {
      isPausedActive = true
      return { success: true }
    },

    resume_recording: async () => {
      isPausedActive = false
      return { success: true }
    },

    transcribe_file: async (config?: any) => {
      const session = getSampleSession()

      // Para Desktop (window.transcriptoEvent)
      if (window.transcriptoEvent) {
        window.transcriptoEvent({ kind: 'status', message: 'Extrayendo audio del archivo…' })
        window.transcriptoEvent({ kind: 'progress', value: 0.30, message: 'Extrayendo pista de audio…' })

        setTimeout(() => {
          if (window.transcriptoEvent) {
            window.transcriptoEvent({ kind: 'progress', value: 0.70, message: 'Transcribiendo a 20x con Groq Whisper Large v3…' })
          }

          setTimeout(() => {
            if (window.transcriptoEvent) {
              window.transcriptoEvent({ kind: 'progress', value: 0.95, message: 'Generando resumen ejecutivo y matriz de acuerdos…' })
            }

            setTimeout(() => {
              if (window.transcriptoEvent) {
                window.transcriptoEvent({ kind: 'progress', value: 1.0, message: '¡Listo!' })
                window.transcriptoEvent({ kind: 'result', result: session })
              }
            }, 250)
          }, 250)
        }, 200)
      }

      // Para Lite (window.transcriptoLiteEvent / window.__onLiteEvent)
      const emitLite = (payload: any) => {
        if (window.transcriptoLiteEvent) window.transcriptoLiteEvent(payload)
        if (window.__onLiteEvent) window.__onLiteEvent(payload.kind || payload.type, payload)
      }
      setTimeout(() => {
        emitLite({ kind: 'progress', value: 0.35, message: 'Cargando y normalizando archivo…' })
        setTimeout(() => {
          emitLite({ kind: 'progress', value: 0.75, message: 'Transcribiendo a 20x con Groq…' })
          setTimeout(() => {
            emitLite({ kind: 'progress', value: 1.0, message: '¡Completado!' })
            emitLite({ kind: 'pipeline_completed', result: session })
          }, 250)
        }, 250)
      }, 50)

      return session
    },

    transcribe_url: async (config?: any) => {
      const session = getSampleSession()

      // Para Desktop
      if (window.transcriptoEvent) {
        window.transcriptoEvent({ kind: 'status', message: 'Conectando con enlace web y descargando audio stream…' })
        window.transcriptoEvent({ kind: 'progress', value: 0.30, message: 'Descargando audio de YouTube a 16 kHz…' })

        setTimeout(() => {
          if (window.transcriptoEvent) {
            window.transcriptoEvent({ kind: 'progress', value: 0.70, message: 'Transcribiendo audio a 20x…' })
          }

          setTimeout(() => {
            if (window.transcriptoEvent) {
              window.transcriptoEvent({ kind: 'progress', value: 0.95, message: 'Generando informe Word y análisis…' })
            }

            setTimeout(() => {
              if (window.transcriptoEvent) {
                window.transcriptoEvent({ kind: 'progress', value: 1.0, message: '¡Listo!' })
                window.transcriptoEvent({ kind: 'result', result: session })
              }
            }, 250)
          }, 250)
        }, 200)
      }

      // Para Lite
      const emitLite = (payload: any) => {
        if (window.transcriptoLiteEvent) window.transcriptoLiteEvent(payload)
        if (window.__onLiteEvent) window.__onLiteEvent(payload.kind || payload.type, payload)
      }
      setTimeout(() => {
        emitLite({ kind: 'progress', value: 0.30, message: 'Descargando stream de audio…' })
        setTimeout(() => {
          emitLite({ kind: 'progress', value: 0.75, message: 'Transcribiendo con Groq Whisper…' })
          setTimeout(() => {
            emitLite({ kind: 'progress', value: 1.0, message: '¡Completado!' })
            emitLite({ kind: 'pipeline_completed', result: session })
          }, 250)
        }, 250)
      }, 50)

      return session
    },

    open_file: async (filePath: string) => {
      triggerDownload('informe_muestra_transcripto.docx', './informe_muestra_transcripto.docx')
      return { success: true }
    },

    open_folder: async (folderPath: string) => {
      return { success: true }
    },

    open_external_url: async (url: string) => {
      window.open(url, '_blank')
      return { success: true }
    },

    copy_to_clipboard: async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
      } catch (e) {
        console.warn('Clipboard write fallback', e)
      }
      return { success: true }
    },

    export_current: async (format: string) => {
      triggerDownload('informe_muestra_transcripto.docx', './informe_muestra_transcripto.docx')
      return { success: true, path: './informe_muestra_transcripto.docx' }
    },

    get_session: async (sessionId: string) => {
      return getSampleSession()
    },

    load_history: async () => {
      return [getSampleSession()]
    },

    rename_speaker: async (meetingId: string, oldName: string, newName: string, segmentIndex?: number) => {
      if (newName && newName.trim()) {
        currentSpeakersMap[oldName] = newName.trim()
      }
      return getSampleSession()
    },

    save_settings: async (settings: any) => {
      return { success: true }
    },

    save_ai_settings: async (settings: any) => {
      return { success: true }
    },

    test_connection: async (provider: string, key?: string) => {
      return {
        success: true,
        message: `Conexión verificada exitosamente con ${provider || 'el proveedor de IA'}. Modelos sincronizados.`
      }
    },

    check_updates: async () => {
      return {
        has_update: false,
        current_version: '2.5.5',
        latest_version: '2.5.5',
        message: 'Tienes instalada la versión oficial más reciente.'
      }
    },

    download_update: async () => {
      return { success: true }
    }
  }

  // Asignación de window.pywebview global
  window.pywebview = {
    api: mockApi
  }

  // Notificar al frontend que el puente está listo
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('pywebviewready'))
  }, 10)
}
