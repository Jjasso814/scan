/**
 * supabaseSave.js — Guarda la recepción en Supabase (schema ideascan).
 * Inserta en: recepciones → renglones_recepcion
 * Si las variables de entorno no están configuradas, lanza error descriptivo.
 */

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

function sbHeaders() {
  return {
    apikey:            SUPABASE_ANON,
    Authorization:     `Bearer ${SUPABASE_ANON}`,
    "Content-Type":    "application/json",
    "Content-Profile": "ideascan",   // schema ideascan (no public)
    "Accept-Profile":  "ideascan",
    Prefer:            "return=representation",
  };
}

/** Genera un folio único basado en tipo + fecha + 4 dígitos aleatorios */
function generateFolio(tipo) {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const r = Math.floor(Math.random() * 9000) + 1000;
  const prefix = tipo === "maquinaria" ? "MAQ" : "MAT";
  return `${prefix}-${d}-${r}`;
}

/**
 * Guarda la sesión de recepción completa en Supabase.
 * @param {Array}  rows  - Filas normalizadas de la tabla
 * @param {string} tipo  - "maquinaria" | "materia_prima"
 * @returns {string} folio generado
 */
export async function saveRecepcion(rows, tipo) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    throw new Error("Supabase no configurado. Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en las variables de entorno de Netlify.");
  }

  const folio       = generateFolio(tipo);
  const primerFila  = rows[0] || {};
  const totalBultos = rows.reduce((s, r) => s + (Number(r.bultos) || 0), 0);

  // 1 — Insertar encabezado de recepción
  const recResp = await fetch(`${SUPABASE_URL}/rest/v1/recepciones`, {
    method:  "POST",
    headers: sbHeaders(),
    body: JSON.stringify({
      folio,
      tipo,
      estado:         "confirmado",
      vendor:         primerFila.proveedor    || null,
      carrier:        primerFila.transportista || null,
      tracking_number: primerFila.tracking    || null,
      total_bultos:   totalBultos,
      tipo_bulto:     primerFila.tipo_bulto   || null,
      observaciones:  primerFila.observaciones || null,
      operador_nombre: "IDEAScan",
    }),
  });

  if (!recResp.ok) {
    const err = await recResp.json().catch(() => ({}));
    throw new Error("Error al guardar recepción: " + (err.message || recResp.status));
  }

  const [recepcion] = await recResp.json();

  // 2 — Insertar renglones
  const renglones = rows.map((r, i) => ({
    recepcion_id:       recepcion.id,
    folio,
    bulto_num:          r._bulto || (i + 1),
    po:                 r.po              || null,
    pn:                 r.no_parte        || null,
    descripcion:        r.descripcion     || null,
    descripcion_en:     r.descripcion_ingles || null,
    origen:             r.origen          || null,
    cantidad:           Number(r.cantidad) || null,
    um:                 r.um              || null,
    weight_lbs:         Number(r.peso_lbs) || null,
    weight_kgs:         Number(r.peso_kgs) || null,
    tracking_number:    r.tracking        || null,
    vendor:             r.proveedor       || null,
    referencia:         r.referencia      || null,
    serie:              r.serie           || null,
    marca:              r.marca           || null,
    modelo:             r.modelo          || null,
    valor:              Number(r.valor)   || null,
    fraccion_aduanal:   r.fraccion        || null,
    observacion_bulto:  r.observaciones   || null,
    pn_normalizado:     r.pn_normalizado  || null,
    description_source: r.description_source || null,
    confidence_score:   r.confidence_score   ?? null,
    is_new_part_number: r.is_new_part_number ?? true,
  }));

  const rengResp = await fetch(`${SUPABASE_URL}/rest/v1/renglones_recepcion`, {
    method:  "POST",
    headers: sbHeaders(),
    body: JSON.stringify(renglones),
  });

  if (!rengResp.ok) {
    const err = await rengResp.json().catch(() => ({}));
    throw new Error("Error al guardar líneas: " + (err.message || rengResp.status));
  }

  return folio;
}
