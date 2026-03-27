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

/** Quita el prefijo de advertencia "⚠️ " que la IA puede agregar */
function stripWarn(v) {
  if (!v) return v;
  return String(v).replace(/^⚠️\s*/, "").trim();
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
  const base = {
    entry_no: null, no_inspeccion: null,
    fecha: new Date().toLocaleDateString("es-MX"),
    importador: ext.importador, proveedor: ext.vendor,
    transportista: normalizeCarrier(ext.carrier),
    trailer: null, referencia: null, po: ext.po,
    peso_lbs: ext.peso_lbs, peso_kgs: ext.peso_kgs,
    tipo_bulto: normalizeTipoBulto(ext.tipo_bulto), valor: null,
    origen: normalizeOrigen(ext.origen),
    fraccion: null, locacion: null, tracking: ext.tracking,
    marca: null, modelo: null, serie: null, observaciones: null,
  };

  let rows = ext.partes.map((p, i) => ({
    ...base,
    no_parte: stripWarn(p.no_parte),
    descripcion: stripWarn(p.descripcion),
    descripcion_ingles: stripWarn(p.descripcion_ingles),
    cantidad: p.cantidad, um: p.um, valor: p.valor, fraccion: p.fraccion,
    // Maquinaria: solo 1ª fila tiene el número de bulto, el resto vacío
    bultos: esMaq ? (i === 0 ? 1 : null) : ext.bultos_total,
    marca:  esMaq ? stripWarn(p.marca)  : null,
    modelo: esMaq ? stripWarn(p.modelo) : null,
    serie:  esMaq ? stripWarn(p.serie)  : null,
    _warnings: [], _tipo: tipo,
  }));

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
