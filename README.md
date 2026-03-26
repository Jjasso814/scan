# MARTECH Inspector

Aplicación para extracción automática de datos logísticos usando IA.

---

## ¿Qué necesitas para instalar esto?

- Una cuenta en [GitHub](https://github.com) (gratis)
- Una cuenta en [Vercel](https://vercel.com) (gratis)
- Una API Key de Anthropic — se obtiene en [console.anthropic.com](https://console.anthropic.com)

---

## Pasos para publicar

### 1. Subir el proyecto a GitHub
1. Crea un repositorio nuevo en GitHub (puede ser privado)
2. Sube todos estos archivos al repositorio

### 2. Conectar con Vercel
1. Entra a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub
2. Haz clic en **"Add New Project"**
3. Selecciona el repositorio `martech-inspector`
4. Vercel detecta automáticamente que es un proyecto Vite/React

### 3. Configurar la API Key (MUY IMPORTANTE)
Antes de hacer deploy, en Vercel ve a:
**Settings → Environment Variables** y agrega:

| Variable | Valor |
|---|---|
| `VITE_ANTHROPIC_API_KEY` | `sk-ant-tu-api-key-aqui` |

⚠️ **Nunca subas el archivo `.env` a GitHub.** El `.gitignore` ya lo excluye.

### 4. Deploy
Haz clic en **Deploy**. En 2-3 minutos tendrás una URL pública lista para usar.

---

## Estructura del proyecto

```
martech-inspector/
├── index.html          ← Página principal
├── package.json        ← Dependencias
├── vite.config.js      ← Configuración
├── .env.example        ← Ejemplo de variables (no subir .env real)
├── .gitignore
└── src/
    ├── main.jsx        ← Punto de entrada
    └── App.jsx         ← Toda la lógica de la aplicación
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
