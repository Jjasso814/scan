// Paleta de colores corporativos
export const C = {
  navy:    "#0d2b5e",
  orange:  "#f47920",
  white:   "#ffffff",
  lightBg: "#f4f7fc",
  border:  "#dce6f5",
  text:    "#1a2a4a",
  muted:   "#6b7fa3",
  red:     "#dc2626",
  green:   "#16a34a",
};

// Cabeceras del archivo XLSX exportado
export const XLSX_HEADERS = [
  "NUMERO DE PARTE",
  "CANTIDAD",
  "CANTIDAD DE BULTOS",
  "TIPO DE BULTO",
  "DOCUMENTO SAP",
  "ID DE BULTO",
  "UBICACION",
  "FILA",
  "PO #",
  "TRACKING",
  "OBS",
  "P1(KG)",
  "PESO LBS",
  "ORIGEN",
  "MARCA",
  "MODELO",
  "SERIE",
];

// Función que extrae los valores de una fila en el orden de XLSX_HEADERS
export function xlsxRowValues(r) {
  const idBulto = r._bulto ? `${r._bulto}/${r._total}` : (r.bultos ? `1/${r.bultos}` : "1/1");
  return [
    r.no_parte      || null,
    r.cantidad      ?? null,
    r.bultos        ?? null,
    r.tipo_bulto    || null,
    null,                        // DOCUMENTO SAP — campo para uso manual en SAP
    idBulto,
    r.locacion      || null,
    null,                        // FILA — campo para uso manual
    r.po            || null,
    r.tracking      || null,
    r.observaciones || null,
    r.peso_kgs      ?? null,
    r.peso_lbs      ?? null,
    r.origen        || null,
    r.marca         || null,
    r.modelo        || null,
    r.serie         || null,
  ];
}

// Columnas exclusivas para tipo maquinaria
export const MAQ_ONLY = ["marca", "modelo", "serie"];

export const MODEL       = "claude-sonnet-4-5";
export const LOGO        = "/logo.png";
export const FIXED_EMAIL = import.meta.env.VITE_FIXED_EMAIL || "juan.jasso@groupcca.com";
