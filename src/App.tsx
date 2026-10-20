import React, { useState } from 'react'
import { setupMockBridge } from './mockBridge'
import { ShowcaseHeader } from './components/ShowcaseHeader'
import RealApp from './RealApp'
import RealAppLite from './RealAppLite'
import { FeedbackModal } from './components/FeedbackModal'

// Inicializar el puente mock de PyWebView para el navegador
setupMockBridge()

export const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<'desktop' | 'lite'>('desktop')
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#eef2f7] select-none">
      {/* Barra de cabecera con selector Full / Lite, descarga de Word y Feedback */}
      <ShowcaseHeader
        currentMode={currentMode}
        onChangeMode={setCurrentMode}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
      />

      {/* Contenedor principal donde se monta la app real */}
      <div className="flex-1 w-full min-h-0 overflow-hidden relative">
        {currentMode === 'desktop' ? (
          <RealApp key="real-desktop-app" />
        ) : (
          <RealAppLite key="real-lite-app" />
        )}
      </div>

      {/* Modal de Feedback directo a franarteta23@gmail.com */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />
    </div>
  )
}

export default App
