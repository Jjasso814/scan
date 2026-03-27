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

// Cabeceras del CSV exportado
export const COLUMNS = [
  "Entry No","No. Inspección","Fecha","Importador","Proveedor","Transportista",
  "Trailer","Referencia","Po","No. Parte","Descripción","Descripción Ingles",
  "Cantidad","U.M.","Peso Lbs","Peso Kgs","Bultos","Tipo Bulto","Valor",
  "Origen","Fracción","Locación","Tracking","Marca","Modelo","Serie","Observaciones",
];

// Claves internas del objeto fila (mismo orden que COLUMNS)
export const COL_KEYS = [
  "entry_no","no_inspeccion","fecha","importador","proveedor","transportista",
  "trailer","referencia","po","no_parte","descripcion","descripcion_ingles",
  "cantidad","um","peso_lbs","peso_kgs","bultos","tipo_bulto","valor",
  "origen","fraccion","locacion","tracking","marca","modelo","serie","observaciones",
];

// Columnas exclusivas para tipo maquinaria
export const MAQ_ONLY = ["marca", "modelo", "serie"];

export const MODEL       = "claude-sonnet-4-5";
export const LOGO        = "/logo.png";
export const FIXED_EMAIL = import.meta.env.VITE_FIXED_EMAIL || "juan.jasso@groupcca.com";
