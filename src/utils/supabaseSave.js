/**
 * supabaseSave.js — Envía la recepción a la Netlify Function save-recepcion,
 * que a su vez la guarda en Supabase con la service role key (server-side).
 */

function generateFolio(tipo) {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const r = Math.floor(Math.random() * 9000) + 1000;
  const prefix = tipo === "maquinaria" ? "MAQ" : "MAT";
  return `${prefix}-${d}-${r}`;
}

export async function saveRecepcion(rows, tipo) {
  const folio = generateFolio(tipo);

  const resp = await fetch("/api/save-recepcion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folio, tipo, rows }),
  });

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    throw new Error(data.error || "Error " + resp.status);
  }

  return folio;
}
