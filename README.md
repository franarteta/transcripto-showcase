# 🎙️ Transcripto — Interactive Web Showcase & Architecture Demo

[![React](https://img.shields.io/badge/React-18.3.1-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)](https://transcripto-showcase.vercel.app)
[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Active-22c55e?logo=github)](https://franarteta.github.io/transcripto-showcase/)
[![Author](https://img.shields.io/badge/Author-Franco_Arteta-0A66C2?logo=linkedin)](https://www.linkedin.com/in/franarteta/)

Demo web interactiva y autocontenida que replica con una **fidelidad del 100%** las interfaces de usuario, el flujo acústico y las capacidades de procesamiento con inteligencia artificial de **Transcripto Pro (Desktop)** y **Transcripto Lite**.

---

## 🌐 Enlaces a la Demo en Vivo

Podés interactuar con la aplicación directamente desde tu navegador en cualquiera de las dos plataformas:

- 🚀 **Despliegue en Vercel (Recomendado)**: [https://transcripto-showcase.vercel.app](https://transcripto-showcase.vercel.app)
- 🐙 **Despliegue en GitHub Pages**: [https://franarteta.github.io/transcripto-showcase/](https://franarteta.github.io/transcripto-showcase/)

> [!NOTE]
> Ambas demos son **100% públicas y abiertas**. No requieren registrarse ni iniciar sesión.

---

## 💡 ¿Qué es Transcripto?

**Transcripto** es una suite de escritorio nativa para Windows desarrollada para profesionales, directores de proyecto y equipos de ingeniería, orientada a transcribir y sintetizar reuniones técnicas, videollamadas y archivos multimedia con privacidad, baja latencia y alta precisión acústica.

### Características Principales Representadas en la Demo:
1. **Captura Multi-Canal Nativa (WASAPI Loopback + Micrófono)**:
   - Aislamiento acústico de dos canales en simultáneo: la voz del usuario (micrófono) a la izquierda y el audio de la videollamada (Zoom, Teams, Meet) a la derecha, con vúmetros estéreo independientes y detección de hablantes.
2. **Inferencia Ultrarrápida a 20x Tiempo Real (Groq Cloud + Whisper Large v3)**:
   - Procesamiento de audio a velocidades de hasta 20x en la nube de ultra baja latencia con Groq (LPU).
3. **Resiliencia y Auto-Failover ante Límites de Cuota (Groq 429 ➔ Gemini 2.5 Flash)**:
   - Conmutación automática y transparente en menos de 200 milisegundos hacia Google Gemini 2.5 Flash en caso de saturación de cuota de API (Rate Limit 429).
4. **Ingesta Web Directa sin Descarga Pesada de Video**:
   - Extracción y normalización de la pista de audio (16 kHz WAV mono) directamente desde enlaces de **YouTube, Google Drive, Zoom Cloud y Dropbox**.
5. **Informes Ejecutivos Formales en Microsoft Word (`.docx`)**:
   - Generación de informes corporativos con portada formal, lista de participantes, índice temático, matriz de acuerdos con responsables y transcripción cronológica completa (disponible para descargar en la demo).
6. **Transcripto Lite**:
   - Edición complementaria ultra-liviana y minimalista para notas de voz rápidas, transcripciones de un clic y soporte dual de importación.

---

## 🛠️ Stack Tecnológico de la Demo

- **Frontend Core**: React 18 (Strict Mode), TypeScript 5.5, JSX
- **Estilos**: Tailwind CSS 4, CSS Grid, Flexbox, variables CSS nativas
- **Iconografía**: Lucide React
- **Compilador & Bundler**: Vite 8 con compresión gzip/brotli
- **Emulador IPC**: Mock Bridge con emulación de `window.pywebview.api` y despacho de eventos asíncronos (`transcriptoEvent`, `transcriptoLiteEvent`)
- **Renderizado Markdown**: `PrettyText.tsx` (parseo en tiempo real de títulos, negritas, citas, listas y tablas HTML estructuradas)

---

## 💻 Ejecución Local

Para correr este proyecto en tu entorno de desarrollo:

```powershell
# 1. Clonar el repositorio
git clone https://github.com/franarteta/transcripto-showcase.git
cd transcripto-showcase

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor local de Vite
npm run dev
```

Abre tu navegador en `http://localhost:5173`.

---

## 🚀 Despliegue en Producción

### Desplegar en Vercel
```powershell
npx vercel --prod
```

### Desplegar en GitHub Pages
El proyecto incluye un flujo de trabajo automatizado en `.github/workflows/deploy.yml`. Cada commit enviado a la rama `main` compilará y publicará automáticamente los cambios en GitHub Pages.

---

## 📬 Contacto y Feedback

Desarrollado por **Franco Arteta**:
- **LinkedIn**: [linkedin.com/in/franarteta](https://www.linkedin.com/in/franarteta/)
- **Email directo de contacto**: [franarteta23@gmail.com](mailto:franarteta23@gmail.com)
