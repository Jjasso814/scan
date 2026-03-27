// Prompt para la Fase 2: extracción de datos del Packing List y etiqueta de transportista
export const PHASE2_PROMPT = `Eres experto en documentos logísticos. Analiza las imágenes \
(Packing Lists y etiquetas de transportista) y devuelve SOLO este JSON sin texto extra ni markdown:
{"vendor":null,"po":null,"importador":null,"origen":null,"carrier":null,"tracking":null,\
"bultos_total":1,"peso_lbs":null,"peso_kgs":null,"tipo_bulto":null,\
"partes":[{"no_parte":null,"descripcion":null,"descripcion_ingles":null,\
"cantidad":null,"um":null,"valor":null,"fraccion":null,"marca":null,"modelo":null,"serie":null}]}
REGLAS:
1) Solo JSON.
2) Una entrada en partes por cada aparición de número de parte en el Packing List.
3) null si no aparece.
4) Prefija con "⚠️ " si tienes duda sobre el valor.
5) Para bultos_total busca "1 of 3" o "Pkg 1/3" → el número total es 3.`;

/**
 * Construye el prompt de verificación para la Fase 3 (bulto individual).
 * @param {string} tipo  - "maquinaria" | "materia_prima"
 * @param {Array}  rows  - Filas actuales del resultado
 */
export function buildPhase3Prompt(tipo, rows) {
  const extraFields = tipo === "maquinaria"
    ? ',"marca_detectada":null,"modelo_detectado":null,"serie_detectada":null'
    : "";
  const lineas = JSON.stringify(rows.map(r => ({ no_parte: r.no_parte, cantidad: r.cantidad })));
  return `Eres experto en verificación de material logístico. Analiza las imágenes de UN SOLO BULTO.
Devuelve SOLO este JSON:
{"no_parte_detectado":null,"cantidad_detectada":null${extraFields},"confianza":"alta","observaciones":null}
Líneas registradas: ${lineas}
Solo JSON. null si no puedes leer. Prefija con ⚠️ si tienes duda.`;
}
