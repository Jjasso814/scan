import { useState, useCallback } from "react";
import { C, FIXED_EMAIL } from "./config/constants";
import { buildPhase2Prompt, buildPhase3Prompt } from "./config/prompts";
import { callClaude, buildRows, buildCSV, toUrl, resizeForEmail } from "./utils/claudeApi";
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
      const ext = await callClaude(buildPhase2Prompt(tipo), p2imgs, "Extrae toda la información y devuelve el JSON.");
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
    const now = new Date();
    const fecha = now.toLocaleDateString("es-MX").replace(/\//g, "-");
    const hora  = now.toTimeString().slice(0, 8).replace(/:/g, "-");
    const url = URL.createObjectURL(new Blob([buildCSV(rows)], { type: "text/csv;charset=utf-8;" }));
    Object.assign(document.createElement("a"), { href: url, download: `IDEAScan_${fecha}_${hora}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  const handleEmail = async () => {
    handleDownload(); // descarga el CSV automáticamente

    setLoading(true); setLoadMsg("Comprimiendo imágenes...");
    try {
      const now   = new Date();
      const fecha = now.toLocaleDateString("es-MX");
      const hora  = now.toTimeString().slice(0, 8).replace(/:/g, "-");

      // Redimensionar imágenes a máx 1024px antes de enviar
      const resized = (await Promise.all(allImgs.map(resizeForEmail))).filter(Boolean);

      setLoadMsg("Enviando correo con adjuntos...");

      const partes = rows.map((r, i) =>
        `Línea ${i + 1}:\n` +
        `  No. Parte   : ${r.no_parte      || "-"}\n` +
        `  Descripción : ${r.descripcion   || r.descripcion_ingles || "-"}\n` +
        `  Desc. Inglés: ${r.descripcion_ingles || "-"}\n` +
        `  Cantidad    : ${r.cantidad      || "-"} ${r.um || ""}\n` +
        `  Transportist: ${r.transportista || "-"}\n` +
        `  Tracking    : ${r.tracking      || "-"}\n` +
        `  Origen      : ${r.origen        || "-"}\n` +
        `  Tipo Bulto  : ${r.tipo_bulto    || "-"}\n` +
        (r.marca  ? `  Marca       : ${r.marca}\n`  : "") +
        (r.modelo ? `  Modelo      : ${r.modelo}\n` : "") +
        (r.serie  ? `  Serie       : ${r.serie}\n`  : "") +
        `  Observ.     : ${r.observaciones || "-"}`
      ).join("\n\n");

      const text =
        `IDEAScan — Resultado de Inspección\n` +
        `${"=".repeat(40)}\n` +
        `Fecha    : ${fecha}\n` +
        `Tipo     : ${rows[0]?._tipo === "maquinaria" ? "Maquinaria" : "Materia Prima"}\n` +
        `Líneas   : ${rows.length}  |  Imágenes: ${allImgs.length}\n` +
        `${"─".repeat(40)}\n\n` +
        partes + "\n\n" +
        `${"─".repeat(40)}\n` +
        `Adjuntos: IDEAScan_${fecha.replace(/\//g,"-")}_${hora}.csv + ${resized.length} imagen(es)\n` +
        `Generado por IDEAScan · Group CCA`;

      const resp = await fetch("/api/sendmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: FIXED_EMAIL,
          subject: "IDEAScan — Inspección " + fecha,
          text,
          csvData: buildCSV(rows),
          csvFilename: `IDEAScan_${fecha.replace(/\//g, "-")}_${hora}.csv`,
          images: resized,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Error del servidor " + resp.status);
      }
      setEmailMsg("✅ CSV e imágenes enviados a " + FIXED_EMAIL);
    } catch (e) {
      setEmailMsg("❌ Error al enviar: " + e.message);
    } finally {
      setLoading(false);
    }
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
            onBack={() => { setTipo(null); setP2imgs([]); setP2prevs([]); setPhase(1); }}
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
