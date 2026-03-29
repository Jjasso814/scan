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
    - po: ÚNICAMENTE el número de orden de compra del CLIENTE. Busca la etiqueta exacta "Customer P/O",
      "Customer Purchase Order", "P.O. Number", "Orden de Compra del Cliente".
      Ej: "Customer P/O: P433170-00" → po = "P433170-00". NUNCA uses el Customer Number ni el Order Number.
    - referencia: el número interno del documento de envío del proveedor. Busca "Order Number", "Order No.",
      "Delivery Note", "Packing List No.", "Invoice No.", "Shipping Number", "Folio".
      Ej: "Order Number: 0169067" → referencia = "0169067".
    - Si ves DOS números (ej. Order Number y Shipping Number), usa el Order Number en referencia.
14) no_parte y números en general: LEE CON CUIDADO cada dígito. Dígitos y letras que se confunden:
    6 ≠ 9  (el 6 tiene la cola hacia ABAJO; el 9 tiene la cola hacia ARRIBA)
    3 ≠ 8  (el 3 está ABIERTO por la derecha; el 8 está completamente CERRADO)
    M ≠ W  (M tiene pico central hacia arriba; W tiene pico hacia abajo)
    0 ≠ O  (el cero 0 es más estrecho; la O es más redonda)
    1 ≠ I ≠ L  (el 1 tiene base; la I tiene serifs; la L es esquina recta)
    Si el número de parte aparece en VARIAS etiquetas, compara todas y usa el valor que más se repite.
15) marca vs modelo — son campos DISTINTOS:
    - marca: el nombre de la EMPRESA fabricante únicamente. Ej: "Nordson", "Parker", "Bosch".
      Si ves "Nordson EFD" en una etiqueta, la marca es solo "Nordson".
    - modelo: el nombre ESPECÍFICO del producto o modelo. Ej: "Optimum", "Serie 3000", "XR-5".
      "EFD" es una línea de productos de Nordson, NO es el modelo. El modelo sería "Optimum" u otro nombre de producto.
      Si la caja muestra "Nordson EFD" y "Optimum", entonces marca="Nordson" y modelo="Optimum".
16) serie: busca CON PRIORIDAD en etiquetas de producto los campos "Lot/SN", "Lot", "S/N", "Serial Number",
    "Serie", "Lote", "Batch". El número que sigue a estas etiquetas ES el número de serie.
    Ej: "Lot/SN: 40048850164" → serie = "40048850164".
    Si hay varias partes, asigna el Lot/SN que corresponde a cada no_parte según su etiqueta individual.`;

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
