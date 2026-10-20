import React, { useState } from 'react'
import { X, Star, Send, CheckCircle2, AlertCircle, Mail, MessageSquare } from 'lucide-react'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState('feedback')
  const [rating, setRating] = useState(5)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !message) {
      setErrorMsg('Por favor completá tu correo y un mensaje breve.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      // Intento de envío directo a franarteta23@gmail.com vía FormSubmit AJAX
      const res = await fetch('https://formsubmit.co/ajax/franarteta23@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          _subject: `[Transcripto Showcase] Feedback de ${name || 'Usuario'} (${category})`,
          nombre: name || 'Anónimo',
          email: email,
          categoria: category,
          calificacion: `${rating} / 5 estrellas`,
          mensaje: message,
          _captcha: 'false'
        })
      })

      if (res.ok) {
        setSubmitted(true)
      } else {
        throw new Error('Error al enviar mediante el servidor.')
      }
    } catch (err) {
      console.warn('FormSubmit falló o fue bloqueado, abriendo cliente de correo mailto fallback...', err)
      // Fallback transparente a mailto
      const mailtoUrl = `mailto:franarteta23@gmail.com?subject=${encodeURIComponent(
        `[Transcripto Demo] ${category}: ${name || 'Contacto'}`
      )}&body=${encodeURIComponent(
        `Nombre: ${name}\nEmail: ${email}\nCalificación: ${rating}/5\nCategoría: ${category}\n\nMensaje:\n${message}`
      )}`
      window.location.href = mailtoUrl
      setSubmitted(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setName('')
    setEmail('')
    setCategory('feedback')
    setRating(5)
    setMessage('')
    setSubmitted(false)
    setErrorMsg('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Feedback y Contacto</h3>
              <p className="text-xs text-slate-500">Llega directamente a franarteta23@gmail.com</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-bold text-slate-900">¡Mensaje Enviado con Éxito!</h4>
            <p className="text-sm text-slate-600">
              Muchas gracias por tomarte el tiempo de probar la demo y compartir tu opinión. Franco revisará tu mensaje a la brevedad.
            </p>
            <div className="pt-2">
              <button
                onClick={handleReset}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-medium text-sm hover:bg-slate-800 transition"
              >
                Cerrar ventana
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Calificación */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                ¿Qué te pareció la aplicación y la demo?
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 text-slate-300 hover:text-amber-400 transition"
                  >
                    <Star
                      className={`w-6 h-6 transition ${
                        star <= rating ? 'fill-amber-400 text-amber-400 scale-105' : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-semibold text-slate-500 ml-2">
                  {rating === 5 ? '¡Excelente!' : rating === 4 ? 'Muy buena' : rating === 3 ? 'Buena' : 'Por mejorar'}
                </span>
              </div>
            </div>

            {/* Nombre y Correo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tu Nombre
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Franco, María, etc."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tu Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@empresa.com"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
            </div>

            {/* Categoría */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo del contacto
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              >
                <option value="Propuesta laboral / Contratación">💼 Propuesta laboral / Entrevista</option>
                <option value="Feedback general">💡 Feedback general sobre el proyecto</option>
                <option value="Sugerencia de nueva función">🚀 Sugerencia de nueva función</option>
                <option value="Otro asunto">✉️ Otro asunto</option>
              </select>
            </div>

            {/* Mensaje */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Comentarios o Propuesta <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Contame qué te gustó, qué sumarías o cualquier consulta técnica..."
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none"
              ></textarea>
            </div>

            {/* Footer con botones */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar a Franco</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
