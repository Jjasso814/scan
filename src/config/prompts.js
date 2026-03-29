// Prompt para la Fase 2: extracción de datos del Packing List y etiqueta de transportista
export function buildPhase2Prompt(tipo) {
  const esMaq = tipo === "maquinaria";

  const preambulo = esMaq
    ? `[MODO MAQUINARIA ACTIVADO]
ANTES de llenar el JSON, lee esto:
• cantidad = el número al FINAL del nombre del producto (NO el Qty del Packing List).
  Proceso obligatorio: copia el nombre del producto → ¿termina en número? → usa ese número como cantidad.
  "PISTON O 10CC WH WIPER 100" → termina en 100 → cantidad=100.
  "PISTON O 5CC WH WIPER 100"  → termina en 100 → cantidad=100.
  El "Qty: 1" del Packing List = 1 CAJA. La caja contiene N piezas. N está en el nombre del producto.
• marca = empresa fabricante sin línea de productos: "Nordson EFD" → "Nordson". Aplica a TODAS las filas.

`
    : "";

  const reglaCantidad = esMaq
    ? `14) cantidad para MAQUINARIA — proceso paso a paso:
    PASO 1: Lee el nombre completo del producto (descripcion_ingles).
    PASO 2: ¿Termina en un número? → ese número ES la cantidad. Escríbelo en cantidad.
            "PISTON O 10CC WH WIPER 100" → cantidad=100
            "VALVE BODY 50"              → cantidad=50
    PASO 3: Si no termina en número, busca "Qty:" en la etiqueta de la PIEZA (no del Packing List).
    PASO 4: Solo si no encontraste nada en PASO 2 ni PASO 3, usa el Packing List y pon ⚠️.
    ⛔ NUNCA pongas cantidad=1 si el nombre del producto termina en un número mayor.`
    : `14) cantidad para MATERIA PRIMA — fuente prioritaria: el Packing List / Packing Slip.
    a) PRIMERO: usa la cantidad TOTAL del Packing List para cada número de parte.
       Ej: packing list dice "Qty: 600" → cantidad=600, aunque cada bolsa individual diga "Qty: 100".
    b) SEGUNDO: si no hay packing list, usa la cantidad de la etiqueta del transportista.
    c) TERCERO: si solo hay etiquetas individuales, suma las cantidades de todas las bolsas/piezas.
    NUNCA uses la qty de una sola bolsa si el packing list indica un total mayor.`;

  return `${preambulo}Eres experto en documentos logísticos. Analiza TODAS las imágenes \
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
8) origen: país de FABRICACIÓN del producto (no de envío). Usa código ISO-2.
   Busca "Made in", "COO:", "Country of Origin", "Fabricado en" en las etiquetas del producto.
   ⛔ La dirección del remitente NO es el origen — es donde se envía desde, no donde se fabricó.
   ✅ "Made in China" → "CN". "Made in USA" → "US". "Made in Mexico" → "MX".
   Si no encuentras "Made in" ni "COO", y ves dirección americana (ej. "CA 90670") → "US".
   Solo código de 2 letras: MX, US, CN, CA, DE, JP, KR, TW, etc.
9) descripcion: OBLIGATORIO en español. Traduce el nombre del artículo. NUNCA dejes null si tienes descripción.
   NO incluyas el número de piezas al final. Ej: "PISTON O 5CC WH WIPER 100" → "Pistón O 5CC con limpiador blanco".
10) descripcion_ingles: OBLIGATORIO en inglés. NUNCA dejes null si tienes descripción.
    NO incluyas el número de piezas al final. Ej: "PISTON O 5CC WH WIPER 100" → "Piston O 5CC with white wiper".
11) serie: busca SOLO los campos "Lot/SN", "Lot", "S/N", "Serial", "Lote" en las etiquetas.
    El número DESPUÉS de esas palabras ES el número de serie.
    ⛔ NUNCA pongas "PO#", "P/O:", "Purchase Order" en serie — esos son campos de po.
    ⛔ INCORRECTO: serie="PO# 11089"  ✅ CORRECTO: serie=null (PO va en el campo po)
    ✅ CORRECTO: si ves "Lot/SN: 40048850164" → serie="40048850164".
    Asigna el Lot/SN correcto a cada no_parte según qué etiqueta corresponde a qué parte.
12) marca y modelo — aplica a TODAS las filas sin excepción:
    marca: SOLO empresa fabricante. Elimina líneas de producto, divisiones y sufijos corporativos.
    ⛔ INCORRECTO: "Nordson EFD", "Parker Hannifin Corp", "Rowe Process Supply", "Rowe Equipment Inc"
    ✅ CORRECTO:   "Nordson",     "Parker",               "Rowe",               "Rowe"
    Si todos los productos son del mismo fabricante, usa la misma marca en TODAS las filas.
    modelo: nombre específico del producto. "EFD" es línea de producto, NO es modelo.
    ⛔ INCORRECTO: modelo="EFD"    ✅ CORRECTO: modelo="Optimum"
13) po vs referencia — campos DISTINTOS:
    - po: PO del CLIENTE. Busca "Customer P/O", "P.O. Number", "PO#", "Purchase Order" en
      CUALQUIER imagen (packing list, etiqueta de transportista O etiqueta del producto).
      Ej: "PO# 11089" en etiqueta de producto → po="11089".
      "Customer P/O: P433170-00" → po="P433170-00".
    - referencia: número del documento del proveedor. Busca "Order Number", "Packing Slip #",
      "Delivery Note", "Invoice No.". Ej: "Order Number: P159308" → referencia="P159308".
${reglaCantidad}
15) tracking — cuenta los caracteres:
    - UPS: empieza con "1Z", exactamente 18 caracteres. Solo dígitos y letras mayúsculas (0-9, A-Z).
      IMPORTANTE: la letra "O" en tracking UPS suele ser el número "0". Lee con cuidado.
      Ej correcto: "1ZY861480357175943". Elimina espacios.
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
    ? `cantidad_detectada: busca el número al FINAL del nombre del producto visible en la imagen.
"PISTON O 10CC WH WIPER 100" → cantidad_detectada=100. IGNORA el Qty del Packing List.`
    : "cantidad_detectada = número de unidades visibles en la imagen.";
  const lineas = JSON.stringify(rows.map(r => ({ no_parte: r.no_parte, cantidad: r.cantidad })));
  return `Eres experto en verificación de material logístico. Analiza las imágenes de UN SOLO BULTO.
Devuelve SOLO este JSON sin texto adicional:
{"no_parte_detectado":null,"cantidad_detectada":null${extraFields},"confianza":"alta","observaciones":null}
Líneas registradas: ${lineas}
REGLAS: Solo JSON. null si no puedes leer. Prefija con ⚠️ si tienes duda.
${cantNote}
observaciones: USA EXACTAMENTE una de estas frases (puedes combinar con " / "):
"BUENAS CONDICIONES" | "CAJA DAÑADA" | "FALTAN PIEZAS" | "INCOMPLETO" | "SIN PACKING LIST"
⛔ PROHIBIDO escribir cualquier otra frase o texto libre en observaciones.`;
}
