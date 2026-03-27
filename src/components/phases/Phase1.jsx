import { C, LOGO } from "../../config/constants";
import { Card } from "../UI";

const TIPO_OPTS = [
  { id: "materia_prima", icon: "🧪", title: "Materia Prima",       desc: "Insumos y componentes. No requiere Marca, Modelo ni Serie." },
  { id: "maquinaria",    icon: "⚙️", title: "Maquinaria / Equipo", desc: "Máquinas y equipos. Incluye Marca, Modelo y Número de Serie." },
];

export default function Phase1({ onSelect }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ textAlign: "center", padding: "24px 16px 8px" }}>
        <img src={LOGO} style={{ width: 80, height: 80, borderRadius: 18, marginBottom: 12, boxShadow: "0 4px 20px rgba(13,43,94,0.15)" }} />
        <h1 style={{ color: C.navy, fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>IDEAScan</h1>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>Inspección de material inteligente</p>
      </div>
      <Card>
        <h2 style={{ color: C.navy, fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>¿Qué tipo de material vas a inspeccionar?</h2>
        <p style={{ color: C.muted, fontSize: 13, margin: "0 0 16px" }}>Selecciona una opción para continuar.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {TIPO_OPTS.map((opt) => (
            <button key={opt.id} onClick={() => onSelect(opt.id)}
              style={{ background: C.white, border: "2px solid " + C.border, borderRadius: 12, padding: 16, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 32, flexShrink: 0 }}>{opt.icon}</div>
              <div>
                <div style={{ color: C.navy, fontWeight: 700, fontSize: 15 }}>{opt.title}</div>
                <div style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>{opt.desc}</div>
              </div>
              <div style={{ marginLeft: "auto", color: C.orange, fontSize: 20 }}>›</div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
