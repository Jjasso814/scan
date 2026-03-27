import { useState } from "react";
import { C, LOGO } from "../config/constants";
import Header from "./Header";

export default function LoginScreen({ onAuth }) {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!pwd.trim()) { setErr("Ingresa la contraseña"); return; }
    sessionStorage.setItem("app_pwd", pwd.trim());
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic " + btoa("user:" + pwd.trim()) },
      body: JSON.stringify({ system: "test", images: [], text: "test" }),
    })
      .then((r) => {
        if (r.status === 401) { sessionStorage.removeItem("app_pwd"); setErr("Contraseña incorrecta"); }
        else onAuth();
      })
      .catch(() => setErr("Error de conexión. Verifica tu red."));
  };

  return (
    <div style={{ minHeight: "100vh", background: C.lightBg, display: "flex", flexDirection: "column" }}>
      <Header />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ background: C.white, borderRadius: 16, padding: "32px 28px", maxWidth: 380, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <img src={LOGO} style={{ width: 56, height: 56, borderRadius: 12, marginBottom: 12 }} alt="IDEAScan" />
            <h2 style={{ color: C.navy, fontWeight: 700, fontSize: 18, margin: "0 0 4px" }}>IDEAScan</h2>
            <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Ingresa la contraseña para continuar</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", color: C.text, fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Contraseña</label>
              <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus placeholder="••••••••"
                style={{ width: "100%", padding: "10px 14px", border: "1px solid " + (err ? C.red : C.border), borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              {err && <p style={{ color: C.red, fontSize: 12, margin: "6px 0 0" }}>{err}</p>}
            </div>
            <button type="submit" style={{ width: "100%", background: C.navy, color: C.white, border: "none", borderRadius: 8, padding: 11, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Ingresar
            </button>
          </form>
          <p style={{ color: C.muted, fontSize: 11, textAlign: "center", marginTop: 16, marginBottom: 0 }}>
            Configura APP_PASSWORD en Vercel Settings → Environment Variables
          </p>
        </div>
      </div>
    </div>
  );
}
