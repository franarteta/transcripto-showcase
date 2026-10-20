import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, Archive, Bot, CalendarDays, CheckCircle2, ChevronRight, CircleStop,
  Clock3, Copy, Database, FileAudio, FilePlus2, FolderOpen, Gauge, Globe2, Home,
  CloudDownload, Download, Info, Languages, ListChecks, Mic2, Pause, Play, RefreshCw, Search, Settings,
  ShieldCheck, SlidersHorizontal, Sparkles, Square, Upload, Users, WandSparkles, X, Zap, ExternalLink,
  Edit3, User, UserCheck, UserPlus,
} from 'lucide-react'
import { PrettyText } from './components/PrettyText'

type Page = 'home'|'live'|'import'|'history'|'results'|'ai'|'connections'|'settings'
type Segment = { start:number; end:number; text:string; speaker?:string }
type HistoryItem = { meeting_id:string; title:string; created_at:string; duration:number; language:string; engine:string; summary_preview?:string }
type Result = { title:string; language:string; engine:string; summary:string; analysis?:string; visual_timeline?:string; segments:Segment[]; source?:{name:string;duration:number}; notes?:string; speaker_names?:Record<string,string> }
type Source = { id:string; label:string }
type UpdateRelease = { version:string; notes:string; published_at:string; size_bytes:number; package_type:'msi'|'msp'; assets:{name:string;url:string;sha256:string;size_bytes:number}[] }
type Bootstrap = {
  settings:Record<string,unknown>; sources:Source[]; history:HistoryItem[]; models:string[];
  languages:{label:string;value:string}[]; templates:string[]; export_folder:string; providers:string[]; version:string; audio_warning?:string;
  provider_configured?:Record<string,boolean>; provider_models?:Record<string,string[]>; provider_selected_models?:Record<string,string>;
  diarization?:{module_installed:boolean;token_configured:boolean;verified:boolean;ready:boolean;reason:string;model:string}; credential_warning?:string;
  live_local_models?:string[];
  live_gemini_models?:{id:string;label:string;available:boolean}[];
  microphones?:Source[]; desktop_sources?:Source[]; selected_mic?:string; selected_desktop?:string;
}

declare global {
  interface Window {
    pywebview?: { api: Record<string,(...args:any[])=>Promise<any>> }
    transcriptoEvent?: (event:any)=>void
  }
}

const demo: Bootstrap = {
  settings:{live_model:'base',live_language:'es-AR',analysis_provider:'none',whisper_model:'small',language:'es-AR',enhance_speech:true},
  sources:[], history:[], models:['medium','small','base','tiny'],
  languages:[{label:'Español (Argentina) · es-AR',value:'es-AR'},{label:'Español general · es',value:'es'},{label:'Automático',value:'auto'},{label:'Inglés · en',value:'en'}],
  templates:['Reunión general','Acta formal','Clase','Entrevista','Ventas','Soporte','Daily'],
  export_folder:'', providers:['ollama','groq','gemini','openai','huggingface','custom'], version:'2.5.5',
  provider_configured:{}, diarization:{module_installed:true,token_configured:false,verified:false,ready:false,reason:'Configurá Hugging Face para identificar hablantes.',model:'pyannote/speaker-diarization-community-1'},
  microphones:[{id:'default',label:'Micrófono predeterminado de Windows'},{id:'none',label:'Desactivado (No grabar micrófono)'}],
  desktop_sources:[{id:'loop::default',label:'Audio del sistema predeterminado'},{id:'none',label:'Desactivado (No grabar audio del sistema)'}],
  selected_mic:'default', selected_desktop:'none',
}

const call = async (name:string,...args:any[]) => {
  const fn = window.pywebview?.api?.[name]
  if (!fn) throw new Error('La interfaz nativa todavía se está iniciando.')
  return fn(...args)
}
const formatTime = (seconds=0) => {
  const s=Math.max(0,Math.floor(seconds)); const h=Math.floor(s/3600); const m=Math.floor((s%3600)/60)
  return h ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
}
const providerName:Record<string,string>={ollama:'Ollama · local',groq:'Groq',gemini:'Google Gemini',openai:'OpenAI',huggingface:'Hugging Face · hablantes',custom:'Endpoint propio'}
const providerLinks:Record<string,string>={ollama:'https://ollama.com/download',groq:'https://console.groq.com/keys',gemini:'https://aistudio.google.com/app/apikey',openai:'https://platform.openai.com/api-keys',huggingface:'https://huggingface.co/settings/tokens',custom:'https://platform.openai.com/docs/api-reference'}

