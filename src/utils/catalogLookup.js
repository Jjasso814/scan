/**
 * catalogLookup.js — Consulta a ideascan.partes_catalogo vía Supabase REST API.
 * Si las variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no están configuradas,
 * todas las funciones retornan sin error (enriquecimiento opcional).
 */

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Busca una lista de pn_normalizado en partes_catalogo.
 * Retorna un Map de pn_normalizado → registro del catálogo.
 */
async function fetchCatalogEntries(pnList) {
  if (!SUPABASE_URL || !SUPABASE_ANON || !pnList.length) return new Map();

  // PostgREST: ?pn_normalizado=in.(PN1,PN2)&select=...
  const params = new URLSearchParams({
    pn_normalizado: `in.(${pnList.join(",")})`,
    select: "pn_normalizado,descripcion,default_brand,default_model,status",
  });

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/partes_catalogo?${params}`, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        "Accept-Profile": "ideascan",   // accede al schema ideascan (no public)
      },
    });
    if (!resp.ok) return new Map();
    const records = await resp.json();
    return new Map(records.map((r) => [r.pn_normalizado, r]));
  } catch (_) {
    return new Map(); // fallar en silencio si no hay conexión
  }
}

/**
 * Enriquece las filas con datos del catálogo histórico:
 *   - is_new_part_number → false si el PN ya existe en catálogo
 *   - description_source → "historical" si el PN existe
 *   - marca / modelo → se rellenan SOLO si la IA no los detectó (Regla E)
 *
 * No modifica ningún otro campo. Retorna nuevo array (inmutable).
 */
export async function enrichFromCatalog(rows) {
  const pnList = [...new Set(rows.map((r) => r.pn_normalizado).filter(Boolean))];
  const catalog = await fetchCatalogEntries(pnList);
  if (!catalog.size) return rows; // sin catálogo configurado o todos nuevos

  return rows.map((row) => {
    const entry = row.pn_normalizado ? catalog.get(row.pn_normalizado) : null;
    if (!entry) return row; // número de parte nuevo → sin cambios

    return {
      ...row,
      is_new_part_number: false,
      description_source: "historical",
      // Regla E: marca/modelo del catálogo solo si la IA no detectó nada
      marca:  row.marca  || entry.default_brand  || null,
      modelo: row.modelo || entry.default_model  || null,
    };
  });
}
