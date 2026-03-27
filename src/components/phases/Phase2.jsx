import { C } from "../../config/constants";
import { Card, PrimaryBtn, GhostBtn, DropZone, Thumbs } from "../UI";

export default function Phase2({ p2imgs, p2prevs, onAddFiles, onRemoveFile, onAnalyze, onSkip, onBack }) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <button onClick={onBack} style={{ background: "none", border: "1px solid " + C.border, borderRadius: 8, padding: "4px 12px", fontSize: 13, color: C.muted, cursor: "pointer" }}>
          ← Volver
        </button>
        <h2 style={{ color: C.navy, fontSize: 16, fontWeight: 700, margin: 0 }}>Paso 2 — Documentos de envío</h2>
      </div>
      <p style={{ color: C.text, fontSize: 13, margin: "0 0 16px", lineHeight: 1.6 }}>
        Toma o sube fotos del <strong>Packing List</strong> y la <strong>etiqueta del transportista</strong>.
      </p>
      <DropZone
        onFiles={onAddFiles}
        label="Sube tus imágenes aquí"
        sublabel="Packing List · Carrier Label · Etiquetas"
      />
      <Thumbs previews={p2prevs} onRemove={onRemoveFile} />
      {p2imgs.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <PrimaryBtn onClick={onAnalyze}>
            🔍 Analizar {p2imgs.length} imagen{p2imgs.length > 1 ? "es" : ""}
          </PrimaryBtn>
          <GhostBtn onClick={onSkip}>Ir directo a resultados (sin análisis)</GhostBtn>
        </div>
      )}
    </Card>
  );
}
