import { C, LOGO } from "../config/constants";

export default function Header() {
  return (
    <div style={{
      background: C.navy,
      padding: "14px 20px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      boxShadow: "0 2px 12px rgba(13,43,94,0.15)",
    }}>
      <img src={LOGO} style={{ width: 42, height: 42, borderRadius: 10 }} alt="IDEAScan" />
      <div>
        <div style={{ color: C.white, fontWeight: 700, fontSize: 18, letterSpacing: "-0.3px" }}>
          IDEA<span style={{ color: C.orange }}>Scan</span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>
          Inspección de material inteligente
        </div>
      </div>
    </div>
  );
}
