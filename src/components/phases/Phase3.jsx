import { C } from "../../config/constants";
import { Card, PrimaryBtn, GhostBtn, DropZone, Thumbs, InfoBadge } from "../UI";
import ResultTable from "../ResultTable";

export default function Phase3({ rows, setRows, tipo, bultoIdx, extracted, p3imgs, p3prevs, onAddFiles, onRemoveFile, onVerify, onSkip }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <h2 style={{ color: C.navy, fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Paso 3 — Verificar bultos</h2>
        <p style={{ color: C.muted, fontSize: 12, margin: "0 0 14px" }}>Bulto {bultoIdx + 1} de {rows.length}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {extracted && (
            <>
              <InfoBadge label="Proveedor" value={extracted.vendor} />
              <InfoBadge label="Tracking"  value={extracted.tracking} />
            </>
          )}
        </div>
        <div style={{ background: "#fff7f0", border: "1px solid #fde8d0", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#92400e" }}>
            📦 Toma fotos del <strong>bulto {bultoIdx + 1}</strong>. La IA identificará el número de parte y verificará la cantidad.
          </p>
        </div>
        <DropZone
          onFiles={onAddFiles}
          label={"Fotos del bulto " + (bultoIdx + 1)}
          sublabel="Etiquetas, código de barras, contenido visible"
        />
        <Thumbs previews={p3prevs} onRemove={onRemoveFile} />
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <PrimaryBtn onClick={onVerify} disabled={!p3imgs.length}>
            ✅ Verificar bulto {bultoIdx + 1}
          </PrimaryBtn>
          <GhostBtn onClick={onSkip}>Finalizar sin verificar más bultos</GhostBtn>
        </div>
      </Card>
      <Card>
        <p style={{ color: C.navy, fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>Vista previa</p>
        <ResultTable rows={rows} setRows={setRows} tipo={tipo} />
      </Card>
    </div>
  );
}
