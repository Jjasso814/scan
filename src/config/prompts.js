// Prompt para la Fase 2: extracción de datos del Packing List y etiqueta de transportista
export const PHASE2_PROMPT = `Eres experto en documentos logísticos. Analiza TODAS las imágenes \
(Packing Lists, etiquetas de transportista y etiquetas de producto) y devuelve SOLO este JSON sin texto extra ni markdown:
{"vendor":null,"po":null,"referencia":null,"importador":null,"origen":null,"carrier":null,"tracking":null,\
"bultos_total":1,"peso_lbs":null,"peso_kgs":null,"tipo_bulto":null,\
"partes":[{"no_parte":null,"descripcion":null,"descripcion_ingles":null,\
"cantidad":null,"um":null,"valor":null,"fraccion":null,"marca":null,"modelo":null,"serie":null}]}
REGLAS:
1) Solo JSON, sin markdown.
2) Una entrada en partes por cada número de parte distinto en el Packing List.
3) null si no aparece el dato.
4) Prefija con "⚠️ " SOLO si tienes duda sobre un valor específico.
5) bultos_total: si ves "1 of 3" o "Pkg 1/3" → el total es 3.
6) carrier: SOLO el nombre de la empresa, sin tipo de servicio ni modalidad.
   Ej: "UPS GROUND" → "UPS", "FEDEX EXPRESS" → "FEDEX", "DHL EXPRESS" → "DHL", "XPO LOGISTICS" → "XPO".
7) tipo_bulto: usa SOLO estas abreviaturas: BX=caja/box, TA=tarima/pallet, BU=bulto/bundle, TU=tubo/tube.
8) origen: USA SIEMPRE código ISO-2. Si ves "COO: US", "Made in USA", una ciudad americana o estado como "CA 90670" → "US".
   NUNCA pongas la dirección completa. Solo el código de 2 letras: MX, US, CN, CA, DE, JP, etc.
9) descripcion: OBLIGATORIO en español. Si el texto está en inglés, tradúcelo. NUNCA dejes null si tienes descripción.
   Ej: "PISTON O 5CC WH WIPER" → "Pistón O 5CC con limpiador blanco".
10) descripcion_ingles: OBLIGATORIO en inglés. Si el texto está en español, tradúcelo. NUNCA dejes null si tienes descripción.
11) serie: busca en etiquetas de producto los campos "Lot/SN", "Lot", "S/N", "Serial", "Serie", "Lote".
    Si hay varias partes, asigna el número de serie que corresponde a cada no_parte según las etiquetas visibles.
12) marca y modelo: busca en todas las etiquetas de producto. Si hay varias partes, llena marca y modelo en CADA parte.
13) po vs referencia — son campos DISTINTOS, NO los confundas:
    - po: el número de orden de compra del CLIENTE. Busca "Customer P/O", "Purchase Order", "P.O.", "Orden de Compra".
      Ej: "Customer P/O: 4508005783" → po = "4508005783".
    - referencia: el número interno del documento de envío. Busca "Delivery Note", "Delivery No.", "Nota de Entrega",
      "Packing List No.", "Invoice No.", "Folio", "Reference". Ej: "Delivery note: 855447424" → referencia = "855447424".
    - Si solo ves un número sin etiqueta clara, ponlo en referencia.
14) no_parte: LEE CON CUIDADO cada carácter del número de parte. Los sufijos de letras son CRÍTICOS.
    Letras que se confunden fácilmente — verifica dos veces:
    M ≠ W  (M tiene pico central hacia arriba; W tiene pico hacia abajo)
    0 ≠ O  (el cero 0 es más ovalado/estrecho; la O es más redonda)
    1 ≠ I ≠ L  (el 1 tiene base; la I tiene serifs; la L es esquina)
    B ≠ 8  (B tiene dos curvas rectas; el 8 es completamente curvo)
    Si el número de parte aparece en VARIAS etiquetas, compara todas y usa el valor que aparece más veces.`;

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
