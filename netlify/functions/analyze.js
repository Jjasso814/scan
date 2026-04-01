// netlify/functions/analyze.js — Proxy seguro hacia Anthropic Claude
// Netlify Functions: handler recibe (event, context) y retorna { statusCode, headers, body }

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  // Autenticación básica
  const appPassword = process.env.APP_PASSWORD;
  if (appPassword) {
    const authHeader = event.headers["authorization"] || "";
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme !== "Basic" || !encoded) {
      return {
        statusCode: 401,
        headers: { ...CORS_HEADERS, "WWW-Authenticate": 'Basic realm="IDEAScan"' },
        body: JSON.stringify({ error: "Se requiere autenticación" }),
      };
    }
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const [, password] = decoded.split(":");
    if (password !== appPassword) {
      return {
        statusCode: 401,
        headers: { ...CORS_HEADERS, "WWW-Authenticate": 'Basic realm="IDEAScan"' },
        body: JSON.stringify({ error: "Contraseña incorrecta" }),
      };
    }
  }

  // API Key de Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY no configurada en Netlify → Site configuration → Environment variables" }),
    };
  }

  // Parsear body — Netlify puede base64-encodificar el body cuando es grande (imágenes)
  let body;
  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : (event.body || "{}");
    body = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Body no es JSON válido" }) };
  }

  const { system, images, text } = body;
  if (!system || !Array.isArray(images) || !text) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Body inválido. Se requieren: system (string), images (array), text (string)" }),
    };
  }
  if (images.length === 0) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Debes enviar al menos una imagen" }) };
  }

  // Llamada a Anthropic
  try {
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        temperature: 0,
        system,
        messages: [{ role: "user", content: [...images, { type: "text", text }] }],
      }),
    });

    if (!anthropicResponse.ok) {
      let errBody = {};
      try { errBody = await anthropicResponse.json(); } catch (_) {}
      const statusCode = anthropicResponse.status;
      let userMessage = `Error de Anthropic (${statusCode})`;
      if (statusCode === 401) userMessage = "API Key inválida o expirada. Revisa ANTHROPIC_API_KEY en Netlify.";
      else if (statusCode === 400) userMessage = "Solicitud inválida a Anthropic: " + (errBody?.error?.message || "formato incorrecto");
      else if (statusCode === 429) userMessage = "Límite de velocidad de Anthropic alcanzado. Espera unos segundos y reintenta.";
      else if (statusCode === 529) userMessage = "Anthropic está sobrecargado. Reintenta en un momento.";
      else if (errBody?.error?.message) userMessage = errBody.error.message;
      return { statusCode, headers: CORS_HEADERS, body: JSON.stringify({ error: userMessage, details: errBody }) };
    }

    const data = await anthropicResponse.json();
    if (!data?.content?.[0]?.text) {
      return {
        statusCode: 502,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Anthropic respondió con un formato inesperado. Intenta de nuevo.", raw: data }),
      };
    }

    return { statusCode: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" }, body: JSON.stringify(data) };

  } catch (error) {
    console.error("analyze handler error:", error);
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return { statusCode: 503, headers: CORS_HEADERS, body: JSON.stringify({ error: "No se pudo conectar con la API de Anthropic." }) };
    }
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message || "Error interno del servidor" }) };
  }
};
