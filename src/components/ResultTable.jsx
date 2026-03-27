import { C, COLUMNS, COL_KEYS, MAQ_ONLY } from "../config/constants";

/**
 * Tabla editable con las filas del resultado de inspección.
 * Resalta en rojo las celdas con _warnings y en naranja las que la IA marcó con ⚠️.
 */
export default function ResultTable({ rows, setRows, tipo }) {
  const visibleKeys = tipo === "maquinaria"
    ? COL_KEYS
    : COL_KEYS.filter((k) => !MAQ_ONLY.includes(k));

  const visibleCols = COLUMNS.filter(
    (_, i) => !MAQ_ONLY.includes(COL_KEYS[i]) || tipo === "maquinaria"
  );

  return (
    <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${C.border}` }}>
      <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 600, width: "100%" }}>
        <thead>
          <tr>
            {visibleCols.map((col) => (
              <th key={col} style={{
                padding: "8px 10px", background: C.navy, color: C.white,
                whiteSpace: "nowrap", textAlign: "left", fontSize: 11,
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{
              background: ri % 2 === 0 ? C.white : C.lightBg,
              borderBottom: `1px solid ${C.border}`,
            }}>
              {visibleKeys.map((k) => {
                const val    = row[k];
                const isWarn = val && String(val).startsWith("⚠️");
                const isRed  = row._warnings?.includes(k);
                return (
                  <td key={k} style={{ padding: "5px 8px" }}>
                    <input
                      value={val ?? ""}
                      onChange={(e) => {
                        const nr = [...rows];
                        nr[ri] = { ...nr[ri], [k]: e.target.value };
                        setRows(nr);
                      }}
                      style={{
                        background: "transparent", border: "none",
                        color: isRed ? C.red : isWarn ? "#ea580c" : C.text,
                        width: "100%", fontSize: 12, outline: "none",
                        minWidth: 50, fontWeight: isRed || isWarn ? 600 : 400,
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
