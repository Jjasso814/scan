// netlify/functions/save-recepcion.js
// Guarda una recepción en Supabase usando la service role key (server-side).
// Evita exponer claves y restricciones de schema en el cliente.

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function sbHeaders() {
  return {
    apikey:            SERVICE_KEY,
    Authorization:     `Bearer ${SERVICE_KEY}`,
    "Content-Type":    "application/json",
    "Content-Profile": "ideascan",
    "Accept-Profile":  "ideascan",
    Prefer:            "return=representation",
  };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: "Supabase no configurado en el servidor. Agrega SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Netlify." }) };
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
    // 1 — Insertar encabezado de recepción
    const primera   = rows[0] || {};
    const totalBultos = rows.reduce((s, r) => s + (Number(r.bultos) || 0), 0);

    const recResp = await fetch(`${SUPABASE_URL}/rest/v1/recepciones`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({
        folio,
        tipo,
        estado:          "confirmado",
        vendor:          primera.proveedor     || null,
        carrier:         primera.transportista || null,
        tracking_number: primera.tracking      || null,
        total_bultos:    totalBultos,
        tipo_bulto:      primera.tipo_bulto    || null,
        observaciones:   primera.observaciones || null,
        operador_nombre: "IDEAScan",
      }),
    });

    if (!recResp.ok) {
      const err = await recResp.json().catch(() => ({}));
      throw new Error("Error al guardar recepción: " + (err.message || err.hint || recResp.status));
    }

    const [recepcion] = await recResp.json();

    // 2 — Insertar renglones
    const renglones = rows.map((r, i) => ({
      recepcion_id:       recepcion.id,
      folio,
      bulto_num:          r._bulto || (i + 1),
      po:                 r.po               || null,
      pn:                 r.no_parte         || null,
      descripcion:        r.descripcion      || null,
      descripcion_en:     r.descripcion_ingles || null,
      origen:             r.origen           || null,
      cantidad:           Number(r.cantidad) || null,
      um:                 r.um               || null,
      weight_lbs:         Number(r.peso_lbs) || null,
      weight_kgs:         Number(r.peso_kgs) || null,
      tracking_number:    r.tracking         || null,
      vendor:             r.proveedor        || null,
      referencia:         r.referencia       || null,
      serie:              r.serie            || null,
      marca:              r.marca            || null,
      modelo:             r.modelo           || null,
      valor:              Number(r.valor)    || null,
      fraccion_aduanal:   r.fraccion         || null,
      observacion_bulto:  r.observaciones    || null,
      pn_normalizado:     r.pn_normalizado   || null,
      description_source: r.description_source || null,
      confidence_score:   r.confidence_score   ?? null,
      is_new_part_number: r.is_new_part_number ?? true,
    }));

    const rengResp = await fetch(`${SUPABASE_URL}/rest/v1/renglones_recepcion`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify(renglones),
    });

    if (!rengResp.ok) {
      const err = await rengResp.json().catch(() => ({}));
      throw new Error("Error al guardar líneas: " + (err.message || err.hint || rengResp.status));
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ folio }) };

  } catch (e) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: e.message }) };
  }
};
