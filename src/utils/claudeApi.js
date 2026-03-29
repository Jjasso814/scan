import { COL_KEYS, COLUMNS } from "../config/constants";

/** Convierte un File a base64 (solo los datos, sin el prefijo data:...) */
export const toB64 = (f) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

/**
 * Redimensiona una imagen para adjuntar en email (max 1024px, calidad 72%).
 * Si el canvas falla (ej. HEIC en Chrome) usa los bytes originales como fallback.
 * Devuelve base64 sin prefijo data:...
 */
export async function resizeForEmail(file, maxPx = 1024, quality = 0.72) {
  // Intentar redimensionar con Canvas
  const canvasResult = await new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) { resolve(null); return; }
      const scale  = Math.min(maxPx / w, maxPx / h, 1);
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";          // fondo blanco para PNGs transparentes
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const b64 = dataUrl.split(",")[1];
      // Un canvas en blanco produce un JPEG muy pequeño (~1-2 KB); descartarlo
      resolve(b64 && b64.length > 3000 ? b64 : null);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });

  if (canvasResult) return canvasResult;

  // Fallback: enviar bytes originales si el archivo es pequeño (≤1.5 MB)
  if (file.size <= 1_500_000) return toB64(file);

  return null; // demasiado grande para enviar sin comprimir
}

/** Convierte un File a data URL completa (para previsualizaciones) */
export const toUrl = (f) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

/** Quita el prefijo "⚠️ " al inicio de un valor */
function stripWarn(v) {
  if (!v) return v;
  return String(v).replace(/^⚠️\s*/, "").trim();
}

/** Quita TODOS los "⚠️" dentro del string (para tracking y campos numéricos) */
function stripWarnAll(v) {
  if (!v) return v;
  return String(v).replace(/⚠️\s*/g, "").trim();
}

/**
 * Normaliza un número de tracking: elimina ⚠️, espacios y corrige OCR común.
 * Para UPS (1Z + 16 chars): reemplaza letra O por 0 y letra I por 1 en las posiciones numéricas.
 */
function normalizeTracking(v) {
  if (!v) return v;
  let t = stripWarnAll(v).replace(/\s+/g, "").toUpperCase();
  // Corrección OCR para UPS: después del prefijo "1Z", O→0 e I→1 en posiciones que deben ser dígitos
  if (t.startsWith("1Z") && t.length === 18) {
    const suffix = t.slice(2).replace(/O/g, "0").replace(/I/g, "1");
    t = "1Z" + suffix;
  }
  return t;
}

/** Normaliza el nombre del transportista: solo la marca principal */
function normalizeCarrier(v) {
  if (!v) return v;
  const u = stripWarn(v).toUpperCase();
  if (u.includes("UPS"))                           return "UPS";
  if (u.includes("FEDEX") || u.includes("FED EX")) return "FEDEX";
  if (u.includes("DHL"))                            return "DHL";
  if (u.includes("XPO"))                            return "XPO";
  return stripWarn(v);
}

/** Normaliza el tipo de bulto a su abreviatura */
function normalizeTipoBulto(v) {
  if (!v) return v;
  const u = stripWarn(v).toUpperCase().trim();
  if (u === "BX" || u.includes("BOX")    || u.includes("CAJA"))   return "BX";
  if (u === "TA" || u.includes("TARIMA") || u.includes("PALLET"))  return "TA";
  if (u === "BU" || u.includes("BULTO")  || u.includes("BUNDLE"))  return "BU";
  if (u === "TU" || u.includes("TUBO")   || u.includes("TUBE"))    return "TU";
  return stripWarn(v);
}

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