function App(){
  const [page,setPage]=useState<Page>('home')
  const [boot,setBoot]=useState<Bootstrap>(demo)
  const [toast,setToast]=useState('')
  const [busy,setBusy]=useState(false)
  const [progress,setProgress]=useState(0)
  const [status,setStatus]=useState('Listo')
  const [result,setResult]=useState<Result|null>(null)
  const [liveSegments,setLiveSegments]=useState<Segment[]>([])
  const [liveInterimMic,setLiveInterimMic]=useState('')
  const [liveInterimDesktop,setLiveInterimDesktop]=useState('')
  const [liveLevel,setLiveLevel]=useState(0)
  const [liveMicLevel,setLiveMicLevel]=useState(0)
  const [liveDesktopLevel,setLiveDesktopLevel]=useState(0)
  const [recording,setRecording]=useState(false)
  const [livePaused,setLivePaused]=useState(false)
  const [liveStopping,setLiveStopping]=useState(false)
  const [updateRelease,setUpdateRelease]=useState<UpdateRelease|null>(null)
  const [updateProgress,setUpdateProgress]=useState(0)
  const [updateMessage,setUpdateMessage]=useState('')
  const [updatePath,setUpdatePath]=useState('')
  const [bridgeError,setBridgeError]=useState('')
  const [liveConnectionStatus,setLiveConnectionStatus]=useState<'connected'|'reconnecting'|'offline'>('connected')
  const [liveConnectionMessage,setLiveConnectionMessage]=useState('')
  const [fatalErrorModal,setFatalErrorModal]=useState('')
  const [importFile,setImportFile]=useState<any>(null)
  const [isWindowDragging,setIsWindowDragging]=useState(false)
  const dragCounterRef=useRef(0)
  const autoUpdateChecked=useRef(false)

  const notify = (message: any) => {
    const text = typeof message === 'string' ? message : (message?.message || message?.error || 'Operación realizada con éxito')
    setToast(text)
    window.setTimeout(() => setToast(''), 4200)
  }

  const safeSetResult = (data: any) => {
    if (!data) {
      setResult(null)
      return
    }
    const item = Array.isArray(data) ? data[0] : data
    setResult(item)
  }

  const processDroppedFile=async(dropped:File)=>{
    setIsWindowDragging(false)
    dragCounterRef.current = 0
    const filePath=(dropped as any).path
    if(filePath){
      try{
        const inspected=await call('inspect_file',filePath)
        if(inspected){
          setImportFile(inspected)
          setPage('import')
          notify(`Archivo cargado: ${inspected.name}`)
        }
      }catch(err:any){
        notify(err?.message||'No se pudo leer el archivo')
      }
    }else{
      if(dropped.size > 150 * 1024 * 1024){
        notify('El archivo es mayor a 150 MB. Usá el botón para seleccionar el archivo directamente desde el disco.')
        return
      }
      const reader=new FileReader()
      reader.onload=async()=>{
        try{
          const base64=(reader.result as string).split(',')[1]
          const inspected=await call('save_dropped_file',dropped.name,base64)
          if(inspected){
            setImportFile(inspected)
            setPage('import')
            notify(`Archivo cargado: ${inspected.name}`)
          }
        }catch(err:any){
          notify(err?.message||'Error al procesar el archivo arrastrado')
        }
      }
      reader.readAsDataURL(dropped)
    }
  }

  useEffect(()=>{
    const handleGlobalDragOver=(e:DragEvent)=>{
      e.preventDefault()
      if(e.dataTransfer){
        e.dataTransfer.dropEffect='copy'
      }
    }
    const handleGlobalDragEnter=(e:DragEvent)=>{
      e.preventDefault()
      if(e.dataTransfer){
        e.dataTransfer.dropEffect='copy'
      }
      dragCounterRef.current++
      if(dragCounterRef.current===1){
        setIsWindowDragging(true)
      }
    }
    const handleGlobalDragLeave=(e:DragEvent)=>{
      e.preventDefault()
      dragCounterRef.current--
      if(dragCounterRef.current<=0){
        dragCounterRef.current=0
        setIsWindowDragging(false)
      }
    }
    const handleGlobalDrop=async(e:DragEvent)=>{
      e.preventDefault()
      dragCounterRef.current=0
      setIsWindowDragging(false)
      const files=e.dataTransfer?.files
      if(files&&files.length>0){
        await processDroppedFile(files[0])
      }
    }
    const handleCancelDrag=()=>{
      dragCounterRef.current=0
      setIsWindowDragging(false)
    }

    window.addEventListener('dragover',handleGlobalDragOver,false)
    window.addEventListener('dragenter',handleGlobalDragEnter,false)
    window.addEventListener('dragleave',handleGlobalDragLeave,false)
    window.addEventListener('drop',handleGlobalDrop,false)
    window.addEventListener('dragend',handleCancelDrag,false)
    window.addEventListener('blur',handleCancelDrag,false)
    return()=>{
      window.removeEventListener('dragover',handleGlobalDragOver,false)
      window.removeEventListener('dragenter',handleGlobalDragEnter,false)
      window.removeEventListener('dragleave',handleGlobalDragLeave,false)
      window.removeEventListener('drop',handleGlobalDrop,false)
      window.removeEventListener('dragend',handleCancelDrag,false)
      window.removeEventListener('blur',handleCancelDrag,false)
    }
  },[])

  const refresh=async()=>{const data=await call('bootstrap');setBoot(data);setBridgeError('');return data}
  useEffect(()=>{
    let cancelled=false, retry:number|undefined, attempts=0
    const connect=async()=>{
      attempts++
      try{
        await refresh()
        if(!cancelled) setBridgeError('')
      }catch(e:any){
        if(cancelled)return
        if(attempts>=12){
          setBridgeError('No se pudo conectar la interfaz con Transcripto. Reintentando…')
        }
        retry=window.setTimeout(connect, Math.min(100 + attempts * 50, 800))
      }
    }
    const ready=()=>{void connect()}
    window.addEventListener('pywebviewready',ready)
    void connect()
    return()=>{cancelled=true;if(retry)window.clearTimeout(retry);window.removeEventListener('pywebviewready',ready)}
  },[])
  useEffect(()=>{
    if(autoUpdateChecked.current||!boot.settings.auto_check_updates||!boot.settings.update_manifest_url)return
    autoUpdateChecked.current=true
    call('check_updates','').then((r:any)=>{if(r.available)setUpdateRelease(r.release)}).catch(()=>{})
  },[boot.settings.auto_check_updates,boot.settings.update_manifest_url])
  useEffect(()=>{
    window.transcriptoEvent=(event:any)=>{
      if(event.kind==='sources'){
        setBoot(v=>({
          ...v,
          sources: event.sources||[],
          microphones: event.microphones||v.microphones||[],
          desktop_sources: event.desktop_sources||v.desktop_sources||[],
          audio_warning: event.audio_warning||'',
          selected_mic: event.selected_mic||v.selected_mic||'default',
          selected_desktop: event.selected_desktop||v.selected_desktop||'none',
          settings: {
            ...v.settings,
            live_source: event.selected_source || v.settings.live_source || (event.sources?.[0]?.id || '')
          }
        }))
      }
      if(event.kind==='status') setStatus(String(event.message||''))
      if(event.kind==='progress'){setProgress(Number(event.value||0));setStatus(event.message||'Procesando…')}
      if(event.kind==='live_level'){
        setLiveLevel(Number(event.percent||0))
        setLiveMicLevel(Number(event.mic_percent||0))
        setLiveDesktopLevel(Number(event.desktop_percent||0))
      }
      if(event.kind==='live_segments'){
        const incoming: Segment[] = event.segments || []
        if(incoming.length){
          setLiveSegments(prev => {
            const next = [...prev]
            for(const inc of incoming){
              const incText = String(inc.text || '').trim()
              if(!incText) continue
              const incSpeaker = inc.speaker || 'Micrófono'
              let merged = false
              for(let i = next.length - 1; i >= 0 && i >= next.length - 6; i--){
                const p = next[i]
                if(p.speaker === incSpeaker){
                  const pText = p.text.trim()
                  const pLow = pText.toLowerCase()
                  const incLow = incText.toLowerCase()
                  if(pLow === incLow){
                    merged = true
                    break
                  }
                  if(incLow.startsWith(pLow) && Math.abs(inc.start - p.start) < 20.0){
                    next[i] = { ...p, text: incText, start: Math.min(p.start, inc.start), end: Math.max(p.end, inc.end) }
                    merged = true
                    break
                  }
                  if(pLow.startsWith(incLow) && Math.abs(inc.start - p.start) < 20.0){
                    merged = true
                    break
                  }
                }
              }
              // Prevent aggregate duplicate dump if incoming text is already covered by recent bubbles
              if(!merged){
                const recentSpeakerText = next
                  .filter(s => (s.speaker || 'Micrófono') === incSpeaker)
                  .slice(-6)
                  .map(s => s.text.trim().toLowerCase())
                  .join(' ')
                const incNorm = incText.toLowerCase().replace(/[^\wáéíóúüñ]+/g, ' ').trim()
                const histNorm = recentSpeakerText.replace(/[^\wáéíóúüñ]+/g, ' ').trim()
                if(histNorm && histNorm.includes(incNorm)){
                  merged = true
                }
              }
              if(!merged) next.push(inc)
            }
            next.sort((a, b) => a.start - b.start)
            return next
          })
          for(const inc of incoming){
            const spk = String(inc.speaker || '').toLowerCase()
            if(spk.includes('escritorio') || spk.includes('sistema')){
              setLiveInterimDesktop('')
            } else {
              setLiveInterimMic('')
            }
          }
        }
      }
      if(event.kind==='live_interim'){
        const spk = String(event.speaker || '').toLowerCase()
        const text = String(event.text || '').trim()
        if(spk.includes('escritorio') || spk.includes('sistema')){
          setLiveInterimDesktop(text)
        } else if(spk.includes('micrófono') || spk.includes('mic')){
          setLiveInterimMic(text)
        } else {
          if(!text){
            setLiveInterimMic('')
            setLiveInterimDesktop('')
          } else {
            setLiveInterimMic(text)
          }
        }
      }
      if(event.kind==='live_started'){setRecording(true);setLivePaused(false);setLiveStopping(false);setLiveConnectionStatus('connected');setLiveConnectionMessage('');setStatus('Escuchando y transcribiendo en vivo…')}
      if(event.kind==='live_connection'){
        setLiveConnectionStatus(event.status || 'connected')
        setLiveConnectionMessage(String(event.message || ''))
      }
      if(event.kind==='live_warning'){notify(event.message || '')}
      if(event.kind==='live_cancelled'){setRecording(false);setLivePaused(false);setLiveStopping(false);setBusy(false);setLiveLevel(0);setLiveMicLevel(0);setLiveDesktopLevel(0);setLiveInterimMic('');setLiveInterimDesktop('');setLiveConnectionStatus('connected');setLiveConnectionMessage('');setStatus('Lista para grabar');if(event.message)notify(event.message)}
      if(event.kind==='live_complete'){setRecording(false);setLivePaused(false);setLiveStopping(false);setBusy(false);setProgress(0);setLiveLevel(0);setLiveMicLevel(0);setLiveDesktopLevel(0);setLiveInterimMic('');setLiveInterimDesktop('');setLiveConnectionStatus('connected');setLiveConnectionMessage('');setStatus('Listo');safeSetResult(event.result);setPage('results');if(event.warning)notify(event.warning);refresh()}
      if(event.kind==='result'){setBusy(false);setProgress(0);safeSetResult(event.result);setPage('results');refresh()}
      if(event.kind==='error'){
        setBusy(false)
        const wasRecording = recording
        setRecording(false)
        setLivePaused(false)
        setLiveStopping(false)
        setLiveLevel(0)
        setLiveMicLevel(0)
        setLiveDesktopLevel(0)
        setLiveInterimMic('')
        setLiveInterimDesktop('')
        setLiveConnectionStatus('connected')
        setLiveConnectionMessage('')
        setStatus(wasRecording ? 'Lista para grabar' : 'Listo')
        if (wasRecording) {
          setFatalErrorModal(event.message || 'Se produjo un error crítico durante la grabación.')
        }
        notify(event.message || 'Ocurrió un error')
      }
      if(event.kind==='update_progress'){setUpdateProgress(Number(event.value||0));setUpdateMessage(event.message||'Descargando actualización…')}
      if(event.kind==='update_ready'){setUpdateProgress(1);setUpdatePath(event.path||'');setUpdateMessage('Descarga verificada. Ya podés instalarla.')}
      if(event.kind==='update_error'){setUpdateProgress(0);setUpdateMessage('');notify(event.message||'No se pudo descargar la actualización')}
    }
    return()=>{delete window.transcriptoEvent}
  },[])

  const nav=[
    ['home','Inicio',Home],['live','Grabar en vivo',Mic2],['import','Importar archivo',FilePlus2],
    ['history','Historial',CalendarDays],['results','Resultados',Archive],['ai','IA y plantillas',Sparkles],
  ] as const
  return <div className="app">
    <aside className="rail">
      <div className="logo">T</div>
      {nav.map(([id,label,Icon])=><button key={id} data-tip={label} className={`nav-btn ${id==='live'?'record':''} ${page===id?'active':''}`} onClick={()=>setPage(id)}><Icon size={22}/></button>)}
      <div className="rail-spacer"/>
      <button data-tip="Conexiones" className={`nav-btn ${page==='connections'?'active':''}`} onClick={()=>setPage('connections')}><Bot size={22}/></button>
      <button data-tip="Ajustes y ayuda" className={`nav-btn ${page==='settings'?'active':''}`} onClick={()=>setPage('settings')}><Settings size={22}/></button>
      <div className="privacy-dot" title="Procesamiento local disponible"/>
    </aside>
    <main className="workspace">
      <header className="titlebar"><span className="window-title">transcripto</span><span className="status-pill"><i/>{bridgeError||(recording?(liveConnectionStatus==='reconnecting'?'Reconectando Gemini Live…':livePaused?'Pausado':status.startsWith('Analizando')?'Escuchando y transcribiendo en vivo…':status):status)}</span></header>
      {bridgeError&&<div className="notice warning" style={{margin:'14px 32px 0'}}>{bridgeError}</div>}
      {page==='home'&&<HomePage go={setPage} boot={boot} openHistory={async id=>{const r=await call('load_history',id);safeSetResult(r);setPage('results')}}/>}
      {page==='live'&&<LivePage boot={boot} segments={liveSegments} interimMic={liveInterimMic} interimDesktop={liveInterimDesktop} level={liveLevel} micLevel={liveMicLevel} desktopLevel={liveDesktopLevel} recording={recording} paused={livePaused} busy={busy} stopping={liveStopping} liveConnectionStatus={liveConnectionStatus} liveConnectionMessage={liveConnectionMessage} onRefreshSources={async()=>{try{const data=await call('refresh_sources');setBoot(data);notify('Fuentes de audio actualizadas')}catch(e:any){notify(e.message||'No se pudieron actualizar las fuentes')}}} onStart={async cfg=>{setLiveSegments([]);setLiveInterimMic('');setLiveInterimDesktop('');setBusy(true);setRecording(false);setLivePaused(false);setLiveStopping(false);setLiveLevel(0);setLiveMicLevel(0);setLiveDesktopLevel(0);setStatus(cfg.engine==='gemini_live'?'Conectando con Gemini Live…':'Cargando el modelo local…');try{await call('start_live',cfg)}catch(e:any){setBusy(false);setRecording(false);setStatus('Lista para grabar');notify(e.message)}}} onStop={async()=>{setLiveStopping(true);setLivePaused(false);setStatus(recording?'Deteniendo y guardando la grabación…':'Cancelando la carga del modelo…');try{await call('stop_live')}catch(e:any){setLiveStopping(false);notify(e.message)}}} onPause={async()=>{if(livePaused){await call('resume_live');setLivePaused(false)}else{await call('pause_live');setLivePaused(true)}}}/>} 
      {page==='import'&&<ImportPage
        boot={boot}
        busy={busy}
        progress={progress}
        status={status}
        file={importFile}
        setFile={setImportFile}
        isWindowDragging={isWindowDragging}
        onProcessDropped={processDroppedFile}
        onRun={async cfg=>{setBusy(true);setProgress(.02);try{await call('transcribe_file',cfg)}catch(e:any){setBusy(false);notify(e.message)}}}
        onRunUrl={async cfg=>{setBusy(true);setProgress(.01);setStatus('Conectando al enlace web…');try{await call('transcribe_url',cfg);notify('Descargando y transcribiendo enlace web…')}catch(e:any){setBusy(false);notify(e.message||'Error al transcribir enlace')}}}
      />} 
      {page==='history'&&<HistoryPage items={boot.history} reload={refresh} open={async id=>{const r=await call('load_history',id);safeSetResult(r);setPage('results')}}/>}
      {page==='results'&&<ResultsPage result={result} onOpenHistory={()=>setPage('history')} onExport={async()=>notify(await call('export_current'))} notify={notify} onUpdateResult={safeSetResult}/>} 
      {page==='ai'&&<AiPage boot={boot} notify={notify} refresh={refresh}/>} 
      {page==='connections'&&<ConnectionsPage boot={boot} notify={notify} refresh={refresh}/>} 
      {page==='settings'&&<SettingsPage boot={boot} notify={notify} refresh={refresh} release={updateRelease} updateProgress={updateProgress} updateMessage={updateMessage} updatePath={updatePath} onRelease={setUpdateRelease} onDownload={async release=>{setUpdatePath('');setUpdateProgress(.01);setUpdateMessage('Preparando descarga…');await call('download_update',release)}}/>} 
    </main>
    {toast&&<div className="toast">{toast}</div>}
    {fatalErrorModal && (
      <Modal title="Error en la grabación" close={()=>setFatalErrorModal('')}>
        <div style={{ padding: '8px 0', lineHeight: 1.5 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
            <div style={{ padding: 10, borderRadius: 12, backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={28} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: '#111827', fontSize: 16 }}>
                La grabación se detuvo debido a un problema con el dispositivo de audio.
              </p>
              <p style={{ margin: '8px 0 0', color: '#4b5563', fontSize: 14 }}>
                {fatalErrorModal}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
            <button className="btn primary" onClick={()=>setFatalErrorModal('')}>Entendido</button>
          </div>
        </div>
      </Modal>
    )}
    {updateRelease&&page!=='settings'&&<div className="update-banner"><div className="update-icon"><CloudDownload size={22}/></div><div><b>Transcripto {updateRelease.version} está disponible</b><span>Podés descargarla e instalarla desde Ajustes.</span></div><button className="btn soft" onClick={()=>setPage('settings')}>Ver actualización</button><button className="icon-btn" onClick={()=>setUpdateRelease(null)} title="Cerrar"><X size={17}/></button></div>}
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
}

function Header({eyebrow,title,subtitle,action}:{eyebrow?:string,title:string,subtitle:string,action?:any}){
  return <div className="page-header"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{subtitle}</p></div>{action}</div>
}

function HomePage({go,boot,openHistory}:{go:(p:Page)=>void,boot:Bootstrap,openHistory:(id:string)=>void}){
  return <div className="page narrow">
    <section className="hero">
      <div><div className="eyebrow">LOCAL · PRIVADO · SIN CÓDIGO</div><h1>Convertí conversaciones en decisiones claras.</h1><p>Transcripción en vivo, hablantes, resumen profesional y tareas. Tus modelos locales están listos incluso sin Internet.</p><div className="actions"><button className="btn danger" onClick={()=>go('live')}><Mic2 size={18}/>Grabar ahora</button><button className="btn ghost" onClick={()=>go('import')}><Upload size={18}/>Importar archivo</button></div></div>
      <div className="hero-visual"><div className="orb"><Activity size={66}/></div></div>
    </section>
    <div className="grid-3" style={{marginTop:18}}>
      <Feature icon={<Zap/>} title="Texto mientras hablás" text="Bloques con línea de tiempo y señal real del micrófono."/>
      <Feature icon={<Users/>} title="Personas y contexto" text="Diarización local, nombres y términos propios de tu trabajo."/>
      <Feature icon={<ListChecks/>} title="Informe profesional" text="Resumen, decisiones, acciones, riesgos y exportación Word."/>
    </div>
    <div className="grid-2" style={{marginTop:18}}>
      <button className="quick-link card" onClick={()=>go('connections')}><Bot size={22}/><span><b>Conexiones de IA</b><small>Configurá Groq, Gemini, OpenAI u Ollama.</small></span><ChevronRight size={19}/></button>
      <button className="quick-link card" onClick={()=>go('settings')}><Settings size={22}/><span><b>Configuración de Transcripto</b><small>Carpetas, privacidad, grabaciones y resúmenes.</small></span><ChevronRight size={19}/></button>
    </div>
    {boot.history.length>0&&<section style={{marginTop:30}}><div className="section-title"><Clock3 size={19}/><h2>Reuniones recientes</h2></div><div className="card meeting-list">{boot.history.slice(0,4).map(x=><Meeting key={x.meeting_id} item={x} open={openHistory}/>)}</div></section>}
  </div>
}
function Feature({icon,title,text}:{icon:any,title:string,text:string}){return <div className="card feature"><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p></div>}

function LivePage({boot,segments,interimMic,interimDesktop,level,micLevel,desktopLevel,recording,paused,busy,stopping,liveConnectionStatus,liveConnectionMessage,onStart,onStop,onPause,onRefreshSources}:{boot:Bootstrap,segments:Segment[],interimMic:string,interimDesktop:string,level:number,micLevel:number,desktopLevel:number,recording:boolean,paused:boolean,busy:boolean,stopping:boolean,liveConnectionStatus?:'connected'|'reconnecting'|'offline',liveConnectionMessage?:string,onStart:(x:any)=>void,onStop:()=>void,onPause:()=>void,onRefreshSources:()=>Promise<void>}){
  const [settings,setSettings]=useState(false)
  const [micSource,setMicSource]=useState(String(boot.selected_mic||'default'))
  const [desktopSource,setDesktopSource]=useState(String(boot.selected_desktop||'none'))
  const [engine,setEngine]=useState(String(boot.settings.live_engine||'local'))
  const [model,setModel]=useState(String(boot.settings.live_model||'small'))
  const [geminiModel,setGeminiModel]=useState(String(boot.settings.live_gemini_model||'gemini-3.5-transcribe-live'))
  const [language,setLanguage]=useState(String(boot.settings.live_language||'es-AR'))
  const [folder,setFolder]=useState(boot.export_folder)
  const [seconds,setSeconds]=useState(0)
  const [analyze,setAnalyze]=useState(Boolean(boot.settings.live_analyze ?? (boot.provider_configured?.groq || boot.providers.includes('groq'))))
  const [analysisProvider,setAnalysisProvider]=useState(String(
    (boot.settings.analysis_provider && boot.settings.analysis_provider !== 'none')
      ? boot.settings.analysis_provider
      : (boot.provider_configured?.groq || boot.providers.includes('groq') ? 'groq' : 'none')
  ))
  const [analysisModel,setAnalysisModel]=useState('')
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  const geminiModels=boot.live_gemini_models||[]
  const microphones=boot.microphones||[{id:'default',label:'Micrófono predeterminado de Windows'},{id:'none',label:'Desactivado (No grabar micrófono)'}]
  const desktopSources=boot.desktop_sources||[{id:'loop::default',label:'Audio del sistema predeterminado'},{id:'none',label:'Desactivado (No grabar audio del sistema)'}]
  const analysisProviders=boot.providers.filter(item=>item!=='huggingface')
  const analysisModels=boot.provider_models?.[analysisProvider]||[]

  useEffect(()=>{
    if(boot.selected_mic) setMicSource(boot.selected_mic)
    if(boot.selected_desktop) setDesktopSource(boot.selected_desktop)
    if(!folder) setFolder(boot.export_folder)
    if(geminiModels.length && !geminiModels.some(x=>x.id===geminiModel)) {
      setGeminiModel(geminiModels.find(x=>x.available)?.id||geminiModels[0].id)
    }
  },[boot.selected_mic, boot.selected_desktop, boot.export_folder, geminiModel, geminiModels])

  useEffect(()=>{if(!recording||paused)return;const id=setInterval(()=>setSeconds(x=>x+1),1000);return()=>clearInterval(id)},[recording,paused])
  useEffect(()=>{const preferred=boot.provider_selected_models?.[analysisProvider]||'';setAnalysisModel(analysisModels.includes(preferred)?preferred:(analysisModels[0]||''))},[analysisProvider,boot.provider_models,boot.provider_selected_models])
  const micBars=useMemo(()=>Array.from({length:5},(_,i)=>Math.max(3,Math.min(22,3+micLevel*((i*7%8)/24+.16)))),[micLevel])
  const desktopBars=useMemo(()=>Array.from({length:5},(_,i)=>Math.max(3,Math.min(22,3+desktopLevel*((i*5%8)/24+.16)))),[desktopLevel])
  const preparing=busy&&!recording&&!stopping, active=recording||preparing||stopping
  const hasAudioSource=(micSource!=='none'||desktopSource!=='none')
  const combinedSource = (micSource !== 'none' && desktopSource !== 'none') ? `mix::${micSource}||${desktopSource}` : (micSource !== 'none' ? micSource : desktopSource)
  const start=()=>onStart({source: combinedSource, mic_source: micSource, desktop_source: desktopSource, engine, model, gemini_model: geminiModel, language, folder, analyze, analysis_provider:analysisProvider, analysis_model:analysisModel})
  useEffect(()=>{const choices=engine==='moonshine'?['moonshine-tiny','moonshine-small']:boot.models;if(engine!=='gemini_live'&&!choices.includes(model))setModel(choices[0])},[engine,model,boot.models])
  useEffect(()=>{if(preparing)setSeconds(0)},[preparing])
  useEffect(()=>{
    if(recording || segments.length > 0 || interimMic || interimDesktop){
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  },[segments, interimMic, interimDesktop, recording])
  const selectedGemini=geminiModels.find(x=>x.id===geminiModel)

  return <div className="page"><div className="recording-shell">
    <div className="toolbar"><button onClick={()=>navigator.clipboard?.writeText(segments.map(s=>s.text).join('\n'))}><Copy size={17}/>Copiar</button><button onClick={()=>setSettings(true)}><Gauge size={17}/>Modelo</button><button onClick={()=>setSettings(true)}><Mic2 size={17}/>Dispositivo</button><button onClick={()=>setSettings(true)}><Languages size={17}/>Idioma</button></div>
    <div className={`recording-status ${recording?'on':''} ${preparing||stopping?'pending':''}`}><span className="dot"/><span>{stopping?'Finalizando…':preparing?(engine==='gemini_live'?'Conectando Gemini Live…':'Cargando modelo…'):paused?'Pausado':recording?'Grabando':'Lista para grabar'} · {formatTime(seconds)}</span></div>
    {boot.audio_warning&&<div className="notice warning" style={{maxWidth:760,margin:'-10px auto 20px'}}>{boot.audio_warning}</div>}
    {recording && liveConnectionStatus === 'reconnecting' && (
      <div className="live-alert reconnecting" style={{
        maxWidth: 760,
        margin: '-10px auto 16px',
        padding: '12px 18px',
        borderRadius: '10px',
        backgroundColor: '#fef3c7',
        border: '1px solid #f59e0b',
        color: '#92400e',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', backgroundColor: '#fde68a', flexShrink: 0 }}>
          <Activity size={18} color="#b45309" />
        </div>
        <div style={{ flex: 1, fontSize: '13.5px', lineHeight: 1.4 }}>
          <strong style={{ display: 'block', fontSize: '14px', marginBottom: 2 }}>Reconectando con Gemini Live…</strong>
          {liveConnectionMessage || 'La señal remota se interrumpió temporalmente, pero no te preocupes: tu grabación física se sigue guardando localmente en tu PC.'}
        </div>
      </div>
    )}
    {recording && liveConnectionStatus === 'offline' && (
      <div className="live-alert offline" style={{
        maxWidth: 760,
        margin: '-10px auto 16px',
        padding: '12px 18px',
        borderRadius: '10px',
        backgroundColor: '#fee2e2',
        border: '1px solid #ef4444',
        color: '#991b1b',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', backgroundColor: '#fecaca', flexShrink: 0 }}>
          <AlertTriangle size={18} color="#b91c1c" />
        </div>
        <div style={{ flex: 1, fontSize: '13.5px', lineHeight: 1.4 }}>
          <strong style={{ display: 'block', fontSize: '14px', marginBottom: 2 }}>Conexión con Gemini Live no disponible</strong>
          {liveConnectionMessage || 'Se agotaron los intentos de conexión en vivo. Tu audio físico SIGUE GRABÁNDOSE de forma 100% segura en tu disco para que no pierdas nada.'}
        </div>
      </div>
    )}
    <div className="transcript">
      {segments.length||interimMic||interimDesktop?(
        <div className="transcript-dialogue">
          {segments.map((s,i)=>{
            const isDesktop = s.speaker === 'Escritorio' || s.speaker?.toLowerCase().includes('escritorio') || s.speaker?.toLowerCase().includes('sistema')
            return (
              <div className={`live-bubble-row ${isDesktop?'right':'left'}`} key={`${s.start}-${i}`}>
                <div className={`live-bubble ${isDesktop?'desktop-bubble':'mic-bubble'}`}>
                  <div className={`bubble-header ${isDesktop?'desktop-header':'mic-header'}`}>
                    {isDesktop?<Activity size={13}/>:<Mic2 size={13}/>}
                    <span>{isDesktop?'Audio del sistema / Videollamada':'Micrófono (Vos)'}</span>
                    <time>[{formatTime(s.start)}]</time>
                  </div>
                  <div className="bubble-text">{s.text}</div>
                </div>
              </div>
            )
          })}
          {interimMic&&(
            <div className="live-bubble-row left">
              <div className="live-bubble interim-bubble mic-bubble">
                <div className="bubble-header mic-header">
                  <Mic2 size={13}/>
                  <span>Micrófono (Vos)…</span>
                  <time>ahora</time>
                </div>
                <div className="bubble-text">{interimMic}</div>
              </div>
            </div>
          )}
          {interimDesktop&&(
            <div className="live-bubble-row right">
              <div className="live-bubble interim-bubble desktop-bubble">
                <div className="bubble-header desktop-header">
                  <Activity size={13}/>
                  <span>Audio del sistema…</span>
                  <time>ahora</time>
                </div>
                <div className="bubble-text">{interimDesktop}</div>
              </div>
            </div>
          )}
          <div ref={transcriptEndRef} style={{ height: 1, marginTop: 4 }} />
        </div>
      ):(
        <div className="empty-live">
          <div>
            <Mic2 size={46}/>
            <h2 style={{marginTop:15}}>La transcripción aparecerá acá</h2>
            <p>Elegí una fuente de audio, presioná grabar y hablá con normalidad. Tu voz aparecerá a la izquierda y el audio de la videollamada a la derecha.</p>
          </div>
        </div>
      )}
      {preparing&&<div className="live-loading"><RefreshCw className="spin" size={17}/><span>{engine==='gemini_live'?'Conectando Gemini, validando el modelo y enviando el primer audio. El contador comienza recién cuando la API esté lista.':'Preparando el motor local y verificando la fuente de audio. La grabación comenzará recién cuando ambos estén listos.'}</span></div>}
      {recording&&<div className="listening"><b/>Escuchando y transcribiendo…</div>}
    </div>
    <div className="floating-controls">
      <button className="round" onClick={onPause} disabled={!recording||stopping} title={paused?'Continuar':'Pausar'}>{paused?<Play size={20}/>:<Pause size={20}/>}</button>
      <button className="round stop" onClick={active?onStop:start} disabled={stopping||(!active&&(!hasAudioSource||busy))} title={active?'Detener':'Iniciar grabación'}>{active?<Square size={18} fill="white"/>:<Mic2 size={21}/>}</button>
      <div className="meter-group">
        <div className={`audio-meter mic ${micSource==='none'?'disabled':''}`} title={micSource==='none'?'Micrófono desactivado':`Micrófono: ${Math.round(micLevel)}%`}>
          <Mic2 size={13}/>
          <span>Mic</span>
          <div className="wave-bars">
            {micBars.map((h,i)=><i key={i} style={{height:micSource==='none'?3:h}}/>)}
          </div>
        </div>
        <div className={`audio-meter desktop ${desktopSource==='none'?'disabled':''}`} title={desktopSource==='none'?'Audio del sistema desactivado':`Audio del sistema: ${Math.round(desktopLevel)}%`}>
          <Activity size={13}/>
          <span>Sistema</span>
          <div className="wave-bars">
            {desktopBars.map((h,i)=><i key={i} style={{height:desktopSource==='none'?3:h}}/>)}
          </div>
        </div>
      </div>
    </div>
  </div>{settings&&<Modal title="Configuración de audio" close={()=>setSettings(false)}>
    <div className="field"><label>Motor de transcripción en vivo</label><select value={engine} onChange={e=>setEngine(e.target.value)}><option value="moonshine">Moonshine local · streaming para CPU (experimental)</option><option value="local">Whisper local · sin Internet</option><option value="gemini_live">Gemini Live · API en tiempo real</option></select>{engine==='gemini_live'&&<span className="small muted">{boot.provider_configured?.gemini?'Usará la clave guardada en Conexiones. Este modelo en vivo es independiente del modelo de resumen y análisis.':'Falta la clave de Gemini. Abrí Conexiones → Google Gemini → Guardar y probar.'}</span>}</div>
    <div className="grid-2">
      <div className="field"><label>🎤 Entrada de micrófono</label><select value={micSource} onChange={e=>setMicSource(e.target.value)}>{microphones.map(x=><option value={x.id} key={x.id}>{x.label}</option>)}</select></div>
      <div className="field"><label>🔊 Audio del sistema / Altavoz</label><select value={desktopSource} onChange={e=>setDesktopSource(e.target.value)}>{desktopSources.map(x=><option value={x.id} key={x.id}>{x.label}</option>)}</select></div>
    </div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'-4px 0 12px'}}>
      <div className="small">
        {micSource!=='none'&&desktopSource!=='none'?<span style={{color:'#16a34a',fontWeight:600}}>🟢 Multicanal activo: Micrófono (Canal 1) + Sistema (Canal 2)</span>:
         micSource!=='none'?<span style={{color:'#2563eb',fontWeight:600}}>🔵 Canal único: Solo micrófono</span>:
         desktopSource!=='none'?<span style={{color:'#7c3aed',fontWeight:600}}>🟣 Canal único: Solo audio del sistema</span>:
         <span style={{color:'#dc2626',fontWeight:600}}>⚠️ Desactivaste ambas fuentes. Elegí al menos una para grabar.</span>}
      </div>
      <button className="btn ghost compact" onClick={async()=>{await onRefreshSources();}}><RefreshCw size={15}/>Actualizar fuentes</button>
    </div>
    <div className="grid-2">{engine==='gemini_live'?<div className="field"><label>Modelo de Gemini Live</label><select value={geminiModel} onChange={e=>setGeminiModel(e.target.value)}>{geminiModels.length?geminiModels.map(x=><option value={x.id} key={x.id}>{x.label}{x.available?'':' · requiere acceso'}</option>):<option value="gemini-3.5-transcribe-live">Gemini 3.5 Transcribe Live</option>}</select>{selectedGemini&&!selectedGemini.available&&<span className="small muted">Este modelo no fue habilitado para esta clave por Google. Elegilo solo si lo activaste en tu proyecto.</span>}</div>:<div className="field"><label>Modelo local</label><select value={model} onChange={e=>setModel(e.target.value)}>{(engine==='moonshine'?['moonshine-tiny','moonshine-small']:boot.models).map(x=><option value={x} key={x}>{x==='moonshine-tiny'?'Moonshine Tiny · máxima velocidad CPU':x==='moonshine-small'?'Moonshine Small · mejor precisión CPU':x==='tiny'?'tiny · ultra-rápido (ideal CPU)':x==='base'?'base · recomendado CPU':x==='small'?'small · preciso (CPU rápida o GPU)':'medium · máxima calidad (requiere GPU)'}</option>)}</select></div>}<div className="field"><label>Idioma</label><select value={language} onChange={e=>setLanguage(e.target.value)}>{boot.languages.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></div></div>
    <FolderField value={folder} setValue={setFolder}/>
    <div className="field"><label>Resumen y análisis al finalizar</label><div className="grid-2"><select value={analysisProvider} onChange={e=>{setAnalysisProvider(e.target.value);if(e.target.value==='none')setAnalyze(false)}}><option value="none">No generar resumen</option>{analysisProviders.map(item=><option key={item} value={item}>{providerName[item]||item}</option>)}</select><select value={analysisModel} disabled={analysisProvider==='none'||!analysisModels.length} onChange={e=>setAnalysisModel(e.target.value)}>{analysisModels.length?analysisModels.map(item=><option key={item}>{item}</option>):<option>Probá la conexión para cargar modelos</option>}</select></div><label className="check" style={{marginTop:10}}><input type="checkbox" checked={analyze} disabled={analysisProvider==='none'} onChange={e=>setAnalyze(e.target.checked)}/>Generar un resumen profesional y análisis cuando detenga la grabación</label><span className="small muted">La transcripción siempre se guarda aunque el proveedor de análisis tenga un problema.</span></div>
    <div className="notice"><b>{engine==='gemini_live'?'Gemini Live:':engine==='moonshine'?'Moonshine:':'Consejo:'}</b> {engine==='gemini_live'?'Gemini 3.5 Transcribe Live está optimizado para texto en tiempo real.':engine==='moonshine'?'Modelo local de español con actualizaciones parciales. Tiny prioriza velocidad; Small prioriza precisión. La primera preparación descarga el modelo; la latencia depende del equipo.':'`base` o `tiny` ofrecen transcripción fluida en CPU. `small` y `medium` son más precisos pero demandan CPU rápida o GPU.'}</div>
    <div className="actions" style={{justifyContent:'flex-end'}}><button className="btn primary" onClick={()=>setSettings(false)}>Listo</button></div>
  </Modal>}</div>
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

function ImportPage({
  boot,
  busy,
  progress,
  status,
  file,
  setFile,
  isWindowDragging,
  onProcessDropped,
  onRun,
  onRunUrl,
}: {
  boot: Bootstrap
  busy: boolean
  progress: number
  status: string
  file: any
  setFile: (x: any) => void
  isWindowDragging?: boolean
  onProcessDropped: (f: File) => Promise<void>
  onRun: (x: any) => void
  onRunUrl?: (x: any) => void
}) {
  const [tab, setTab] = useState<'file' | 'url'>('file')
  const [urlInput, setUrlInput] = useState('')
  const [urlMeta, setUrlMeta] = useState<any | null>(null)
  const [urlError, setUrlError] = useState('')
  const [inspecting, setInspecting] = useState(false)
  const isMountedRef = useRef(true)
  const inspectSeqRef = useRef(0)
  const urlInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (tab === 'url') {
      const t = window.setTimeout(() => urlInputRef.current?.focus(), 50)
      return () => window.clearTimeout(t)
    }
  }, [tab])

  const [folder, setFolder] = useState(boot.export_folder)
  const [engine, setEngine] = useState('local')
  const [model, setModel] = useState(String(boot.settings.whisper_model || 'small'))
  const [language, setLanguage] = useState(String(boot.settings.language || 'es-AR'))
  const [enhance, setEnhance] = useState(true)
  const [diarize, setDiarize] = useState(false)
  const [analyze, setAnalyze] = useState(false)
  const [analysisProvider, setAnalysisProvider] = useState(
    String(
      boot.settings.analysis_provider && boot.settings.analysis_provider !== 'none'
        ? boot.settings.analysis_provider
        : boot.provider_configured?.groq || boot.providers.includes('groq')
        ? 'groq'
        : 'ollama'
    )
  )
  const [analysisModel, setAnalysisModel] = useState('')

  const analysisModels = boot.provider_models?.[analysisProvider] || []
  const analysisProviders = boot.providers.filter(item => item !== 'huggingface')
  const diarization = boot.diarization
  const groqSpeechModels = (boot.provider_models?.groq || []).filter(item =>
    /whisper|transcrib|speech-to-text/i.test(item)
  )
  const geminiSpeechModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']

  useEffect(() => {
    if (!folder && boot.export_folder) setFolder(boot.export_folder)
  }, [folder, boot.export_folder])

  useEffect(() => {
    const preferred = boot.provider_selected_models?.[analysisProvider] || ''
    setAnalysisModel(analysisModels.includes(preferred) ? preferred : analysisModels[0] || '')
  }, [analysisProvider, boot.provider_models, boot.provider_selected_models])

  useEffect(() => {
    if (engine === 'local' && !boot.models.includes(model)) setModel(boot.models[0] || 'small')
    if (engine === 'groq' && groqSpeechModels.length && !groqSpeechModels.includes(model))
      setModel(groqSpeechModels[0])
    if (engine === 'gemini' && !geminiSpeechModels.includes(model)) setModel(geminiSpeechModels[0])
  }, [engine, model, boot.models, boot.provider_models])

  useEffect(() => {
    if (file) setTab('file')
  }, [file])

  const [isDragging, setIsDragging] = useState(false)
  const choose = async () => {
    const r = await call('choose_media')
    if (r) setFile(r)
  }

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
    await onProcessDropped(files[0])
  }

  const handleInspectUrl = async (rawUrl?: string) => {
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
    const reqId = ++inspectSeqRef.current
    setInspecting(true)
    try {
      const meta = await call('inspect_url', cleanUrl)
      if (!isMountedRef.current || inspectSeqRef.current !== reqId) return
      setUrlMeta(meta)
    } catch (err: any) {
      if (!isMountedRef.current || inspectSeqRef.current !== reqId) return
      setUrlMeta(null)
      setUrlError(
        err?.message || 'No se pudo obtener información del enlace. Verificá que sea público y accesible.'
      )
    } finally {
      if (isMountedRef.current && inspectSeqRef.current === reqId) {
        setInspecting(false)
      }
    }
  }

  const handlePasteUrl = async () => {
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
      inspectSeqRef.current++
      setUrlInput(clean)
      setUrlError('')
      setUrlMeta(null)
      void handleInspectUrl(clean)
    } catch {
      setUrlError('No se pudo leer el portapapeles. Verificá los permisos o pegá el enlace manualmente (Ctrl+V).')
    }
  }

  const handleStartUrl = () => {
    const cleanInput = urlInput.trim()
    if (!cleanInput) {
      setUrlError('Ingresá una dirección web (URL) para transcribir.')
      return
    }
    const validation = validateWebUrl(cleanInput)
    if (!validation.valid) {
      setUrlError(validation.error || 'Dirección web no válida.')
      return
    }
    const finalUrl = validation.cleanUrl || cleanInput
    const isMetaMatching = urlMeta && (urlMeta.url === cleanInput || urlMeta.url === finalUrl)
    const finalTitle = isMetaMatching ? (urlMeta?.title || '') : ''

    setFile(null)

    if (onRunUrl) {
      onRunUrl({
        url: finalUrl,
        title: finalTitle,
        folder,
        engine,
        model,
        language,
        enhance,
        diarize,
        analyze,
        analysis_provider: analysisProvider,
        analysis_model: analysisModel,
      })
    }
  }

  const dropActive = Boolean(isDragging || isWindowDragging)

  return (
    <div className="page narrow">
      <Header
        eyebrow="IMPORTAR"
        title="Audio o video a texto"
        subtitle="Elegí un archivo local o pegá un enlace web, ajustá la calidad y recibí todos los formatos en la carpeta indicada."
      />

      <div className="tabs" style={{ marginBottom: 18 }}>
        <button
          type="button"
          disabled={busy}
          className={tab === 'file' ? 'active' : ''}
          onClick={() => setTab('file')}
        >
          <Upload size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
          Archivo local
        </button>
        <button
          type="button"
          disabled={busy}
          className={tab === 'url' ? 'active' : ''}
          onClick={() => setTab('url')}
        >
          <Globe2 size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
          Pegar enlace web
        </button>
      </div>

      <div className="grid-2">
        <div>
          {tab === 'file' ? (
            <div
              className={`dropzone ${dropActive ? 'dragging' : ''}`}
              onClick={choose}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={
                dropActive
                  ? {
                      borderColor: '#0284c7',
                      background: 'rgba(2, 132, 199, 0.08)',
                      transform: 'scale(1.01)',
                      transition: 'all 0.15s ease',
                    }
                  : undefined
              }
            >
              {file ? (
                <div>
                  <CheckCircle2 size={48} color="#22c55e" />
                  <h2 style={{ marginTop: 12 }}>{file.name}</h2>
                  <p>{file.details}</p>
                  <button className="btn ghost">Cambiar archivo</button>
                </div>
              ) : (
                <div>
                  <div className="drop-icon">
                    <Upload />
                  </div>
                  <h2>{dropActive ? 'Soltá el archivo acá' : 'Elegí o arrastrá un audio o video'}</h2>
                  <p>MP3, WAV, M4A, FLAC, MP4, MOV, MKV, WEBM y más</p>
                  <button className="btn primary">Explorar archivos</button>
                  <button
                    type="button"
                    className="btn soft"
                    style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={e => {
                      e.stopPropagation()
                      choose()
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
                  htmlFor="web-url-input-desktop"
                  style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}
                >
                  Dirección web del audio o video
                </label>
                <p style={{ margin: '0 0 12px', fontSize: 12.5, color: '#64748b', lineHeight: 1.45 }}>
                  Pegá un enlace de YouTube, Google Drive, Zoom Cloud, Dropbox o una URL directa para transcribirlo.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    ref={urlInputRef}
                    id="web-url-input-desktop"
                    type="url"
                    aria-label="Dirección web del audio o video"
                    aria-invalid={Boolean(urlError)}
                    aria-describedby={urlError ? 'web-url-error-desktop' : undefined}
                    aria-busy={inspecting}
                    value={urlInput}
                    onChange={e => {
                      const val = e.target.value
                      inspectSeqRef.current++
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
                        inspectSeqRef.current++
                        const validation = validateWebUrl(cleanPasted)
                        if (validation.valid) {
                          const cleanUrl = validation.cleanUrl || cleanPasted
                          setUrlInput(cleanUrl)
                          setUrlError('')
                          setUrlMeta(null)
                          void handleInspectUrl(cleanUrl)
                        } else {
                          setUrlInput(cleanPasted)
                          setUrlMeta(null)
                          setUrlError(validation.error || 'Dirección web no válida.')
                        }
                      }
                    }}
                    placeholder="Pegá un enlace de YouTube, Google Drive, Zoom Cloud o Dropbox..."
                    disabled={busy || inspecting}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (busy || inspecting) return
                        const clean = urlInput.trim()
                        const isMetaMatching = urlMeta && (urlMeta.url === clean || urlMeta.url === validateWebUrl(clean).cleanUrl)
                        if (isMetaMatching) {
                          handleStartUrl()
                        } else {
                          void handleInspectUrl()
                        }
                      }
                    }}
                    style={{
                      flex: '1 1 200px',
                      minWidth: 0,
                      padding: '10px 12px',
                      borderRadius: 9,
                      border: urlError ? '1px solid #f87171' : '1px solid #dbe2ea',
                      fontSize: 13.5,
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={handlePasteUrl}
                      disabled={busy || inspecting}
                      title="Pegar enlace desde el portapapeles"
                      style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
                    >
                      <Copy size={15} />
                      <span>Pegar</span>
                    </button>
                    <button
                      type="button"
                      className="btn soft"
                      onClick={() => {
                        inspectSeqRef.current++
                        const demoUrl = 'https://www.youtube.com/watch?v=demo-transcripto-ia'
                        setUrlInput(demoUrl)
                        setUrlError('')
                        setUrlMeta(null)
                        void handleInspectUrl(demoUrl)
                      }}
                      disabled={busy || inspecting}
                      title="Cargar un enlace de YouTube de muestra para la demo"
                      style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
                    >
                      <Sparkles size={14} color="#0284c7" />
                      <span>Ejemplo</span>
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => void handleInspectUrl()}
                      disabled={busy || inspecting || !urlInput.trim()}
                      title="Inspeccionar información del enlace"
                      style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
                    >
                      {inspecting ? <RefreshCw className="spin" size={15} /> : <Search size={15} />}
                      <span>{inspecting ? 'Inspeccionando…' : 'Inspeccionar'}</span>
                    </button>
                  </div>
                </div>

                {urlError && (
                  <div
                    id="web-url-error-desktop"
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
                      lineHeight: 1.4,
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
                    marginTop: 6,
                    padding: 14,
                    borderRadius: 12,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        background: getProviderBadgeStyle(urlMeta.provider).bg,
                        color: getProviderBadgeStyle(urlMeta.provider).text,
                        border: `1px solid ${getProviderBadgeStyle(urlMeta.provider).border}`,
                      }}
                    >
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
                      className="btn ghost compact"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                      onClick={() => {
                        inspectSeqRef.current++
                        setInspecting(false)
                        setUrlMeta(null)
                        setUrlInput('')
                        setUrlError('')
                        window.setTimeout(() => urlInputRef.current?.focus(), 50)
                      }}
                      disabled={busy}
                    >
                      Cambiar enlace
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 'auto', paddingTop: 10 }}>
                  <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Servicios compatibles:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>YouTube</span>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#ecfdf5', color: '#065f46', fontWeight: 600 }}>Google Drive</span>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#eff6ff', color: '#1e40af', fontWeight: 600 }}>Zoom Cloud</span>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#f0f9ff', color: '#0369a1', fontWeight: 600 }}>Dropbox</span>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#f8fafc', color: '#475569', fontWeight: 600 }}>Audio directo (MP3/WAV/M4A)</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {busy && (
            <div className="card card-pad" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <b>{status}</b>
                <span className="muted small">{Math.round(progress * 100)}%</span>
              </div>
              <div className="progress">
                <span style={{ width: `${Math.max(3, progress * 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="card form-card">
          <div className="section-title">
            <SlidersHorizontal size={19} />
            <h2>Configuración</h2>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Motor de transcripción</label>
              <select value={engine} onChange={e => setEngine(e.target.value)}>
                <option value="local">Whisper local</option>
                <option value="groq">Groq · audio a texto</option>
                <option value="gemini">Google Gemini · audio a texto</option>
              </select>
            </div>
            <div className="field">
              <label>Modelo de transcripción</label>
              <select value={model} onChange={e => setModel(e.target.value)}>
                {engine === 'local'
                  ? boot.models.map(x => <option key={x}>{x}</option>)
                  : engine === 'gemini'
                  ? geminiSpeechModels.map(x => <option key={x}>{x}</option>)
                  : groqSpeechModels.length
                  ? groqSpeechModels.map(x => <option key={x}>{x}</option>)
                  : (
                    <>
                      <option>whisper-large-v3-turbo</option>
                      <option>whisper-large-v3</option>
                    </>
                  )}
              </select>
            </div>
          </div>
          <div className="field">
            <label>IA para resumen y análisis</label>
            <select value={analysisProvider} onChange={e => setAnalysisProvider(e.target.value)}>
              <option value="none">No generar resumen</option>
              {analysisProviders.map(x => (
                <option value={x} key={x}>
                  {providerName[x] || x}
                </option>
              ))}
            </select>
          </div>
          {analysisProvider !== 'none' && (
            <div className="field">
              <label>Modelo de {providerName[analysisProvider] || analysisProvider}</label>
              <select
                value={analysisModel}
                disabled={!analysisModels.length}
                onChange={e => setAnalysisModel(e.target.value)}
              >
                {analysisModels.length ? (
                  analysisModels.map(item => <option key={item}>{item}</option>)
                ) : (
                  <option>Probá la conexión para cargar modelos</option>
                )}
              </select>
              <span className="small muted">
                Se muestran los modelos recuperados de este proveedor, ordenados de mejor a más básico.
              </span>
            </div>
          )}
          <div className="field">
            <label>Idioma</label>
            <select value={language} onChange={e => setLanguage(e.target.value)}>
              {boot.languages.map(x => (
                <option value={x.value} key={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
          <FolderField value={folder} setValue={setFolder} />
          <label className="check">
            <input type="checkbox" checked={enhance} onChange={e => setEnhance(e.target.checked)} />
            Amplificar y limpiar las voces
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={diarize}
              disabled={!diarization?.ready}
              onChange={e => setDiarize(e.target.checked)}
            />
            Distinguir hablantes localmente
          </label>
          {!diarization?.ready && (
            <div className="notice warning small">
              {diarization?.reason || 'Configurá Hugging Face desde Conexiones antes de identificar hablantes.'}
            </div>
          )}
          <label className="check">
            <input type="checkbox" checked={analyze} onChange={e => setAnalyze(e.target.checked)} />
            Generar resumen y análisis
          </label>

          {tab === 'file' ? (
            <button
              className="btn primary"
              style={{ width: '100%', marginTop: 12 }}
              disabled={!file || busy}
              onClick={() =>
                onRun({
                  path: file.path,
                  folder,
                  engine,
                  model,
                  language,
                  enhance,
                  diarize,
                  analyze,
                  analysis_provider: analysisProvider,
                  analysis_model: analysisModel,
                })
              }
            >
              <WandSparkles size={18} />
              {busy ? 'Procesando…' : 'Transcribir ahora'}
            </button>
          ) : (
            <button
              className="btn primary"
              style={{ width: '100%', marginTop: 12 }}
              disabled={(!urlMeta && !urlInput.trim()) || busy || inspecting}
              onClick={handleStartUrl}
            >
              <WandSparkles size={18} />
              {busy ? 'Procesando enlace…' : 'Transcribir enlace ahora'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function FolderField({value,setValue}:{value:string,setValue:(x:string)=>void}){return <div className="field"><label>Guardar resultados en</label><div style={{display:'flex',gap:8}}><input value={value} readOnly/><button className="btn ghost" title="Elegir carpeta" onClick={async()=>{try{const x=await call('choose_folder',value);if(x)setValue(x)}catch(e:any){window.alert(e?.message||'No se pudo abrir el selector de carpeta')}}}><FolderOpen size={17}/></button></div></div>}

function HistoryPage({items,reload,open}:{items:HistoryItem[],reload:()=>void,open:(id:string)=>void}){const [query,setQuery]=useState('');const filtered=items.filter(x=>(x.title+x.summary_preview).toLowerCase().includes(query.toLowerCase()));return <div className="page narrow"><Header eyebrow="BIBLIOTECA LOCAL" title="Historial" subtitle="Buscá por título, contenido o resumen. Todo queda guardado en este equipo." action={<button className="btn ghost" onClick={reload}><RefreshCw size={17}/>Actualizar</button>}/><div className="search" style={{marginBottom:16}}><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar reuniones…"/></div><div className="card meeting-list">{filtered.length?filtered.map(x=><Meeting key={x.meeting_id} item={x} open={open}/>):<div className="empty-live"><p>No hay reuniones que coincidan con la búsqueda.</p></div>}</div></div>}
function Meeting({item,open}:{item:HistoryItem,open:(id:string)=>void}){return <div className="meeting" onClick={()=>open(item.meeting_id)}><div className="meeting-icon"><FileAudio size={20}/></div><div><strong>{item.title}</strong><small>{item.created_at.replace('T',' ').slice(0,16)} · {formatTime(item.duration)} · {item.engine}</small></div><ChevronRight size={18} color="#94a3b8"/></div>}

function SpeakerModal({
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
          alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={18} color="#2563eb" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Identificar Hablante</h3>
          </div>
          <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Renombrar a "{currentSpeaker}" en toda la reunión
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
                style={{ whiteSpace: 'nowrap', padding: '8px 14px', fontSize: 13 }}
              >
                <UserCheck size={14} style={{ marginRight: 4 }} />
                Aplicar a todos
              </button>
            </div>
            <p style={{ margin: '5px 0 0', fontSize: 11.5, color: '#64748b' }}>
              Actualiza esta etiqueta en todas las frases y en el informe Word .docx.
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
                        padding: '5px 10px', borderRadius: 20, border: '1px solid #cbd5e1',
                        background: '#f8fafc', color: '#1e293b', fontSize: 12.5, fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5
                      }}
                    >
                      <User size={12} color="#64748b" />
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

function ResultsPage({
  result,
  onOpenHistory,
  onExport,
  notify,
  onUpdateResult,
}: {
  result: Result | null
  onOpenHistory: () => void
  onExport: () => void
  notify?: (s: string) => void
  onUpdateResult?: (r: Result) => void
}) {
  const [tab, setTab] = useState('summary')
  const [modalOpen, setModalOpen] = useState(false)
  const [activeSpeaker, setActiveSpeaker] = useState('')
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null)

  if (!result) return (
    <div className="page narrow">
      <Header eyebrow="RESULTADOS" title="Todavía no hay una transcripción abierta" subtitle="Procesá una grabación o elegí una reunión del historial." />
      <button className="btn primary" onClick={onOpenHistory}><Archive size={18} />Abrir historial</button>
    </div>
  )

  const segments = Array.isArray(result.segments) ? result.segments : []
  const hasVisual = Boolean(result.visual_timeline && result.visual_timeline.trim())
  const distinctSpeakers = Array.from(new Set(segments.map(s => s.speaker).filter(Boolean) as string[]))

  const handleOpenSpeakerModal = (speaker: string, index: number | null) => {
    setActiveSpeaker(speaker || 'Micrófono')
    setActiveSegmentIndex(index)
    setModalOpen(true)
  }

  const handleRenameGlobal = async (newName: string) => {
    try {
      const updated = await call('rename_speaker', activeSpeaker, newName, null)
      if (updated && onUpdateResult) onUpdateResult(updated)
      if (notify) notify(`Hablante "${activeSpeaker}" renombrado a "${newName}" en toda la reunión.`)
    } catch (e: any) {
      if (notify) notify(e.message || 'No se pudo renombrar el hablante')
    }
  }

  const handleReassignSegment = async (targetName: string) => {
    try {
      const updated = await call('rename_speaker', activeSpeaker, targetName, activeSegmentIndex)
      if (updated && onUpdateResult) onUpdateResult(updated)
      if (notify) notify(`Párrafo reasignado a "${targetName}".`)
    } catch (e: any) {
      if (notify) notify(e.message || 'No se pudo reasignar el párrafo')
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">RESULTADO</div>
          <h1>{result.title || result.source?.name}</h1>
          <p>{result.engine} · {result.language}</p>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={onOpenHistory}><Archive size={17} />Historial</button>
          <button className="btn primary" onClick={onExport}><FolderOpen size={17} />Exportar todo</button>
        </div>
      </div>

      {result.notes && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 10,
          backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
          color: '#1e40af', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10
        }}>
          <Sparkles size={16} color="#2563eb" style={{ flexShrink: 0 }} />
          <span>{result.notes}</span>
        </div>
      )}

      <div className="result-grid">
        <div className="result-pane">
          <div className="section-title"><Mic2 size={18} /><h2>Transcripción</h2></div>
          <div style={{ maxHeight: 520, overflowY: 'auto', paddingRight: 4 }}>
            {segments.map((s, i) => (
              <div className="line" key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <time style={{ minWidth: 60, color: '#2563eb', fontFamily: 'monospace', fontWeight: 600, fontSize: 13, paddingTop: 2 }}>
                  [{formatTime(s.start)}]
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
                      border: '1px solid #bfdbfe',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <User size={12} />
                    {s.speaker || 'Hablante'}
                    <Edit3 size={10} style={{ opacity: 0.6 }} />
                  </button>
                  <span style={{ fontSize: '14.5px', color: '#1e293b', lineHeight: 1.55 }}>{s.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="result-pane">
          {hasVisual ? (
            <>
              <div className="tabs">
                <button className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>Resumen</button>
                <button className={tab === 'analysis' ? 'active' : ''} onClick={() => setTab('analysis')}>Cronología visual del video</button>
              </div>
              <div className="markdown" style={{ marginTop: 20 }}>
                {tab === 'summary' ? <PrettyText text={result.summary || 'Todavía no se generó un resumen.'} /> : <PrettyText text={result.visual_timeline || 'No hay análisis visual disponible.'} />}
              </div>
            </>
          ) : (
            <>
              <div className="section-title"><Sparkles size={18} /><h2>Resumen y análisis</h2></div>
              <div className="markdown" style={{ marginTop: 20 }}>
                <PrettyText text={result.summary || 'Todavía no se generó un resumen.'} />
              </div>
            </>
          )}
        </div>
      </div>

      <SpeakerModal
        isOpen={modalOpen}
        currentSpeaker={activeSpeaker}
        segmentIndex={activeSegmentIndex}
        existingSpeakers={distinctSpeakers}
        onRenameGlobal={handleRenameGlobal}
        onReassignSegment={handleReassignSegment}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}

function AiPage({boot,notify,refresh}:{boot:Bootstrap,notify:(s:string)=>void,refresh:()=>void}){const [template,setTemplate]=useState(String(boot.settings.summary_template||boot.templates[0]));const [context,setContext]=useState(String(boot.settings.ai_context||''));return <div className="page narrow"><Header eyebrow="PERSONALIZACIÓN" title="IA y plantillas" subtitle="Enseñale el contexto de tu trabajo sin entrenar ni modificar modelos."/><div className="grid-2"><div className="card card-pad"><div className="section-title"><Sparkles size={19}/><h2>Tipo de informe</h2></div><div className="field"><label>Plantilla</label><select value={template} onChange={e=>setTemplate(e.target.value)}>{boot.templates.map(x=><option key={x}>{x}</option>)}</select></div><p className="small">La estructura se aplica al próximo resumen y al documento Word.</p></div><div className="card card-pad"><div className="section-title"><Database size={19}/><h2>Memoria de contexto</h2></div><div className="field"><label>Nombres, siglas, productos y correcciones frecuentes</label><textarea rows={8} value={context} onChange={e=>setContext(e.target.value)} placeholder="Ej.: Proyecto Andina; Dra. Álvarez; KPI significa…"/></div><button className="btn primary" onClick={async()=>{await call('save_ai_settings',{template,context});notify('Personalización guardada');refresh()}}>Guardar cambios</button></div></div></div>}

function ConnectionsPage({boot,notify,refresh}:{boot:Bootstrap,notify:(s:string)=>void,refresh:()=>void}){
  const [provider,setProvider]=useState(String(boot.settings.analysis_provider||'ollama'))
  const [key,setKey]=useState('')
  const [url,setUrl]=useState(String(boot.settings.ollama_url||'http://localhost:11434'))
  const [model,setModel]=useState('')
  const [testing,setTesting]=useState(false)
  const [showKey,setShowKey]=useState(false)
  const models=boot.provider_models?.[provider]||[]
  const isHuggingFace=provider==='huggingface'
  const configured=Boolean(boot.provider_configured?.[provider])
  useEffect(()=>{
    const selected=boot.provider_selected_models?.[provider]||''
    setKey('')
    setModel(models.includes(selected)?selected:(models[0]||''))
    setUrl(String(boot.settings[provider==='custom'?'custom_api_url':'ollama_url']||'http://localhost:11434'))
  },[provider,boot.provider_configured,boot.provider_models,boot.provider_selected_models,boot.settings])
  const openProvider=async(p:string)=>{const link=providerLinks[p];if(link){await call('open_external_url',link);notify(`Se abrió la página oficial de ${providerName[p]||p}`)}}
  const test=async()=>{setTesting(true);try{const r=await call('test_connection',{provider,key,url,model});setKey('');setModel(r.model||r.models?.[0]||'');notify(r.message);await refresh()}catch(e:any){notify(e.message||'No se pudo probar la conexión')}finally{setTesting(false)}}
  return <div className="page narrow"><Header eyebrow="CONEXIONES" title="Conectá una IA sin programar" subtitle="Elegí un proveedor, pegá la clave y probá la conexión. Los modelos aparecen del mejor al más básico."/><div className="grid-2"><div className="card card-pad"><div className="section-title"><Bot size={19}/><h2>Proveedor de análisis y hablantes</h2></div>{boot.providers.map(p=><div className="provider-card" key={p} style={{border:p===provider?'1px solid #93c5fd':'1px solid #e2e8f0',borderRadius:12,marginBottom:9,cursor:'pointer',background:p===provider?'#eff6ff':'white'}} onClick={()=>setProvider(p)}><div className="provider-logo">{p[0].toUpperCase()}</div><div style={{flex:1}}><b>{providerName[p]||p}</b><div className="small muted">{p==='ollama'?'Gratis y privado en este equipo':p==='huggingface'?'Token para identificar voces localmente':'Servicio externo configurable'}</div><button className="provider-link" onClick={e=>{e.stopPropagation();void openProvider(p)}}><ExternalLink size={13}/>{p==='huggingface'?'Crear token':'Conseguir API / abrir página'}</button></div>{p===provider&&<CheckCircle2 color="#2563eb" size={19}/>}</div>)}</div><div className="card card-pad"><div className="section-title"><SlidersHorizontal size={19}/><h2>{isHuggingFace?'Identificación de hablantes':'Configuración'}</h2></div>{provider!=='ollama'&&<div className="field"><label>{isHuggingFace?'Token de Hugging Face':'Clave API'}</label><div style={{display:'flex',gap:8}}><input type={showKey?'text':'password'} value={key} onChange={e=>setKey(e.target.value)} placeholder={configured?'Clave guardada · pegá una nueva sólo para reemplazarla':'Pegá tu clave personal'}/><button className="btn ghost compact" type="button" onClick={()=>setShowKey(value=>!value)}>{showKey?'Ocultar':'Mostrar'}</button></div><span className="small muted">{configured?'Hay una clave guardada de forma segura en Windows. Nunca se devuelve ni se carga en esta pantalla.':'La clave se guarda únicamente en el Administrador de credenciales de Windows.'}</span></div>}{(provider==='ollama'||provider==='custom')&&<div className="field"><label>Dirección del servidor</label><input value={url} onChange={e=>setUrl(e.target.value)}/></div>}{isHuggingFace?<div className={`notice ${boot.diarization?.ready?'':'warning'}`}><b>{boot.diarization?.ready?'Hablantes listos':'Antes de activar hablantes'}</b><p className="small" style={{margin:'7px 0'}}>{boot.diarization?.reason||'Guardá y probá un token de lectura para Community-1.'}</p><button className="btn ghost compact" onClick={()=>void call('open_external_url','https://huggingface.co/pyannote/speaker-diarization-community-1')}>Aceptar condiciones de Community-1</button></div>:<div className="field"><label>Modelo</label><select value={model} disabled={!models.length} onChange={e=>setModel(e.target.value)}>{models.length?models.map(item=><option key={item}>{item}</option>):<option>Probá la conexión para cargar modelos</option>}</select></div>}<button className="btn primary" disabled={testing} onClick={test}>{testing?<RefreshCw size={17}/>:<CheckCircle2 size={17}/>}Guardar y probar</button><div className="notice" style={{marginTop:16}}>{isHuggingFace?'La identificación de hablantes se ejecuta en este equipo. Community-1 se descarga una vez después de que aceptes sus condiciones.':'Cada proveedor conserva su propia clave y su lista de modelos. Al cambiar de proveedor nunca se reutiliza un modelo de otro.'}</div></div></div></div>
}

function SettingsPage({boot,notify,refresh,release,updateProgress,updateMessage,updatePath,onRelease,onDownload}:{boot:Bootstrap,notify:(s:string)=>void,refresh:()=>void,release:UpdateRelease|null,updateProgress:number,updateMessage:string,updatePath:string,onRelease:(r:UpdateRelease|null)=>void,onDownload:(r:UpdateRelease)=>Promise<void>}){
  const [tab,setTab]=useState<'general'|'recordings'|'summary'>('general')
  const chooseFolder=async()=>{const x=await call('choose_folder',boot.export_folder);if(x)notify(`Carpeta seleccionada: ${x}`)}
  return <div className="page narrow"><Header eyebrow="AJUSTES" title="Privacidad y almacenamiento" subtitle="Configurá la carpeta de resultados y las preferencias de tus reuniones."/><div className="tabs"><button className={tab==='general'?'active':''} onClick={()=>setTab('general')}><SlidersHorizontal size={15}/> General</button><button className={tab==='recordings'?'active':''} onClick={()=>setTab('recordings')}><Mic2 size={15}/> Grabaciones</button><button className={tab==='summary'?'active':''} onClick={()=>setTab('summary')}><Sparkles size={15}/> Resumen</button></div>
  {tab==='general'&&<><div className="card card-pad" style={{marginTop:20}}><div className="section-title"><FolderOpen size={20}/><h2>Ubicación de resultados</h2></div><p>Informes Word, transcripciones, subtítulos y proyectos.</p><div className="notice">{boot.export_folder||'Todavía no se eligió una carpeta.'}</div><button className="btn ghost" style={{marginTop:13}} onClick={chooseFolder}><FolderOpen size={17}/>Elegir carpeta</button></div><div className="grid-2" style={{marginTop:16}}><div className="card card-pad"><div className="section-title"><CheckCircle2 color="#16a36a"/><h2>Privacidad local</h2></div><p>Whisper procesa el audio en tu equipo. Sólo se comparte contenido si elegís voluntariamente un proveedor de nube.</p></div><div className="card card-pad"><div className="section-title"><Info color="#2563eb"/><h2>Modelos incluidos</h2></div><p>Medium, small, base y tiny están dentro del portable y no se descargan al seleccionarlos.</p></div></div></>}
  {tab==='recordings'&&<div className="card card-pad" style={{marginTop:20}}><div className="section-title"><Mic2 size={20}/><h2>Grabaciones</h2></div><p>Las grabaciones en vivo se guardan como WAV junto con la transcripción y el informe Word.</p><div className="notice">Carpeta actual: {boot.export_folder||'No configurada'}</div><button className="btn ghost" style={{marginTop:13}} onClick={chooseFolder}><FolderOpen size={17}/>Cambiar carpeta</button><p className="small" style={{marginTop:18}}>El micrófono y el audio del escritorio se seleccionan desde <b>En vivo → Dispositivo</b>. Los dispositivos duplicados de Windows se consolidan automáticamente.</p></div>}
  {tab==='summary'&&<div className="card card-pad" style={{marginTop:20}}><div className="section-title"><Sparkles size={20}/><h2>Resumen y análisis</h2></div><p>Elegí el proveedor, el modelo y la plantilla desde <b>Conexiones</b> e <b>IA y plantillas</b>. Los resultados se exportan en un documento Word con formato profesional.</p><div className="notice">Proveedor actual: {providerName[String(boot.settings.analysis_provider||'ninguno')]||'Ninguno (sólo transcripción)'}</div></div>}</div>}

function humanBytes(value=0){if(!value)return 'Tamaño no informado';const units=['B','KB','MB','GB'];let n=value,i=0;while(n>=1024&&i<units.length-1){n/=1024;i++}return `${n.toFixed(i>1?2:0)} ${units[i]}`}

function Modal({title,close,children}:{title:string,close:()=>void,children:any}){return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={close}><X size={20}/></button></div>{children}</div></div>}

export default App
