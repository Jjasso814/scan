import { C, FIXED_EMAIL } from "../../config/constants";
import { Card, PrimaryBtn, GhostBtn } from "../UI";
import ResultTable from "../ResultTable";

function ReconciliationCard({ reconciliation }) {
  if (!reconciliation) return null;
  const ok = reconciliation.diff === 0;
  return (
    <Card style={{ background: ok ? "#f0fdf4" : "#fff8f0", border: "1px solid " + (ok ? "#86efac" : C.orange) }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: ok ? "#166534" : C.navy }}>
        {ok ? "✅" : "⚠️"} Reconciliación de Cantidades
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          { label: "Packing List",    val: reconciliation.totalPacking },
          { label: "Físico Recibido", val: reconciliation.totalFisico  },
          { label: "Diferencia",      val: (reconciliation.diff > 0 ? "+" : "") + reconciliation.diff },
        ].map(({ label, val }) => (
          <div key={label} style={{ background: "rgba(255,255,255,0.7)", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
            <div style={{ color: C.muted, fontSize: 11, marginBottom: 2 }}>{label}</div>
            <div style={{ fontWeight: 700, color: C.navy, fontSize: 16 }}>{val}</div>
          </div>
        ))}
      </div>
      {!ok && (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "#92400e", background: "#fef3c7", borderRadius: 6, padding: "8px 10px" }}>
          Discrepancia: <strong>{Math.abs(reconciliation.diff)} unidades {reconciliation.diff > 0 ? "más" : "menos"}</strong> que el Packing List.
        </p>
      )}
    </Card>
  );
}

export default function Phase4({ rows, setRows, tipo, reconciliation, emailMsg, onDownload, onEmail, onReset }) {
  const hasWarnings = rows.some((r) => r._warnings?.length > 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <h2 style={{ color: C.navy, fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Resultado final</h2>
        <p style={{ color: C.muted, fontSize: 12, margin: 0 }}>{rows.length} línea(s) registrada(s)</p>
        {hasWarnings && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginTop: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: C.red, fontWeight: 600 }}>⚠️ Hay campos en rojo que requieren verificación manual.</p>
          </div>
        )}
      </Card>

      <ReconciliationCard reconciliation={reconciliation} />

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid " + C.border }}>
          <p style={{ margin: 0, fontSize: 13, color: C.navy, fontWeight: 600 }}>
            Campos en <span style={{ color: C.red }}>rojo</span> = verificar · Puedes editar cualquier celda
          </p>
        </div>
        <div style={{ padding: 12, overflowX: "auto" }}>
          <ResultTable rows={rows} setRows={setRows} tipo={tipo} />
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <PrimaryBtn onClick={onDownload}>⬇️ Descargar CSV</PrimaryBtn>
        <button onClick={onEmail} style={{ background: C.orange, color: C.white, border: "none", borderRadius: 10, padding: "13px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%" }}>
          📧 Enviar por correo a {FIXED_EMAIL}
        </button>
        <GhostBtn onClick={onReset}>🔄 Nueva inspección</GhostBtn>
      </div>

      {emailMsg && (
        <div style={{ background: emailMsg.startsWith("✅") ? "#f0fdf4" : "#fef2f2", border: "1px solid " + (emailMsg.startsWith("✅") ? "#bbf7d0" : "#fecaca"), borderRadius: 10, padding: "12px 16px" }}>
          <p style={{ margin: 0, fontSize: 13, color: emailMsg.startsWith("✅") ? C.green : C.red, fontWeight: 600 }}>{emailMsg}</p>
        </div>
      )}
    </div>
  );
}
