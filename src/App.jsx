import { useState, useCallback } from "react";
import emailjs from "@emailjs/browser";
import { C, FIXED_EMAIL } from "./config/constants";
import { PHASE2_PROMPT, buildPhase3Prompt } from "./config/prompts";
import { callClaude, buildRows, buildCSV, toUrl } from "./utils/claudeApi";
import Header      from "./components/Header";
import StepBar     from "./components/StepBar";
import LoginScreen from "./components/LoginScreen";
import { Card }    from "./components/UI";
import Phase1 from "./components/phases/Phase1";
import Phase2 from "./components/phases/Phase2";
import Phase3 from "./components/phases/Phase3";
import Phase4 from "./components/phases/Phase4";

export default function App() {
  const requireAuth = !!import.meta.env.VITE_REQUIRE_AUTH;
  const [authed, setAuthed]                 = useState(() => !requireAuth || !!sessionStorage.getItem("app_pwd"));
  const [phase, setPhase]                   = useState(1);
  const [tipo, setTipo]                     = useState(null);
  const [p2imgs, setP2imgs]                 = useState([]);
  const [p2prevs, setP2prevs]               = useState([]);
  const [p3imgs, setP3imgs]                 = useState([]);
  const [p3prevs, setP3prevs]               = useState([]);
  const [rows, setRows]                     = useState([]);
  const [bultoIdx, setBultoIdx]             = useState(0);
  const [extracted, setExtracted]           = useState(null);
  const [reconciliation, setReconciliation] = useState(null);
  const [loading, setLoading]               = useState(false);
  const [loadMsg, setLoadMsg]               = useState("");
  const [emailMsg, setEmailMsg]             = useState("");
  const [allImgs, setAllImgs]               = useState([]);

  if (!authed) return <LoginScreen onAuth={() => setAuthed(true)} />;

  const addFiles = useCallback(async (files, setI, setP) => {
    setI((p) => [...p, ...files]);
    const urls = await Promise.all(files.map(toUrl));
    setP((p) => [...p, ...urls]);
    setAllImgs((p) => [...p, ...files]);
  }, []);

  const removeFile = (i, setI, setP) => {
    setI((p) => p.filter((_, j) => j !== i));
    setP((p) => p.filter((_, j) => j !== i));
  };

  const reset = () => {
    setPhase(1); setTipo(null);
    setP2imgs([]); setP2prevs([]);
    setP3imgs([]); setP3prevs([]);
    setRows([]); setBultoIdx(0);
    setExtracted(null); setReconciliation(null);
    setEmailMsg(""); setAllImgs([]);
  };

  const calcReconciliation = (finalRows, ext) => {
    if (!ext?.partes?.length) return;
    const totalPacking = ext.partes.reduce((a, p) => a + (Number(p.cantidad) || 0), 0);
    const totalFisico  = finalRows.reduce((a, r)  => a + (Number(r.cantidad)  || 0), 0);
    const diff = totalFisico - totalPacking;
    if (diff !== 0) finalRows.forEach((r) => { r._warnings = r._warnings || []; if (!r._warnings.includes("reconciliacion")) r._warnings.push("reconciliacion"); });
    setReconciliation({ totalPacking, totalFisico, diff });
  };

  const runPhase2 = async () => {
    if (!p2imgs.length) return;
    setLoading(true); setLoadMsg("Analizando Packing List...");
    try {
      const ext = await callClaude(PHASE2_PROMPT, p2imgs, "Extrae toda la información y devuelve el JSON.");
      setExtracted(ext); setRows(buildRows(ext, tipo)); setPhase(3);
    } catch (e) { alert("Error al analizar imágenes: " + e.message); }
    finally { setLoading(false); }
  };

  const runPhase3 = async () => {
    if (!p3imgs.length) return;
    setLoading(true); setLoadMsg("Verificando bulto " + (bultoIdx + 1) + "...");
    try {
      const res = await callClaude(buildPhase3Prompt(tipo, rows), p3imgs, "Analiza este bulto.");
      const newRows = [...rows];
      const target  = Math.max(0, newRows.findIndex((r) => r.no_parte === res.no_parte_detectado) || bultoIdx);
      const row     = { ...newRows[target], _warnings: [...(newRows[target]._warnings || [])] };
      if (res.cantidad_detectada !== null && res.cantidad_detectada !== row.cantidad) { row.cantidad = res.cantidad_detectada; if (!row._warnings.includes("cantidad")) row._warnings.push("cantidad"); }
      if (tipo === "maquinaria") { if (res.marca_detectada) row.marca = res.marca_detectada; if (res.modelo_detectado) row.modelo = res.modelo_detectado; if (res.serie_detectada) row.serie = res.serie_detectada; }
      if (res.observaciones) row.observaciones = res.observaciones;
      if (res.confianza === "baja" && !row._warnings.includes("no_parte")) row._warnings.push("no_parte");
      newRows[target] = row;
      const cantTotal = newRows[0]?._cantTotal;
      if (cantTotal && newRows.reduce((s, r) => s + (Number(r.cantidad) || 0), 0) === cantTotal)
        newRows.forEach((r) => { r._warnings = r._warnings?.filter((w) => w !== "cantidad"); });
      setRows(newRows); setP3imgs([]); setP3prevs([]);
      calcReconciliation(newRows, extracted);
      if (bultoIdx < rows.length - 1) setBultoIdx((i) => i + 1); else setPhase(4);
    } catch (e) { alert("Error al analizar bulto: " + e.message); }
    finally { setLoading(false); }
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(new Blob([buildCSV(rows)], { type: "text/csv;charset=utf-8;" }));
    Object.assign(document.createElement("a"), { href: url, download: "IDEAScan_" + new Date().toLocaleDateString("es-MX").replace(/\//g, "-") + ".csv" }).click();
    URL.revokeObjectURL(url);
  };

  const handleEmail = async () => {
    setLoading(true); setLoadMsg("Enviando correo...");
    try {
      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        { to_email: FIXED_EMAIL, subject: "IDEAScan — Inspección " + new Date().toLocaleDateString("es-MX"), csv_data: buildCSV(rows), lines_count: rows.length, images_count: allImgs.length },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      );
      setEmailMsg("✅ Correo enviado a " + FIXED_EMAIL);
    } catch (e) { setEmailMsg("❌ Error: " + (e?.text || e?.message || "Verifica la configuración de EmailJS")); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.lightBg, fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <Header />
      <StepBar phase={phase} />
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 14 }}>

        {loading && (
          <Card style={{ textAlign: "center", padding: 24 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⚙️</div>
            <p style={{ color: C.navy, fontWeight: 700, margin: "0 0 4px", fontSize: 15 }}>{loadMsg}</p>
            <p style={{ color: C.muted, margin: 0, fontSize: 12 }}>Esto puede tardar unos segundos...</p>
          </Card>
        )}

        {phase === 1 && !loading && (
          <Phase1 onSelect={(t) => { setTipo(t); setPhase(2); }} />
        )}

        {phase === 2 && !loading && (
          <Phase2
            p2imgs={p2imgs} p2prevs={p2prevs}
            onAddFiles={(f) => addFiles(f, setP2imgs, setP2prevs)}
            onRemoveFile={(i) => removeFile(i, setP2imgs, setP2prevs)}
            onAnalyze={runPhase2}
            onSkip={() => { setRows([]); setPhase(4); }}
          />
        )}

        {phase === 3 && !loading && rows.length > 0 && (
          <Phase3
            rows={rows} setRows={setRows} tipo={tipo}
            bultoIdx={bultoIdx} extracted={extracted}
            p3imgs={p3imgs} p3prevs={p3prevs}
            onAddFiles={(f) => addFiles(f, setP3imgs, setP3prevs)}
            onRemoveFile={(i) => removeFile(i, setP3imgs, setP3prevs)}
            onVerify={runPhase3}
            onSkip={() => setPhase(4)}
          />
        )}

        {phase === 4 && !loading && (
          <Phase4
            rows={rows} setRows={setRows} tipo={tipo}
            reconciliation={reconciliation} emailMsg={emailMsg}
            onDownload={handleDownload} onEmail={handleEmail} onReset={reset}
          />
        )}

      </div>
    </div>
  );
}