/** Normaliza el origen al código ISO-2 del país */
function normalizeOrigen(v) {
  if (!v) return v;
  const clean = stripWarn(v).trim();
  if (clean.length === 2) return clean.toUpperCase();
  const u = clean.toUpperCase();
  // Detectar dirección americana: ", CA 90670" o "SANTA FE SPRINGS, CA"
  const usAddrMatch = u.match(/,\s*([A-Z]{2})(?:\s+\d{5})?(?:\s*$|-)/);
  if (usAddrMatch && US_STATES.has(usAddrMatch[1])) return "US";
  // Detectar "COO: US" o "MADE IN US"
  const cooMatch = u.match(/(?:COO|MADE IN)[:\s]+([A-Z]{2})/);
  if (cooMatch) return cooMatch[1];
  const map = {
    "MEXICO":"MX","MÉXICO":"MX","ESTADOS UNIDOS":"US","USA":"US","EE.UU.":"US",
    "UNITED STATES":"US","U.S.A.":"US","CHINA":"CN","CANADA":"CA","CANADÁ":"CA",
    "ALEMANIA":"DE","GERMANY":"DE","JAPAN":"JP","JAPON":"JP","JAPÓN":"JP",
    "KOREA":"KR","COREA":"KR","COREA DEL SUR":"KR","SOUTH KOREA":"KR",
    "FRANCE":"FR","FRANCIA":"FR","ITALY":"IT","ITALIA":"IT",
    "BRAZIL":"BR","BRASIL":"BR","INDIA":"IN","TAIWAN":"TW",
    "UK":"GB","REINO UNIDO":"GB","GREAT BRITAIN":"GB","SPAIN":"ES","ESPAÑA":"ES",
  };
  return map[u] || clean;
}

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
  const esMaq = tipo === "maquinaria";

  // Si el AI puso "PO# XXXX" en el campo serie de alguna parte, rescatarlo al campo po
  let resolvedPo = ext.po || null;
  const partes = (ext.partes || []).map((p) => {
    if (!p.serie) return p;
    const m = String(p.serie).match(/^(?:PO#?|P\/O:?|PURCHASE\s+ORDER:?)\s*(\S+)/i);
    if (m) {
      if (!resolvedPo) resolvedPo = m[1];
      return { ...p, serie: null };
    }
    return p;
  });

  const base = {
    entry_no: null, no_inspeccion: null,
    fecha: new Date().toLocaleDateString("es-MX"),
    importador: ext.importador, proveedor: ext.vendor,
    transportista: normalizeCarrier(ext.carrier),
    trailer: null, referencia: ext.referencia || null, po: resolvedPo,
    peso_lbs: ext.peso_lbs, peso_kgs: ext.peso_kgs,
    tipo_bulto: normalizeTipoBulto(ext.tipo_bulto), valor: null,
    origen: normalizeOrigen(ext.origen),
    fraccion: null, locacion: null, tracking: normalizeTracking(ext.tracking),
    marca: null, modelo: null, serie: null, observaciones: null,
  };

  let rows = partes.map((p, i) => {
    let cantidad = p.cantidad;

    // Maquinaria: si la IA devuelve cantidad=1 (número de cajas), intentar extraer
    // el número de piezas del nombre del producto (ej: "WIPER 100" → 100).
    if (esMaq && Number(cantidad) === 1) {
      const desc = stripWarn(p.descripcion_ingles || p.descripcion || "");
      // Busca el último número ≥2 al final del texto, seguido opcionalmente de unidades
      const m = desc.match(/\b(\d{2,})\s*(?:piezas?|pcs?|pieces?|units?|ea)?\s*$/i);
      if (m && Number(m[1]) > 1) cantidad = Number(m[1]);
    }

    return {
      ...base,
      no_parte: stripWarn(p.no_parte),
      descripcion: stripWarn(p.descripcion),
      descripcion_ingles: stripWarn(p.descripcion_ingles),
      cantidad, um: p.um, valor: p.valor, fraccion: p.fraccion,
      // Maquinaria: solo 1ª fila tiene el número de bulto, el resto vacío
      bultos: esMaq ? (i === 0 ? 1 : null) : ext.bultos_total,
      marca:  esMaq ? stripWarn(p.marca)  : null,
      modelo: esMaq ? stripWarn(p.modelo) : null,
      serie:  esMaq ? stripWarn(p.serie)  : null,
      _warnings: [], _tipo: tipo,
    };
  });

  // Materia prima: si 1 parte y múltiples bultos, expandir por bulto
  if (!esMaq && rows.length === 1 && ext.bultos_total > 1) {
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
