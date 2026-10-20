# 🚀 Guía de Despliegue: Demo Web Interactiva de Transcripto

Esta carpeta (`demo_showcase/`) es un proyecto web **100% independiente y desacoplado** de la aplicación de escritorio nativa de Transcripto. 

No requiere Python, ni FFmpeg, ni modelos Whisper descargados: funciona con **React 18**, **TypeScript**, **Tailwind CSS 4** y **Vite**, simulando de forma realista el flujo acústico en tiempo real, la importación de videos/audio, la edición interactiva de hablantes y la descarga de informes Microsoft Word `.docx`.

---

## ⚡ 1. Prueba Local Inmediata

Podés probar la demo en tu máquina en menos de 1 minuto:

```powershell
# 1. Navegar a la carpeta de la demo
cd demo_showcase

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor local de desarrollo
npm run dev
```

Abre tu navegador en `http://localhost:5173` para interactuar con la demo.

---

## 🌐 2. Despliegue en Vercel (Recomendado - 2 minutos)

Vercel ofrece hosting gratuito con certificados SSL automáticos y CDN global ultrarrápida.

### Método A: Mediante la CLI de Vercel (El más rápido)
```powershell
cd demo_showcase
npx vercel
```
- Sigue las 3 preguntas automáticas en la consola.
- Para publicar a producción definitiva:
  ```powershell
  npx vercel --prod
  ```
- ¡Listo! Vercel te entregará una URL pública (ejemplo: `https://transcripto-showcase.vercel.app`).

### Método B: Desde el Dashboard Web de Vercel
1. Ingresá a [vercel.com](https://vercel.com) e iniciá sesión con GitHub.
2. Hacé clic en **"Add New Project"**.
3. Si creaste un repositorio público para la demo (ver Sección 3), seleccionalo.
4. El framework se detectará automáticamente como **Vite** (con build command `npm run build` y output `dist`).
5. Hacé clic en **"Deploy"**.

---

## 🐙 3. Publicar en GitHub y Activar GitHub Pages

Como el repositorio principal de Transcripto es privado, podés crear un repositorio público exclusivo para la demo (por ejemplo `transcripto-showcase`):

### Paso 1: Inicializar el nuevo repositorio público
```powershell
cd demo_showcase
git init
git checkout -b main
git add .
git commit -m "feat: initial release of transcripto interactive showcase"
```

### Paso 2: Conectar con tu cuenta de GitHub
Creá un repositorio público en [github.com/new](https://github.com/new) con el nombre `transcripto-showcase`, y luego ejecutá:

```powershell
git remote add origin https://github.com/TU_USUARIO/transcripto-showcase.git
git push -u origin main
```

### Paso 3: Activar GitHub Pages (Opcional si no usas Vercel)
Podés desplegar la carpeta compilada (`dist`) a la rama `gh-pages`:

```powershell
npm run build
npx gh-pages -d dist
```

En la configuración del repositorio (**Settings -> Pages**), seleccioná la rama `gh-pages` y tu demo estará disponible en:
`https://TU_USUARIO.github.io/transcripto-showcase/`

---

## ✉️ 4. Formulario de Feedback y Contacto

El modal de Feedback integrado en la demo está preconfigurado para enviar las valoraciones, propuestas laborales y sugerencias directamente a:
👉 **`franarteta23@gmail.com`**

- Envía vía AJAX JSON a través de FormSubmit sin necesidad de backend propio ni credenciales expuestas.
- Si el visitante utiliza un bloqueador de anuncios estricto, cuenta con un fallback automático y elegante mediante el cliente de correo (`mailto:`).

---

## 📄 5. Archivo Word (`.docx`) de Muestra

La demo incluye en `public/informe_muestra_transcripto.docx` un documento Word real precompilado con:
- Portada corporativa con fecha y participantes detectados.
- Resumen ejecutivo de la reunión técnica.
- Matriz de acuerdos, responsables y estados.
- Transcripción completa con marcas de tiempo.

Al hacer clic en **"Descargar Word (.docx)"** en la barra superior o en la vista de Resultados, el navegador descarga directamente el archivo real para que reclutadores o colegas puedan ver la calidad final del producto.
