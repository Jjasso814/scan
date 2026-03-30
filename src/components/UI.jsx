import { useState } from "react";
import { C } from "../config/constants";

// ── Contenedor con sombra ──────────────────────────────────────────────────────
export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: C.white, borderRadius: 16, padding: 20,
      boxShadow: "0 2px 12px rgba(13,43,94,0.07)",
      border: `1px solid ${C.border}`, ...style,
    }}>
      {children}
    </div>
  );
}

// ── Botón primario (azul navy) ─────────────────────────────────────────────────
export function PrimaryBtn({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "#c0cce0" : C.navy,
        color: C.white, border: "none", borderRadius: 10,
        padding: "13px 22px", fontSize: 14, fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s", width: "100%",
      }}
    >
      {children}
    </button>
  );
}

// ── Botón secundario (outline) ─────────────────────────────────────────────────
export function GhostBtn({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent", color: C.muted,
        border: `1.5px solid ${C.border}`, borderRadius: 10,
        padding: "11px 18px", fontSize: 13, fontWeight: 600,
        cursor: "pointer", width: "100%",
      }}
    >
      {children}
    </button>
  );
}

// ── Zona de arrastre + botones de captura/galería ─────────────────────────────
export function DropZone({ onFiles, label, sublabel }) {
  const [drag, setDrag] = useState(false);
  const idGaleria  = `g-${label}`;
  const idCaptura  = `c-${label}`;

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    onFiles(Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/")));
  };

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        style={{
          border: `2px dashed ${drag ? C.orange : C.border}`,
          borderRadius: 12, padding: "18px 12px", textAlign: "center",
          background: drag ? "#fff7f0" : C.lightBg,
          transition: "all 0.2s", marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 6 }}>🖼️</div>
        <p style={{ color: C.text, margin: 0, fontSize: 13, fontWeight: 600 }}>{label}</p>
        {sublabel && <p style={{ color: C.muted, margin: "4px 0 0", fontSize: 12 }}>{sublabel}</p>}
        <input id={idGaleria} type="file" multiple accept="image/*"
          style={{ display: "none" }} onChange={(e) => onFiles(Array.from(e.target.files))} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button onClick={() => document.getElementById(idCaptura).click()}
          style={{ background: C.orange, color: C.white, border: "none", borderRadius: 10,
            padding: "13px 8px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          📷 Tomar foto
        </button>
        <button onClick={() => document.getElementById(idGaleria).click()}
          style={{ background: C.white, color: C.navy, border: `1.5px solid ${C.border}`,
            borderRadius: 10, padding: "13px 8px", fontSize: 13, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          🗂️ Desde galería
        </button>
      </div>
      {/* capture sin multiple: en iOS solo permite 1 foto por toma — el usuario presiona el botón varias veces */}
      <input id={idCaptura} type="file" accept="image/*" capture="environment"
        style={{ display: "none" }} onChange={(e) => { onFiles(Array.from(e.target.files)); e.target.value = ""; }} />
    </div>
  );
}

// ── Miniaturas de imágenes seleccionadas ──────────────────────────────────────
export function Thumbs({ previews, onRemove }) {
  if (!previews.length) return null;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(72px,1fr))",
      gap: 8, marginTop: 12,
    }}>
      {previews.map((src, i) => (
        <div key={i} style={{ position: "relative" }}>
          <img src={src} style={{
            width: "100%", aspectRatio: "1/1", objectFit: "cover",
            borderRadius: 8, border: `1px solid ${C.border}`,
          }} />
          <button onClick={() => onRemove(i)} style={{
            position: "absolute", top: 3, right: 3,
            background: "rgba(220,38,38,0.9)", color: "#fff",
            border: "none", borderRadius: "50%", width: 18, height: 18,
            fontSize: 10, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", lineHeight: 1,
          }}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ── Badge de información (proveedor, tracking, etc.) ─────────────────────────
export function InfoBadge({ label, value }) {
  if (!value) return null;
  return (
    <div style={{
      display: "inline-flex", flexDirection: "column",
      background: C.lightBg, borderRadius: 8,
      padding: "6px 12px", border: `1px solid ${C.border}`,
    }}>
      <span style={{ fontSize: 10, color: C.muted, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
      <span style={{ fontSize: 13, color: C.text, fontWeight: 600, marginTop: 1 }}>{value}</span>
    </div>
  );
}
