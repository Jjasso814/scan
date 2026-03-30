import { C } from "../../config/constants";
import { Card, PrimaryBtn, GhostBtn, DropZone, Thumbs } from "../UI";

const CAMPO_LABELS = {
  tracking: "Tracking", carrier: "Transportista", referencia: "Referencia",
  po: "PO", origen: "Origen", no_parte: "No. Parte", cantidad: "Cantidad",
  descripcion: "Descripción", marca: "Marca", modelo: "Modelo", serie: "Serie",
};

export default function Phase2({ p2imgs, p2prevs, onAddFiles, onRemoveFile, onAnalyze, onSkip, onBack, imgWarning, onContinueAnyway }) {
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

      {imgWarning && (
        <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
          <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 13, color: "#856404" }}>
            ⚠️ {imgWarning.calidad === "mala" ? "Imágenes poco claras detectadas" : "Algunos campos son inciertos"}
          </p>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#856404" }}>
            La IA tuvo dificultades para leer{" "}
            {imgWarning.campos.length > 0
              ? <>los campos: <strong>{imgWarning.campos.map(c => CAMPO_LABELS[c] || c).join(", ")}</strong></>
              : "algunos campos"}.
            {" "}Agrega fotos más nítidas para mejorar la precisión.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={onContinueAnyway}
              style={{ background: "#856404", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>
              Continuar de todas formas
            </button>
            <button
              onClick={() => {}}
              style={{ background: "none", border: "1px solid #856404", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "#856404", cursor: "pointer" }}>
              Agregar fotos más claras ↓
            </button>
          </div>
        </div>
      )}

      <DropZone
        onFiles={onAddFiles}
        label="Sube tus imágenes aquí"
        sublabel="Packing List · Carrier Label · Etiquetas"
      />
      <Thumbs previews={p2prevs} onRemove={onRemoveFile} />
      {p2imgs.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <PrimaryBtn onClick={onAnalyze}>
            🔍 {imgWarning ? "Re-analizar con nuevas fotos" : `Analizar ${p2imgs.length} imagen${p2imgs.length > 1 ? "es" : ""}`}
          </PrimaryBtn>
          <GhostBtn onClick={onSkip}>Ir directo a resultados (sin análisis)</GhostBtn>
        </div>
      )}
    </Card>
  );
}
