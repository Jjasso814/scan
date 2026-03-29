import { C } from "../../config/constants";
import { Card, PrimaryBtn, GhostBtn, DropZone, Thumbs, InfoBadge } from "../UI";
import ResultTable from "../ResultTable";

export default function Phase3({ rows, setRows, tipo, bultoIdx, extracted, p3imgs, p3prevs, onAddFiles, onRemoveFile, onVerify, onSkip }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <h2 style={{ color: C.navy, fontSize: 16, fontWeight: 700, margin: "0 0 4px" }}>Paso 3 — Verificar bultos</h2>
        <p style={{ color: C.muted, fontSize: 12, margin: "0 0 14px" }}>{rows.length} parte(s) detectada(s) en el Packing List</p>
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
            📦 Sube <strong>una foto por bulto</strong> — si tienes {rows.length} bultos, sube {rows.length} fotos.
            La IA verificará cada una por separado e identificará el número de parte y la cantidad.
          </p>
        </div>
        <DropZone
          onFiles={onAddFiles}
          label={`Fotos de los bultos (${p3imgs.length} cargada${p3imgs.length !== 1 ? "s" : ""})`}
          sublabel="Una foto por bulto — etiquetas, código de barras, contenido visible"
        />
        <Thumbs previews={p3prevs} onRemove={onRemoveFile} />
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <PrimaryBtn onClick={onVerify} disabled={!p3imgs.length}>
            ✅ Verificar {p3imgs.length > 0 ? p3imgs.length : ""} bulto{p3imgs.length !== 1 ? "s" : ""}
          </PrimaryBtn>
          <GhostBtn onClick={onSkip}>Saltar verificación</GhostBtn>
        </div>
      </Card>
      <Card>
        <p style={{ color: C.navy, fontSize: 13, fontWeight: 700, margin: "0 0 10px" }}>Vista previa</p>
        <ResultTable rows={rows} setRows={setRows} tipo={tipo} />
      </Card>
    </div>
  );
}
