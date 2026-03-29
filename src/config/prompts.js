// Prompt para la Fase 2: extracción de datos del Packing List y etiqueta de transportista
export function buildPhase2Prompt(tipo) {
  const esMaq = tipo === "maquinaria";
  const reglaCantidad = esMaq
    ? `14) cantidad para MAQUINARIA — fuente prioritaria: las imágenes de los productos/cajas.
    a) PRIMERO: busca en las etiquetas o nombres de las cajas la cantidad de PIEZAS por empaque.
       Ej: "PISTON O 10CC WH WIPER 100" → el número al final (100) = piezas por caja → cantidad=100.
       Ej: etiqueta dice "Qty: 100" → cantidad=100.
    b) SEGUNDO: si la imagen no indica claramente cuántas piezas hay, usa el packing list.
    NUNCA pongas 1 si las imágenes o etiquetas del producto indican una cantidad mayor.`
    : `14) cantidad para MATERIA PRIMA — fuente prioritaria: el Packing List / Packing Slip.
    a) PRIMERO: usa la cantidad TOTAL del Packing List para cada número de parte.
       Ej: packing list dice "Qty: 600" → cantidad=600, aunque cada bolsa individual diga "Qty: 100".
    b) SEGUNDO: si no hay packing list, usa la cantidad de la etiqueta del transportista.
    c) TERCERO: si solo hay etiquetas individuales, suma las cantidades de todas las bolsas/piezas.
    NUNCA uses la qty de una sola bolsa si el packing list indica un total mayor.`;

  return `Eres experto en documentos logísticos. Analiza TODAS las imágenes \
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
11) serie: busca en etiquetas de producto "Lot/SN", "Lot", "S/N", "Serial", "Serie", "Lote", "Batch".
    Asigna el Lot/SN de cada etiqueta al no_parte correspondiente. Ej: "Lot/SN: 40048850164" → serie="40048850164".
12) marca y modelo: busca en todas las etiquetas. Llena marca y modelo en CADA parte.
13) po vs referencia — campos DISTINTOS:
    - po: PO del CLIENTE. Busca "Customer P/O", "P.O. Number", "PO#", "Purchase Order".
      Ej: "PO# 11089" en etiqueta de producto → po="11089". "Customer P/O: P433170-00" → po="P433170-00".
    - referencia: número del documento del proveedor. Busca "Order Number", "Packing Slip #", "Delivery Note",
      "Invoice No.", "Folio". Ej: "Order Number: P159308" → referencia="P159308".
14) cantidad — FUENTE DE VERDAD por orden de prioridad:
    a) PRIMERO: usa la cantidad del Packing List/Packing Slip (es el total del pedido).
       Ej: si el packing list dice "Qty: 600" para una parte → cantidad=600.
    b) SEGUNDO: si no hay packing list, usa la cantidad de la etiqueta de transportista.
    c) TERCERO: si solo hay etiquetas de producto individuales, suma las cantidades de todas las bolsas/piezas.
    NUNCA uses la cantidad de UNA sola bolsa o empaque individual si el packing list indica un total mayor.
15) tracking — cuenta los caracteres cuidadosamente:
    - UPS: empieza con "1Z", tiene exactamente 18 caracteres alfanuméricos. Ej: "1ZY861480357175943".
    - FedEx: tiene 12 dígitos. Ej: "418381345270".
    Elimina espacios al escribir el tracking. Si dudas de un carácter, prefija con ⚠️.
16) no_parte con fracciones: lee las fracciones con cuidado. Confusiones frecuentes:
    5/8 ≠ 3/8  (el numerador 5 y el 3 se parecen en documentos borrosos — verifica dos veces)
    6 ≠ 9, 3 ≠ 8, M ≠ W, 0 ≠ O, 1 ≠ I.
    Si el no_parte aparece en varias etiquetas, usa el que más se repite.
17) marca vs modelo:
    - marca: empresa fabricante. Ej: "Nordson", "Parker". Si ves "Nordson EFD" → marca="Nordson".
    - modelo: nombre del producto específico. Ej: "Optimum". "EFD" es línea de producto, NO modelo.
18) descripcion: describe el artículo con claridad, sin repetir la medida ya incluida en no_parte.
    Ej: "1 1/2 40.010 SS Circle" → descripcion="Círculo de acero inoxidable 1½ pulgada malla 40.010"
    NO repitas el no_parte completo en la descripción.
${reglaCantidad}`;
}

// Compatibilidad: exportar el prompt base sin tipo (usa materia_prima por defecto)
export const PHASE2_PROMPT = buildPhase2Prompt("materia_prima");

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
