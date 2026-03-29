// Prompt para la Fase 2: extracción de datos del Packing List y etiqueta de transportista
export function buildPhase2Prompt(tipo) {
  const esMaq = tipo === "maquinaria";
  const reglaCantidad = esMaq
    ? `14) cantidad para MAQUINARIA — REGLA CRÍTICA:
    El Packing List dice "Qty: 1" porque envía 1 CAJA. Ese "1" es el número de CAJAS, NO de piezas.
    La cantidad REAL de piezas está en el NOMBRE DEL PRODUCTO o en la etiqueta de la pieza.

    CÓMO ENCONTRAR LA CANTIDAD:
    a) Busca el último número en el nombre/descripción del producto:
       "PISTON O 10CC WH WIPER 100" → cantidad=100 (hay 100 piezas en la caja)
       "VALVE BODY 50"              → cantidad=50
       "SEAL KIT 25"                → cantidad=25
    b) Si la etiqueta de la pieza muestra "Qty: 100" → cantidad=100.

    ⛔ INCORRECTO: cantidad=1 porque el Packing List dice "Qty: 1"
    ✅ CORRECTO:   cantidad=100 porque el nombre dice "WIPER 100"

    Si no encuentras cantidad en nombre ni etiqueta, pon ⚠️ y usa el valor del Packing List.`
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
   NO incluyas el número de piezas al final — solo describe el artículo.
   Ej: "PISTON O 5CC WH WIPER 100" → "Pistón O 5CC con limpiador blanco" (sin "100 piezas").
10) descripcion_ingles: OBLIGATORIO en inglés. Si el texto está en español, tradúcelo. NUNCA dejes null si tienes descripción.
    NO incluyas el número de piezas al final — solo describe el artículo.
11) serie: busca en TODAS las imágenes los campos "Lot/SN", "Lot", "S/N", "Serial", "Lote".
    El número DESPUÉS de esas etiquetas ES el número de serie.
    ⛔ INCORRECTO: serie=null cuando "Lot/SN: 40048850164" es visible.
    ✅ CORRECTO:   serie="40048850164".
    Asigna el Lot/SN correcto a cada no_parte según qué etiqueta corresponde a qué parte.
12) marca y modelo — regla estricta para TODAS las filas sin excepción:
    marca: SOLO el nombre de la empresa fabricante. NUNCA incluyas la línea de productos.
    ⛔ INCORRECTO: marca="Nordson EFD"    ✅ CORRECTO: marca="Nordson"
    ⛔ INCORRECTO: marca="Parker Hannifin Corp"  ✅ CORRECTO: marca="Parker"
    modelo: nombre específico del producto. "EFD" es línea de producto, NO es modelo.
    ⛔ INCORRECTO: modelo="EFD"    ✅ CORRECTO: modelo="Optimum"
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
17) descripcion: describe el artículo sin repetir el no_parte completo.
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
    ? `cantidad_detectada: busca el número al final del nombre del producto (Ej: "WIPER 100" → 100).
Si no hay número en el nombre, busca "Qty:" en la etiqueta de la pieza. IGNORA el Qty del Packing List.`
    : "cantidad_detectada = número de unidades visibles en la imagen.";
  const lineas = JSON.stringify(rows.map(r => ({ no_parte: r.no_parte, cantidad: r.cantidad })));
  return `Eres experto en verificación de material logístico. Analiza las imágenes de UN SOLO BULTO.
Devuelve SOLO este JSON sin texto adicional:
{"no_parte_detectado":null,"cantidad_detectada":null${extraFields},"confianza":"alta","observaciones":null}
Líneas registradas: ${lineas}
REGLAS: Solo JSON. null si no puedes leer. Prefija con ⚠️ si tienes duda.
${cantNote}
observaciones: USA EXACTAMENTE una de estas frases (puedes combinar con " / "):
"BUENAS CONDICIONES", "CAJA DAÑADA", "FALTAN PIEZAS", "INCOMPLETO", "SIN PACKING LIST".
⛔ NO uses otras frases ni texto libre en observaciones.`;
}
