// api/analyze.js — Serverless proxy seguro hacia Anthropic Claude
// Incluye: CORS, autenticación básica, max_tokens 4096, manejo robusto de errores

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

function setCORSHeaders(res) {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
    // ── CORS preflight ──────────────────────────────────────────────
  setCORSHeaders(res);
    if (req.method === "OPTIONS") {
          return res.status(200).end();
    }

  // ── Solo POST ───────────────────────────────────────────────────
  if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
  }

  // ── Autenticación básica ─────────────────────────────────────────
  const appPassword = process.env.APP_PASSWORD;
    if (appPassword) {
          const authHeader = req.headers["authorization"] || "";
          const [scheme, encoded] = authHeader.split(" ");
          if (scheme !== "Basic" || !encoded) {
                  res.setHeader("WWW-Authenticate", 'Basic realm="IDEAScan"');
                  return res.status(401).json({ error: "Se requiere autenticación" });
          }
          const decoded = Buffer.from(encoded, "base64").toString("utf8");
          const [, password] = decoded.split(":");
          if (password !== appPassword) {
                  res.setHeader("WWW-Authenticate", 'Basic realm="IDEAScan"');
                  return res.status(401).json({ error: "Contraseña incorrecta" });
          }
    }

  // ── API Key de Anthropic ────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
          return res.status(500).json({
                  error: "ANTHROPIC_API_KEY no configurada en Vercel → Settings → Environment Variables",
          });
    }

  // ── Validar body ────────────────────────────────────────────────
  const { system, images, text } = req.body || {};
    if (!system || !Array.isArray(images) || !text) {
          return res.status(400).json({
                  error: "Body inválido. Se requieren: system (string), images (array), text (string)",
          });
    }
    if (images.length === 0) {
          return res.status(400).json({ error: "Debes enviar al menos una imagen" });
    }

  // ── Llamada a Anthropic ─────────────────────────────────────────
  try {
        const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                          "Content-Type": "application/json",
                          "x-api-key": apiKey,
                          "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                          model: "claude-sonnet-4-5",
                          max_tokens: 4096,
                          system,
                          messages: [
                            {
                                          role: "user",
                                          content: [
                                                          ...images,
                                            { type: "text", text },
                                                        ],
                            },
                                    ],
                }),
        });

      // ── Error de Anthropic ──────────────────────────────────────
      if (!anthropicResponse.ok) {
              let errBody = {};
              try { errBody = await anthropicResponse.json(); } catch (_) {}

          const statusCode = anthropicResponse.status;
              let userMessage = `Error de Anthropic (${statusCode})`;

          if (statusCode === 401) userMessage = "API Key inválida o expirada. Revisa ANTHROPIC_API_KEY en Vercel.";
              else if (statusCode === 400) userMessage = "Solicitud inválida a Anthropic: " + (errBody?.error?.message || "formato incorrecto");
              else if (statusCode === 429) userMessage = "Límite de velocidad de Anthropic alcanzado. Espera unos segundos y reintenta.";
              else if (statusCode === 529) userMessage = "Anthropic está sobrecargado. Reintenta en un momento.";
              else if (errBody?.error?.message) userMessage = errBody.error.message;

          return res.status(statusCode).json({ error: userMessage, details: errBody });
      }

      // ── Respuesta exitosa ───────────────────────────────────────
      const data = await anthropicResponse.json();

      // Verificar que la respuesta tiene el formato esperado
      if (!data?.content?.[0]?.text) {
              return res.status(502).json({
                        error: "Anthropic respondió con un formato inesperado. Intenta de nuevo.",
                        raw: data,
              });
      }

      return res.status(200).json(data);

  } catch (error) {
        console.error("analyze handler error:", error);

      // Distinguir errores de red vs errores de código
      if (error.name === "TypeError" && error.message.includes("fetch")) {
              return res.status(503).json({
                        error: "No se pudo conectar con la API de Anthropic. Verifica la conectividad de Vercel.",
              });
      }

      return res.status(500).json({
              error: error.message || "Error interno del servidor",
      });
  }
}
