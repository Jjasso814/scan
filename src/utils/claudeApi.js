import * as XLSX from "xlsx";
import { XLSX_HEADERS, xlsxRowValues } from "../config/constants";

/** Convierte un File a base64 (solo los datos, sin el prefijo data:...) */
export const toB64 = (f) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

/**
 * Redimensiona una imagen para adjuntar en email (max 1600px, calidad 85%).
 * Si el canvas falla (ej. HEIC en Chrome) usa los bytes originales como fallback.
 * Devuelve base64 sin prefijo data:...
 */
export async function resizeForEmail(file, maxPx = 1600, quality = 0.85) {
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

  // Fallback: enviar bytes originales si el archivo es pequeño (≤2.5 MB)
  if (file.size <= 2_500_000) return toB64(file);

  return null; // demasiado grande para enviar sin comprimir
}

/** Convierte un File a data URL completa (para previsualizaciones) */
export const toUrl = (f) =>
  new Promise((res) => {
    // Usar createObjectURL en lugar de FileReader — más rápido y no falla con HEIC en móvil
    try { res(URL.createObjectURL(f)); }
    catch (_) {
      const r = new FileReader();
      r.onload  = () => res(r.result);
      r.onerror = () => res(null);
      r.readAsDataURL(f);
    }
  });

/**
 * Prepara una imagen para enviar a la API de Claude.
 * @param {File} file
 * @param {number} maxPx  - Dimensión máxima (calculada dinámicamente en callClaude según cuántas imágenes hay)
 * @param {number} quality - Calidad JPEG (0-1)
 */
async function prepareForApi(file, maxPx, quality) {
  const canvasB64 = await new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) { resolve(null); return; }
      const scale  = Math.min(maxPx / w, maxPx / h, 1);
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL("image/jpeg", quality).split(",")[1];
      resolve(b64 && b64.length > 1000 ? b64 : null);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
  if (canvasB64) return { b64: canvasB64, mediaType: "image/jpeg" };
  // Fallback: bytes originales si el archivo ya es pequeño
  if (file.size <= 2_000_000) return { b64: await toB64(file), mediaType: file.type || "image/jpeg" };
  return null;
}

/**
 * Calcula la resolución máxima por imagen para mantenerse dentro del límite de Vercel (4.5 MB request body).
 * Así, con pocas imágenes se usa alta resolución; con muchas se reduce proporcionalmente.
 * Fórmula: budget_por_imagen → píxeles en lado más largo.
 * Ejemplo: 1 img → 2048px, 4 imgs → ~1300px, 9 imgs → ~870px, 13 imgs → ~720px
 */
function calcApiMaxPx(imageCount) {
  const BUDGET = 3_500_000;          // 3.5 MB para los datos de imagen (deja 1 MB para JSON, headers)
  const BYTES_PER_IMG = Math.floor(BUDGET / imageCount);
  // Estimación empírica: JPEG 85% produce ~0.35 bytes/pixel para fotos de documentos
  const px = Math.round(Math.sqrt(BYTES_PER_IMG / 0.35));
  return Math.max(640, Math.min(2048, px));  // entre 640 y 2048
}

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
  // OCR: "12" al inicio de un tracking de 18 chars casi siempre es "1Z" (Z leída como 2)
  if (t.startsWith("12") && t.length === 18) t = "1Z" + t.slice(2);
  // Corrección OCR para UPS: después del prefijo "1Z", O→0 e I→1
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
  // Resolución dinámica: máxima calidad posible sin rebasar el límite de 4.5 MB de Vercel
  const maxPx = calcApiMaxPx(images.length);
  const imgs = (await Promise.all(
    images.map(async (f) => {
      const prepared = await prepareForApi(f, maxPx, 0.88);
      if (!prepared) return null; // imagen inválida o demasiado grande
      return { type: "image", source: { type: "base64", media_type: prepared.mediaType, data: prepared.b64 } };
    })
  )).filter(Boolean);

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
      // ── Campos de enriquecimiento (PRD) ───────────────────────────────────────
      raw_description:    p.raw_description || null,
      description_source: (p.descripcion || p.descripcion_ingles) ? "document" : "empty",
      confidence_score:   1.0,   // se recalcula abajo con los ⚠️ detectados
      is_new_part_number: true,  // true hasta que se conecte catálogo histórico
      _warnings: [], _tipo: tipo,
    };
  });

  // Recalcular confidence_score por fila según campos con ⚠️
  rows = rows.map((r) => {
    const warnCount = Object.values(r).filter(
      (v) => typeof v === "string" && v.startsWith("⚠️")
    ).length;
    const baseScore = ext.calidad_imagenes === "mala" ? 0.3
                    : ext.calidad_imagenes === "aceptable" ? 0.7
                    : 1.0;
    const penaltyPerWarn = 0.1;
    const score = Math.max(0.1, baseScore - warnCount * penaltyPerWarn);
    return { ...r, confidence_score: Math.round(score * 100) / 100 };
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

/**
 * Genera un archivo XLSX con las columnas del formato de recepción.
 * @param {Array} rows - Filas normalizadas
 * @param {"base64"|"array"} [outputType="base64"] - "base64" para email, "array" para descarga
 * @returns {string|Uint8Array}
 */
export function buildXLSX(rows, outputType = "base64") {
  const wsData = [XLSX_HEADERS, ...rows.map(xlsxRowValues)];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Ancho de columnas aproximado (caracteres)
  ws["!cols"] = [
    { wch: 18 }, // NUMERO DE PARTE
    { wch: 10 }, // CANTIDAD
    { wch: 18 }, // CANTIDAD DE BULTOS
    { wch: 12 }, // TIPO DE BULTO
    { wch: 15 }, // DOCUMENTO SAP
    { wch: 11 }, // ID DE BULTO
    { wch: 12 }, // UBICACION
    { wch: 8  }, // FILA
    { wch: 12 }, // PO #
    { wch: 20 }, // TRACKING
    { wch: 20 }, // OBS
    { wch: 9  }, // P1(KG)
    { wch: 10 }, // PESO LBS
    { wch: 8  }, // ORIGEN
    { wch: 14 }, // MARCA
    { wch: 14 }, // MODELO
    { wch: 16 }, // SERIE
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Recepcion");
  return XLSX.write(wb, { bookType: "xlsx", type: outputType });
}
