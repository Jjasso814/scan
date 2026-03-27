import { COL_KEYS, COLUMNS } from "../config/constants";

/** Convierte un File a base64 (solo los datos, sin el prefijo data:...) */
export const toB64 = (f) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

/** Convierte un File a data URL completa (para previsualizaciones) */
export const toUrl = (f) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

/**
 * Llama al proxy serverless /api/analyze que a su vez llama a Anthropic.
 * Requiere que el usuario haya guardado su contraseña en sessionStorage["app_pwd"].
 */
export async function callClaude(system, images, text) {
  const imgs = await Promise.all(
    images.map(async (f) => ({
      type: "image",
      source: { type: "base64", media_type: f.type, data: await toB64(f) },
    }))
  );

  const pwd = sessionStorage.getItem("app_pwd") || "";
  const authHeader = pwd ? "Basic " + btoa("user:" + pwd) : "";

  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({ system, images: imgs, text }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) sessionStorage.removeItem("app_pwd");
    throw new Error(err.error || "Error del servidor: " + res.status);
  }

  const d   = await res.json();
  const raw = d.content?.find((b) => b.type === "text")?.text || "";
  const cleaned = raw.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const m = cleaned.match(/{[\s\S]*}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch (e2) {
        throw new Error("JSON inválido en respuesta de IA.\nDetalle: " + e2.message + "\nRespuesta: " + cleaned.substring(0, 200));
      }
    }
    throw new Error("La IA no devolvió JSON. Asegúrate de que las imágenes sean legibles.\nRespuesta: " + cleaned.substring(0, 200));
  }
}

/** Construye el array de filas de la tabla a partir de la extracción de la IA */
export function buildRows(ext, tipo) {
  const base = {
    entry_no: null, no_inspeccion: null,
    fecha: new Date().toLocaleDateString("es-MX"),
    importador: ext.importador, proveedor: ext.vendor,
    transportista: ext.carrier, trailer: null, referencia: null, po: ext.po,
    peso_lbs: ext.peso_lbs, peso_kgs: ext.peso_kgs,
    tipo_bulto: ext.tipo_bulto, valor: null, origen: ext.origen,
    fraccion: null, locacion: null, tracking: ext.tracking,
    marca: null, modelo: null, serie: null, observaciones: null,
  };

  let rows = ext.partes.map((p) => ({
    ...base,
    no_parte: p.no_parte, descripcion: p.descripcion,
    descripcion_ingles: p.descripcion_ingles,
    cantidad: p.cantidad, um: p.um, valor: p.valor, fraccion: p.fraccion,
    bultos: ext.bultos_total,
    marca:  tipo === "maquinaria" ? p.marca  : null,
    modelo: tipo === "maquinaria" ? p.modelo : null,
    serie:  tipo === "maquinaria" ? p.serie  : null,
    _warnings: [], _tipo: tipo,
  }));

  // Si solo hay 1 parte pero múltiples bultos, expandir por bulto
  if (rows.length === 1 && ext.bultos_total > 1) {
    const o   = rows[0];
    const cpb = o.cantidad ? Math.floor(o.cantidad / ext.bultos_total) : null;
    rows = Array.from({ length: ext.bultos_total }, (_, i) => ({
      ...o, cantidad: cpb, bultos: 1, _bulto: i + 1, _total: ext.bultos_total, _cantTotal: o.cantidad,
    }));
  }
  return rows;
}

/** Genera el contenido CSV con BOM UTF-8 */
export function buildCSV(rows) {
  const header = COLUMNS.join(",");
  const body   = rows
    .map((r) =>
      COL_KEYS.map((k) => {
        const v = r[k];
        return v == null ? "" : `"${String(v).replace(/"/g, '""')}"`;
      }).join(",")
    )
    .join("\n");
  return "\uFEFF" + header + "\n" + body;
}
