// Prompt para la Fase 2: extracción de datos del Packing List y etiqueta de transportista
export const PHASE2_PROMPT = `Eres experto en documentos logísticos. Analiza las imágenes \
(Packing Lists y etiquetas de transportista) y devuelve SOLO este JSON sin texto extra ni markdown:
{"vendor":null,"po":null,"importador":null,"origen":null,"carrier":null,"tracking":null,\
"bultos_total":1,"peso_lbs":null,"peso_kgs":null,"tipo_bulto":null,\
"partes":[{"no_parte":null,"descripcion":null,"descripcion_ingles":null,\
"cantidad":null,"um":null,"valor":null,"fraccion":null,"marca":null,"modelo":null,"serie":null}]}
REGLAS:
1) Solo JSON, sin markdown.
2) Una entrada en partes por cada número de parte distinto en el Packing List.
3) null si no aparece el dato.
4) Prefija con "⚠️ " si tienes duda sobre el valor.
5) bultos_total: si ves "1 of 3" o "Pkg 1/3" → el total es 3.
6) carrier: solo el nombre de la empresa transportista, sin tipo de servicio.
   Ej: "UPS GROUND" → "UPS", "FEDEX EXPRESS" → "FEDEX", "DHL EXPRESS" → "DHL", "XPO LOGISTICS" → "XPO".
7) tipo_bulto: usa SOLO estas abreviaturas exactas: BX=caja/box, TA=tarima/pallet, BU=bulto/bundle, TU=tubo/tube.
8) origen: usa código de país ISO-2 en mayúsculas. Ej: México→"MX", EE.UU./USA→"US", China→"CN", Canadá→"CA".
9) descripcion: SIEMPRE en español. Si el texto original está en inglés, tradúcelo al español.
10) descripcion_ingles: SIEMPRE en inglés. Si el texto original está en español, tradúcelo al inglés.`;

/**
 * Construye el prompt de verificación para la Fase 3 (bulto individual).
 * @param {string} tipo  - "maquinaria" | "materia_prima"
 * @param {Array}  rows  - Filas actuales del resultado
 */
export function buildPhase3Prompt(tipo, rows) {
  const extraFields = tipo === "maquinaria"
    ? ',"marca_detectada":null,"modelo_detectado":null,"serie_detectada":null'
    : "";
  const cantNote = tipo === "maquinaria"
    ? "IMPORTANTE para maquinaria: cantidad_detectada = número de piezas/componentes visibles en ESTA imagen (no el total del Packing List)."
    : "cantidad_detectada = número de unidades visibles en la imagen.";
  const lineas = JSON.stringify(rows.map(r => ({ no_parte: r.no_parte, cantidad: r.cantidad })));
  return `Eres experto en verificación de material logístico. Analiza las imágenes de UN SOLO BULTO.
Devuelve SOLO este JSON:
{"no_parte_detectado":null,"cantidad_detectada":null${extraFields},"confianza":"alta","observaciones":null}
Líneas registradas: ${lineas}
REGLAS: Solo JSON. null si no puedes leer. Prefija con ⚠️ si tienes duda.
${cantNote}
observaciones: elige la frase que corresponda: "BUENAS CONDICIONES", "CAJA DAÑADA", "FALTAN PIEZAS", "INCOMPLETO", "SIN PACKING LIST". Puedes combinar con " / " si aplican varias.`;
}
