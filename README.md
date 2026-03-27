# IDEAScan — Inspección de Material Inteligente

Aplicación para extracción automática de datos logísticos usando IA (Anthropic Claude).

---

## ¿Qué necesitas para instalar esto?

- Una cuenta en [GitHub](https://github.com) (gratis)
- Una cuenta en [Vercel](https://vercel.com) (gratis)
- Una API Key de Anthropic — se obtiene en [console.anthropic.com](https://console.anthropic.com)
- Cuenta en [EmailJS](https://emailjs.com) para el envío de correos (gratis)

---

## Pasos para publicar

### 1. Subir el proyecto a GitHub
1. Crea un repositorio nuevo en GitHub (puede ser privado)
2. Sube todos estos archivos al repositorio

### 2. Conectar con Vercel
1. Entra a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub
2. Haz clic en **"Add New Project"**
3. Selecciona el repositorio
4. Vercel detecta automáticamente que es un proyecto Vite/React

### 3. Configurar Variables de Entorno (MUY IMPORTANTE)
Antes de hacer deploy, en Vercel ve a:
**Settings → Environment Variables** y agrega las siguientes variables:

| Variable | Descripción | Requerida |
|---|---|---|
| `ANTHROPIC_API_KEY` | Tu API Key de Anthropic (`sk-ant-...`). **Sin prefijo VITE_** — es variable de servidor | ✅ |
| `APP_PASSWORD` | Contraseña de acceso a la app. Si no se configura, la app es pública | ⚠️ |
| `VITE_EMAILJS_SERVICE_ID` | ID del servicio en EmailJS | ✅ |
| `VITE_EMAILJS_TEMPLATE_ID` | ID del template en EmailJS | ✅ |
| `VITE_EMAILJS_PUBLIC_KEY` | Public Key de tu cuenta EmailJS | ✅ |
| `VITE_FIXED_EMAIL` | Correo destino fijo para envíos. Default: `juan.jasso@groupcca.com` | Opcional |
| `VITE_REQUIRE_AUTH` | Si está definida (cualquier valor), activa la pantalla de login | Opcional |
| `ALLOWED_ORIGIN` | Origen permitido para CORS en el serverless. Default: `*` | Opcional |

> ⚠️ `ANTHROPIC_API_KEY` **NO lleva el prefijo `VITE_`** — la usa el servidor, no el navegador.
> ⚠️ Para activar la autenticación debes configurar **ambas**: `APP_PASSWORD` y `VITE_REQUIRE_AUTH`.
> ⚠️ Nunca subas el archivo `.env` a GitHub. El `.gitignore` ya lo excluye.

### 4. Deploy
Haz clic en **Deploy**. En 2-3 minutos tendrás una URL pública lista para usar.

---

## Estructura del proyecto

```
scan/
├── api/
│   └── analyze.js              ← Serverless function (proxy seguro a Anthropic)
├── public/
│   └── logo.png                ← Logo de la aplicación
├── src/
│   ├── config/
│   │   ├── constants.js        ← Colores, columnas CSV, variables globales
│   │   └── prompts.js          ← Prompts de IA para Fase 2 y Fase 3
│   ├── utils/
│   │   └── claudeApi.js        ← callClaude, buildRows, buildCSV, helpers
│   ├── components/
│   │   ├── phases/
│   │   │   ├── Phase1.jsx      ← Selección de tipo de material
│   │   │   ├── Phase2.jsx      ← Carga de documentos (Packing List)
│   │   │   ├── Phase3.jsx      ← Verificación por bulto
│   │   │   └── Phase4.jsx      ← Resultado, descarga CSV y correo
│   │   ├── Header.jsx
│   │   ├── LoginScreen.jsx
│   │   ├── ResultTable.jsx
│   │   ├── StepBar.jsx
│   │   └── UI.jsx              ← Card, PrimaryBtn, GhostBtn, DropZone, Thumbs, InfoBadge
│   ├── App.jsx                 ← Orquestador principal (<200 líneas)
│   └── main.jsx
├── index.html
├── package.json
├── vercel.json
└── vite.config.js
```

---

## Cómo usar la aplicación

1. **Fase 1** — Selecciona el tipo de material (Materia Prima o Maquinaria)
2. **Fase 2** — Toma o sube fotos del Packing List y etiqueta del transportista
3. **Fase 3** — Opcional: sube fotos por bulto para verificar cantidades
4. **Fase 4** — Revisa, edita, descarga CSV y envía por correo

---

## Soporte
Cualquier duda contactar al administrador del sistema.
