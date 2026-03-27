import { C } from "../config/constants";

const STEPS  = ["Tipo", "Documentos", "Bultos", "Resultado"];
const EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];

export default function StepBar({ phase }) {
  return (
    <div style={{
      display: "flex",
      background: C.white,
      borderBottom: `1px solid ${C.border}`,
      padding: "0 16px",
    }}>
      {STEPS.map((s, i) => {
        const active = phase === i + 1;
        const done   = phase  >  i + 1;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              padding: "10px 4px",
              textAlign: "center",
              borderBottom: `3px solid ${active ? C.orange : done ? C.navy : "transparent"}`,
              transition: "all 0.2s",
            }}
          >
            <div style={{ fontSize: 15 }}>{done ? "✅" : EMOJIS[i]}</div>
            <div style={{
              fontSize: 10,
              fontWeight: active ? 700 : 400,
              color: active ? C.orange : done ? C.navy : C.muted,
              marginTop: 2,
            }}>
              {s}
            </div>
          </div>
        );
      })}
    </div>
  );
}
