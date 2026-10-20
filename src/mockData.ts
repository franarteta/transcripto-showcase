export interface ConversationTurn {
  id: string
  speaker: string
  role: 'mic' | 'system'
  text: string
  timestamp: string
  second: number
}

export const REALTIME_CONVERSATION: ConversationTurn[] = [
  {
    id: 'turn-1',
    speaker: 'Franco Arteta',
    role: 'mic',
    text: 'Buenas tardes a todos. Iniciamos la sesión de sincronización técnica de Transcripto. Como acordamos, hoy revisamos el desacoplamiento de captura WASAPI y la resiliencia en streaming continuo.',
    timestamp: '00:03',
    second: 3
  },
  {
    id: 'turn-2',
    speaker: 'Tech Lead',
    role: 'system',
    text: 'Hola Franco. Excelente. Estuve revisando el PR del pipeline de audio. El desacoplamiento del bucle de captura mediante colas de frames PCM eliminó por completo el backlog que teníamos en grabaciones largas.',
    timestamp: '00:08',
    second: 8
  },
  {
    id: 'turn-3',
    speaker: 'Franco Arteta',
    role: 'mic',
    text: 'Exacto. Ahora la captura corre en hilos de máxima prioridad con pacing calibrado a 1.0x. Además, integramos el fallback automático ante errores 429 de cuota en Groq, conmutando a Gemini 2.5 Flash en menos de 200 milisegundos.',
    timestamp: '00:15',
    second: 15
  },
  {
    id: 'turn-4',
    speaker: 'Tech Lead',
    role: 'system',
    text: 'Esa conmutación transparente es clave para reuniones de producción de más de una hora. ¿Cómo quedó la integración de descarga directa desde enlaces de YouTube y Google Drive?',
    timestamp: '00:23',
    second: 23
  },
  {
    id: 'turn-5',
    speaker: 'Franco Arteta',
    role: 'mic',
    text: 'Quedó operativa en la pestaña de Importar. El downloader extrae únicamente el flujo de audio Opus o AAC sin bajar video pesado, y lo normaliza a 16 kHz WAV para Whisper y Groq.',
    timestamp: '00:31',
    second: 31
  },
  {
    id: 'turn-6',
    speaker: 'Tech Lead',
    role: 'system',
    text: 'Perfecto. Y la exportación de informes ejecutivos a Microsoft Word (.docx) con tabla de acuerdos y participantes en portada cubre exactamente lo que piden los directores. Procedamos con el release.',
    timestamp: '00:40',
    second: 40
  }
]

export const SAMPLE_SUMMARY_MARKDOWN = `### Resumen Ejecutivo de Sincronización Técnica

**Objetivo de la Reunión:**
Auditar el rendimiento del pipeline en tiempo real de Transcripto v2.5.5, validar la eliminación del backlog de captura y verificar la resiliencia ante límites de cuota (Rate Limits 429).

---

#### 1. Conclusiones Principales y Arquitectura
- **Eliminación de Latencia y Backlog:** La arquitectura de buffers desacoplados y pacing a 1.0x garantiza sincronía acústica continua en reuniones de más de 30 minutos sin acumulación de memoria.
- **Tolerancia a Fallos Groq 429:** Implementación de failover automático hacia Gemini 2.5 Flash en caso de agotamiento de tokens por minuto (TPM), asegurando transcripción ininterrumpida.
- **Ingesta Web Directa:** Módulo streaming para extracción y normalización de audio desde YouTube y Google Drive sin descarga de video redundante.
- **Exportación Word (.docx) Profesional:** Portada corporativa con lista de participantes detectados, índice temático, matriz de acuerdos y transcripción cronológica completa.

---

#### 2. Matriz de Acuerdos y Próximos Pasos

| Tarea / Entregable | Responsable | Prioridad | Estado |
| :--- | :--- | :--- | :--- |
| **Monitoreo de latencia en grabaciones de 60 min** | Franco Arteta | Alta | ✅ Completado |
| **Auto-fallback transparente Groq -> Gemini Flash** | Franco Arteta | Alta | ✅ Desplegado |
| **Normalización de streams de YouTube a 16 kHz** | Franco Arteta | Media | ✅ Verificado |
| **Aprobación de instaladores MSI v2.5.5** | Tech Lead | Media | 🚀 Listo para producción |
`

export const SAMPLE_TASKS = [
  { id: 1, title: 'Validar failover automático Groq 429 hacia Gemini Flash', assignee: 'Franco Arteta', done: true, priority: 'Alta' },
  { id: 2, title: 'Verificar extracción directa de audio desde YouTube / Drive', assignee: 'Franco Arteta', done: true, priority: 'Alta' },
  { id: 3, title: 'Pruebas de estrés acústico de 30 minutos sin drift', assignee: 'Franco Arteta', done: true, priority: 'Media' },
  { id: 4, title: 'Publicación de instaladores oficiales firmados MSI v2.5.5', assignee: 'Tech Lead', done: false, priority: 'Media' },
]

export const SAMPLE_TIMELINE = [
  { time: '00:00 - 00:08', title: 'Apertura y objetivos', desc: 'Franco Arteta y Tech Lead dan inicio a la auditoría técnica de Transcripto.' },
  { time: '00:08 - 00:23', title: 'Desacoplamiento WASAPI y failover 429', desc: 'Revisión del buffer desacoplado y conmutación automática de IA ante saturación de API.' },
  { time: '00:23 - 00:35', title: 'Ingesta de URLs web (YouTube/Drive)', desc: 'Demostración de extracción de pistas de audio sin descarga pesada de video.' },
  { time: '00:35 - 00:45', title: 'Informes ejecutivos Word (.docx) y Cierre', desc: 'Validación de los informes con participantes en portada y aprobación para release.' },
]

export const YOUTUBE_SAMPLE_META = {
  url: 'https://www.youtube.com/watch?v=demo-transcripto-ia',
  provider: 'YouTube',
  title: 'Arquitectura de Streaming y Modelos Whisper en Producción - Conferencia Tech',
  duration: 860,
  durationFormatted: '14:20',
  audioQuality: '16 kHz Mono Float32 (Optimizado Whisper)'
}
