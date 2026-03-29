// Prompt para la Fase 2: extracción de datos del Packing List y etiqueta de transportista
export function buildPhase2Prompt(tipo) {
  const esMaq = tipo === "maquinaria";
  const reglaCantidad = esMaq
    ? `14) cantidad para MAQUINARIA — las piezas por empaque, NO el número de cajas:
    IMPORTANTE: el Packing List suele decir "Qty: 1" porque es 1 CAJA/EMPAQUE, no 1 pieza.
    La cantidad real de PIEZAS se encuentra en las etiquetas del producto o en su nombre:
    - Si el nombre del producto termina en un número → ese es el conteo de piezas por empaque.
      Ej: "PISTON O 10CC WH WIPER 100" → 100 piezas. "VALVE BODY 50" → 50 piezas.
    - Si la etiqueta del producto dice "Qty: 100" → cantidad=100.
    - Si el nombre dice "WIPER 100" y el Packing List dice "Qty: 1" → cantidad=100 (la caja contiene 100 piezas).
    NUNCA uses el Qty del Packing List si el nombre del producto o su etiqueta indica una cantidad mayor.`
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
11) serie: en las etiquetas de producto busca los campos "Lot/SN", "Lot", "S/N", "Serial", "Lote".
    El número que aparece DESPUÉS de esas palabras ES el número de serie — captúralo siempre.
    Ej: si ves "Lot/SN: 40048850164" → serie="40048850164". NUNCA dejes serie en null si está visible.
    Asigna el Lot/SN correcto a cada no_parte según qué etiqueta corresponde a qué parte.
12) marca: SOLO el nombre de la empresa fabricante, NUNCA incluyas la línea de productos.
    Ej: "Nordson EFD" → marca="Nordson". "Parker Hannifin" → marca="Parker". Aplica esto en TODAS las filas.
    modelo: el nombre específico del producto. Ej: "Optimum". Aplica en TODAS las filas por igual.
13) po vs referencia — campos DISTINTOS:
    - po: PO del CLIENTE. Busca "Customer P/O", "P.O. Number", "PO#", "Purchase Order".
      Ej: "PO# 11089" en etiqueta → po="11089". "Customer P/O: P433170-00" → po="P433170-00".
    - referencia: número del documento del proveedor. Busca "Order Number", "Packing Slip #",
      "Delivery Note", "Invoice No.". Ej: "Order Number: P159308" → referencia="P159308".
${reglaCantidad}
15) tracking — cuenta los caracteres:
    - UPS: empieza con "1Z", exactamente 18 caracteres. Ej: "1ZY861480357175943".
    - FedEx: 12 dígitos. Ej: "418381345270". Elimina espacios al escribir el tracking.
16) no_parte con fracciones — lee con cuidado:
    5/8 ≠ 3/8, 6 ≠ 9, 3 ≠ 8, M ≠ W, 0 ≠ O, 1 ≠ I.
    Si el no_parte aparece en varias etiquetas, usa el valor que más se repite.
17) marca vs modelo:
    - marca: empresa fabricante. Ej: "Nordson". Si ves "Nordson EFD" → marca="Nordson".
    - modelo: producto específico. Ej: "Optimum". "EFD" es línea de producto, NO modelo.
18) descripcion: describe el artículo sin repetir el no_parte completo.
    Ej: "1 1/2 40.010 SS Circle" → "Círculo de acero inoxidable 1½ pulgada malla 40.010"`;
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
