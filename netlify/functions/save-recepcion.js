// netlify/functions/save-recepcion.js
// Llama a la función RPC public.ideascan_save_recepcion en Supabase.
// Usa la service role key (server-side). No requiere exponer el schema ideascan.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: "SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados en Netlify." }) };
  }

  let body;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : (event.body || "{}");
    body = JSON.parse(raw);
  } catch (_) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Body inválido" }) };
  }

  const { folio, tipo, rows } = body;

  try {
    // Llama a public.ideascan_save_recepcion(p_folio, p_tipo, p_rows)
    // La función SQL inserta en ideascan.recepciones y ideascan.renglones_recepcion
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ideascan_save_recepcion`, {
      method: "POST",
      headers: {
        apikey:        SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_folio: folio, p_tipo: tipo, p_rows: rows }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      throw new Error(data.message || data.hint || data.error || "Error " + resp.status);
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ folio }) };

  } catch (e) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: e.message }) };
  }
};
