import { useState, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const FIXED_EMAIL = "juan.jasso@groupcca.com";
const COLUMNS = ["Entry No","No. Inspección","Fecha","Importador","Proveedor","Transportista","Trailer","Referencia","Po","No. Parte","Descripción","Descripción Ingles","Cantidad","U.M.","Peso Lbs","Peso Kgs","Bultos","Tipo Bulto","Valor","Origen","Fracción","Locación","Tracking","Marca","Modelo","Serie","Observaciones"];
const COL_KEYS = ["entry_no","no_inspeccion","fecha","importador","proveedor","transportista","trailer","referencia","po","no_parte","descripcion","descripcion_ingles","cantidad","um","peso_lbs","peso_kgs","bultos","tipo_bulto","valor","origen","fraccion","locacion","tracking","marca","modelo","serie","observaciones"];
const MAQ_ONLY = ["marca","modelo","serie"];

const PHASE2_PROMPT = `Eres experto en documentos logísticos. Analiza las imágenes (packing lists y etiquetas de transportista) y devuelve SOLO este JSON:
{"vendor":null,"po":null,"importador":null,"origen":null,"carrier":null,"tracking":null,"bultos_total":1,"peso_lbs":null,"peso_kgs":null,"tipo_bulto":null,"partes":[{"no_parte":null,"descripcion":null,"descripcion_ingles":null,"cantidad":null,"um":null,"valor":null,"fraccion":null,"marca":null,"modelo":null,"serie":null}]}
REGLAS: 1) Solo JSON sin markdown. 2) Una entrada en "partes" por cada aparición de número de parte. 3) null si no aparece. 4) Prefija con "⚠️ " si tienes duda. 5) bultos_total: busca "1 of 3"→3.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toB64 = f => new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(f);});
const toUrl = f => new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f);});

async function callClaude(system, images, text) {
  const imgs = await Promise.all(images.map(async f => ({ type:"image", source:{ type:"base64", media_type:f.type||"image/jpeg", data:await toB64(f) } })));
  const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system,messages:[{role:"user",content:[...imgs,{type:"text",text}]}]})});
  const d = await res.json();
  const raw = d.content?.find(b=>b.type==="text")?.text||"";
  return JSON.parse(raw.replace(/```json|```/g,"").trim());
}

function buildRows(ext, tipo) {
  const base = { entry_no:null,no_inspeccion:null,fecha:new Date().toLocaleDateString("es-MX"),importador:ext.importador,proveedor:ext.vendor,transportista:ext.carrier,trailer:null,referencia:null,po:ext.po,descripcion:null,descripcion_ingles:null,um:null,peso_lbs:ext.peso_lbs,peso_kgs:ext.peso_kgs,tipo_bulto:ext.tipo_bulto,valor:null,origen:ext.origen,fraccion:null,locacion:null,tracking:ext.tracking,marca:null,modelo:null,serie:null,observaciones:null };
  let rows = ext.partes.map(p => ({ ...base, no_parte:p.no_parte, descripcion:p.descripcion, descripcion_ingles:p.descripcion_ingles, cantidad:p.cantidad, um:p.um, valor:p.valor, fraccion:p.fraccion, bultos:ext.bultos_total, marca:tipo==="maquinaria"?p.marca:null, modelo:tipo==="maquinaria"?p.modelo:null, serie:tipo==="maquinaria"?p.serie:null, _warnings:[] }));
  if (rows.length===1 && ext.bultos_total>1) {
    const orig=rows[0]; const cpb=orig.cantidad?Math.floor(orig.cantidad/ext.bultos_total):null;
    rows=Array.from({length:ext.bultos_total},(_,i)=>({...orig,cantidad:cpb,bultos:1,_bulto:i+1,_total:ext.bultos_total,_cantTotal:orig.cantidad}));
  }
  return rows;
}

function buildCSV(rows) {
  const h=COLUMNS.join(",");
  const body=rows.map(r=>COL_KEYS.map(k=>{const v=r[k];return v==null?"":`"${String(v).replace(/"/g,'""')}"`}).join(",")).join("\n");
  return "\uFEFF"+h+"\n"+body;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function DropZone({ onFiles, label }) {
  const [drag, setDrag] = useState(false);
  const idGallery = `fi-gallery-${label}`;
  const idCamera = `fi-camera-${label}`;
  return (
    <div>
      <div onDrop={e=>{e.preventDefault();setDrag(false);onFiles(Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith("image/")));}} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
        style={{border:`2px dashed ${drag?"#60a5fa":"rgba(148,163,184,0.3)"}`,borderRadius:12,padding:"16px",textAlign:"center",background:drag?"rgba(96,165,250,0.05)":"rgba(255,255,255,0.02)",transition:"all 0.2s",marginBottom:10}}>
        <div style={{fontSize:26,marginBottom:6}}>🖼️</div>
        <p style={{color:"#94a3b8",margin:0,fontSize:12}}>{label}</p>
        <p style={{color:"#475569",margin:"4px 0 0",fontSize:11}}>Arrastra imágenes aquí (desde computadora)</p>
        <input id={idGallery} type="file" multiple accept="image/*" style={{display:"none"}} onChange={e=>onFiles(Array.from(e.target.files))} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <button onClick={()=>document.getElementById(idCamera).click()} style={{background:"rgba(37,99,235,0.15)",border:"1.5px solid rgba(37,99,235,0.4)",borderRadius:10,padding:"12px 8px",color:"#60a5fa",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          📷 Tomar foto
        </button>
        <button onClick={()=>document.getElementById(idGallery).click()} style={{background:"rgba(99,155,255,0.08)",border:"1.5px solid rgba(99,155,255,0.25)",borderRadius:10,padding:"12px 8px",color:"#94a3b8",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          🗂️ Galería / Archivo
        </button>
      </div>
      <input id={idCamera} type="file" accept="image/*" capture="environment" multiple style={{display:"none"}} onChange={e=>onFiles(Array.from(e.target.files))} />
    </div>
  );
}

function Thumbs({ previews, onRemove }) {
  if (!previews.length) return null;
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))",gap:8,marginTop:10}}>
      {previews.map((src,i)=>(
        <div key={i} style={{position:"relative"}}>
          <img src={src} style={{width:"100%",aspectRatio:"1/1",objectFit:"cover",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)"}} />
          <button onClick={()=>onRemove(i)} style={{position:"absolute",top:3,right:3,background:"rgba(220,38,38,0.9)",color:"#fff",border:"none",borderRadius:"50%",width:18,height:18,fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
      ))}
    </div>
  );
}

function Btn({ onClick, disabled, children, color="#2563eb", outline=false }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{background:outline?"transparent":`${color}`,color:outline?color:"#fff",border:`1.5px solid ${color}`,borderRadius:8,padding:"10px 18px",fontSize:13,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,transition:"all 0.15s"}}>
      {children}
    </button>
  );
}

function ResultTable({ rows, setRows, tipo }) {
  const visibleKeys = tipo==="maquinaria" ? COL_KEYS : COL_KEYS.filter(k=>!MAQ_ONLY.includes(k));
  const visibleCols = COLUMNS.filter((_,i)=>!MAQ_ONLY.includes(COL_KEYS[i])||tipo==="maquinaria");
  return (
    <div style={{overflowX:"auto",borderRadius:10,border:"1px solid rgba(99,155,255,0.2)"}}>
      <table style={{borderCollapse:"collapse",fontSize:12,minWidth:700,width:"100%"}}>
        <thead>
          <tr>{visibleCols.map(c=><th key={c} style={{padding:"8px 10px",background:"rgba(37,99,235,0.2)",color:"#93c5fd",whiteSpace:"nowrap",borderBottom:"1px solid rgba(99,155,255,0.2)",textAlign:"left"}}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row,ri)=>(
            <tr key={ri} style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
              {visibleKeys.map(k=>{
                const val=row[k]; const isWarn=val&&String(val).startsWith("⚠️"); const isRed=row._warnings?.includes(k);
                return (
                  <td key={k} style={{padding:"6px 10px",color:isRed?"#f87171":isWarn?"#fb923c":"#e2e8f0",whiteSpace:"nowrap"}}>
                    <input value={val??""} onChange={e=>{const nr=[...rows];nr[ri]={...nr[ri],[k]:e.target.value};setRows(nr);}}
                      style={{background:"transparent",border:"none",color:"inherit",width:"100%",fontSize:12,outline:"none",minWidth:60}} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState(1);
  const [tipo, setTipo] = useState(null);
  const [p2imgs, setP2imgs] = useState([]); const [p2prevs, setP2prevs] = useState([]);
  const [rows, setRows] = useState([]);
  const [p3imgs, setP3imgs] = useState([]); const [p3prevs, setP3prevs] = useState([]);
  const [bultoIdx, setBultoIdx] = useState(0);
  const [loading, setLoading] = useState(false); const [loadMsg, setLoadMsg] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [allImgs, setAllImgs] = useState([]);

  const addFiles = useCallback(async (files, setImgs, setPrevs) => {
    setImgs(p=>[...p,...files]);
    const urls=await Promise.all(files.map(toUrl));
    setPrevs(p=>[...p,...urls]);
    setAllImgs(p=>[...p,...files]);
  },[]);

  const removeFile = (i, setImgs, setPrevs) => { setImgs(p=>p.filter((_,j)=>j!==i)); setPrevs(p=>p.filter((_,j)=>j!==i)); };

  // ── Phase 2: analyze packing list + carrier label
  const runPhase2 = async () => {
    if (!p2imgs.length) return;
    setLoading(true); setLoadMsg("Analizando Packing List y etiqueta del transportista...");
    try {
      const ext = await callClaude(PHASE2_PROMPT, p2imgs, "Extrae toda la información y devuelve el JSON.");
      const built = buildRows(ext, tipo);
      setRows(built);
      setPhase(3);
    } catch(e) { alert("Error al analizar: "+e.message); }
    finally { setLoading(false); }
  };

  // ── Phase 3: verify bulto
  const runPhase3 = async () => {
    if (!p3imgs.length) return;
    setLoading(true); setLoadMsg(`Analizando bulto ${bultoIdx+1}...`);
    try {
      const prompt = `Eres experto en verificación de material. Analiza las imágenes de UN SOLO BULTO y devuelve SOLO este JSON:
{"no_parte_detectado":null,"cantidad_detectada":null,"descripcion_detectada":null${tipo==="maquinaria"?',"marca_detectada":null,"modelo_detectado":null,"serie_detectada":null':''},"confianza":"alta","observaciones":null}
Líneas registradas: ${JSON.stringify(rows.map(r=>({no_parte:r.no_parte,cantidad:r.cantidad})))}
REGLAS: Solo JSON. null si no puedes leer. Prefija con ⚠️ si tienes duda.`;
      const res = await callClaude(prompt, p3imgs, "Analiza este bulto.");
      const newRows = [...rows];
      const target = newRows.findIndex(r=>r.no_parte===res.no_parte_detectado) ?? bultoIdx;
      const idx = target>=0?target:bultoIdx;
      const row = {...newRows[idx]};
      const warns = [...(row._warnings||[])];
      if (res.cantidad_detectada!==null && res.cantidad_detectada!==row.cantidad) { row.cantidad=res.cantidad_detectada; if(!warns.includes("cantidad"))warns.push("cantidad"); }
      if (tipo==="maquinaria") {
        if(res.marca_detectada){row.marca=res.marca_detectada;} if(res.modelo_detectado){row.modelo=res.modelo_detectado;} if(res.serie_detectada){row.serie=res.serie_detectada;}
      }
      if(res.observaciones)row.observaciones=res.observaciones;
      if(res.confianza==="baja"&&!warns.includes("no_parte"))warns.push("no_parte");
      row._warnings=warns; newRows[idx]=row;
      // Check if total quantities match
      const cantTotal=newRows[0]?._cantTotal;
      if(cantTotal){const suma=newRows.reduce((s,r)=>s+(Number(r.cantidad)||0),0);if(suma===cantTotal)newRows.forEach(r=>r._warnings=r._warnings?.filter(w=>w!=="cantidad"));}
      setRows(newRows);
      setP3imgs([]); setP3prevs([]);
      if(bultoIdx<rows.length-1){setBultoIdx(i=>i+1);}else{setPhase(4);}
    } catch(e){alert("Error al analizar bulto: "+e.message);}
    finally{setLoading(false);}
  };

  const handleDownload = () => { const csv=buildCSV(rows); const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`MARTECH_${new Date().toLocaleDateString("es-MX").replace(/\//g,"-")}.csv`; a.click(); URL.revokeObjectURL(url); };

  const handleEmail = async () => {
    setLoading(true); setLoadMsg("Enviando correo...");
    try {
      const csv=buildCSV(rows); const csvBlob=new Blob([csv],{type:"text/csv"}); const csvB64=await toB64(new File([csvBlob],"MARTECH.csv",{type:"text/csv"}));
      const tableRows=rows.map(r=>COL_KEYS.map(k=>`<td style="padding:5px 10px;border:1px solid #ddd;color:${r._warnings?.includes(k)?"red":"#222"}">${r[k]??""}</td>`).join("")).map(r=>`<tr>${r}</tr>`).join("");
      const html=`<div style="font-family:Arial,sans-serif"><div style="background:#1a3a6b;color:#fff;padding:16px;border-radius:8px 8px 0 0"><h2 style="margin:0">📦 Inspección MARTECH</h2><p style="margin:4px 0 0;opacity:.8;font-size:13px">${rows.length} línea(s) · ${allImgs.length} imagen(es)</p></div><div style="padding:16px;border:1px solid #ddd;border-top:none"><p style="color:#555;font-size:12px">Campos en <span style="color:red;font-weight:600">rojo</span> requieren verificación.</p><table style="border-collapse:collapse;font-size:12px;width:100%"><thead><tr>${COLUMNS.map(c=>`<th style="padding:6px 10px;background:#f0f6ff;border:1px solid #ddd;text-align:left">${c}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table></div></div>`;
      const imgAtts = await Promise.all(allImgs.slice(0,8).map(async(f,i)=>({name:f.name||`img_${i+1}.jpg`,type:f.type||"image/jpeg",b64:await toB64(f)})));
      await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:"Send the email exactly as specified using Gmail.",messages:[{role:"user",content:`Send email via Gmail:\nTo: ${FIXED_EMAIL}\nSubject: Inspección Material MARTECH - ${new Date().toLocaleDateString("es-MX")}\nHTML Body: ${html}\nAttachment 1: filename=MARTECH.csv, mimeType=text/csv, data=${csvB64}\n${imgAtts.map((a,i)=>`Attachment ${i+2}: filename=${a.name}, mimeType=${a.type}, data=${a.b64}`).join("\n")}`}],mcp_servers:[{type:"url",url:"https://gmail.mcp.claude.com/mcp",name:"gmail-mcp"}]})});
      setEmailMsg(`✅ Correo enviado a ${FIXED_EMAIL}`);
    } catch(e){setEmailMsg("❌ Error: "+e.message);}
    finally{setLoading(false);}
  };

  // ─── UI ───────────────────────────────────────────────────────────────────
  const s = { bg:"linear-gradient(135deg,#0a1628 0%,#0f2347 60%,#0a1628 100%)", card:"rgba(255,255,255,0.04)", border:"rgba(99,155,255,0.2)" };

  return (
    <div style={{minHeight:"100vh",background:s.bg,fontFamily:"'Segoe UI',system-ui,sans-serif",padding:"20px 14px"}}>
      <div style={{maxWidth:860,margin:"0 auto"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
          <div style={{width:42,height:42,borderRadius:10,background:"linear-gradient(135deg,#2563eb,#1d4ed8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:"0 4px 14px rgba(37,99,235,0.4)"}}>📦</div>
          <div><h1 style={{margin:0,color:"#fff",fontSize:20,fontWeight:700}}>MARTECH Inspector</h1><p style={{margin:0,color:"#64748b",fontSize:12}}>Extracción automática de datos logísticos</p></div>
        </div>

        {/* Phase indicators */}
        <div style={{display:"flex",gap:6,marginBottom:20}}>
          {["Tipo","Documentos","Bultos","Resultado"].map((l,i)=>(
            <div key={i} style={{flex:1,padding:"8px 4px",textAlign:"center",borderRadius:8,background:phase===i+1?"rgba(37,99,235,0.25)":phase>i+1?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.03)",border:`1px solid ${phase===i+1?"rgba(37,99,235,0.5)":phase>i+1?"rgba(34,197,94,0.3)":s.border}`,transition:"all 0.3s"}}>
              <div style={{fontSize:16}}>{phase>i+1?"✅":["1️⃣","2️⃣","3️⃣","4️⃣"][i]}</div>
              <div style={{color:phase===i+1?"#93c5fd":phase>i+1?"#4ade80":"#475569",fontSize:11,marginTop:2,fontWeight:phase===i+1?600:400}}>{l}</div>
            </div>
          ))}
        </div>

        {/* Loading overlay */}
        {loading && (
          <div style={{background:"rgba(37,99,235,0.1)",border:`1px solid ${s.border}`,borderRadius:12,padding:"18px",textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:26,marginBottom:6}}>⚙️</div>
            <p style={{color:"#94a3b8",margin:0,fontSize:14}}>{loadMsg}</p>
          </div>
        )}

        {/* ── Phase 1: Tipo ── */}
        {phase===1 && !loading && (
          <div style={{background:s.card,border:`1px solid ${s.border}`,borderRadius:16,padding:24}}>
            <h2 style={{color:"#e2e8f0",fontSize:16,margin:"0 0 18px",fontWeight:600}}>¿Qué tipo de material vas a inspeccionar?</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[{id:"materia_prima",icon:"🧪",title:"Materia Prima",desc:"No requiere Marca, Modelo ni Serie"},{id:"maquinaria",icon:"⚙️",title:"Maquinaria",desc:"Incluye Marca, Modelo y Número de Serie"}].map(opt=>(
                <button key={opt.id} onClick={()=>{setTipo(opt.id);setPhase(2);}} style={{background:tipo===opt.id?"rgba(37,99,235,0.2)":"rgba(255,255,255,0.03)",border:`2px solid ${tipo===opt.id?"#2563eb":s.border}`,borderRadius:12,padding:"20px 16px",cursor:"pointer",textAlign:"left",transition:"all 0.2s"}}>
                  <div style={{fontSize:28,marginBottom:8}}>{opt.icon}</div>
                  <div style={{color:"#e2e8f0",fontWeight:600,fontSize:14,marginBottom:4}}>{opt.title}</div>
                  <div style={{color:"#64748b",fontSize:12}}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Phase 2: Documentos ── */}
        {phase===2 && !loading && (
          <div style={{background:s.card,border:`1px solid ${s.border}`,borderRadius:16,padding:24,display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <h2 style={{color:"#e2e8f0",fontSize:16,margin:0,fontWeight:600}}>📄 Sube Packing List y etiquetas del transportista</h2>
              <span style={{background:"rgba(37,99,235,0.2)",color:"#60a5fa",fontSize:11,padding:"3px 10px",borderRadius:20,fontWeight:600}}>{tipo==="maquinaria"?"Maquinaria":"Materia Prima"}</span>
            </div>
            <p style={{color:"#64748b",fontSize:13,margin:0}}>Puedes subir todas las imágenes juntas (packing lists + etiquetas del carrier).</p>
            <DropZone onFiles={f=>addFiles(f,setP2imgs,setP2prevs)} label="Arrastra o toca para seleccionar imágenes" />
            <Thumbs previews={p2prevs} onRemove={i=>removeFile(i,setP2imgs,setP2prevs)} />
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <Btn onClick={runPhase2} disabled={!p2imgs.length}>🔍 Analizar documentos ({p2imgs.length})</Btn>
              <Btn onClick={()=>{setRows([]);setPhase(4);}} outline color="#94a3b8">Saltar a resultados sin Fase 3</Btn>
            </div>
          </div>
        )}

        {/* ── Phase 3: Bultos ── */}
        {phase===3 && !loading && rows.length>0 && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:s.card,border:`1px solid ${s.border}`,borderRadius:16,padding:20}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <h2 style={{color:"#e2e8f0",fontSize:15,margin:0,fontWeight:600}}>📦 Bulto {bultoIdx+1} de {rows.length}</h2>
                <Btn onClick={()=>setPhase(4)} outline color="#94a3b8">Finalizar sin más bultos</Btn>
              </div>
              <p style={{color:"#64748b",fontSize:13,margin:"0 0 12px"}}>Sube las imágenes del bulto {bultoIdx+1}. Pueden ser varias fotos del mismo bulto.</p>
              <DropZone onFiles={f=>addFiles(f,setP3imgs,setP3prevs)} label={`Imágenes del bulto ${bultoIdx+1}`} />
              <Thumbs previews={p3prevs} onRemove={i=>removeFile(i,setP3imgs,setP3prevs)} />
              <div style={{marginTop:12}}>
                <Btn onClick={runPhase3} disabled={!p3imgs.length}>✅ Verificar bulto {bultoIdx+1}</Btn>
              </div>
            </div>
            <div style={{background:s.card,border:`1px solid ${s.border}`,borderRadius:12,padding:16}}>
              <p style={{color:"#94a3b8",fontSize:12,margin:"0 0 10px",fontWeight:600}}>Vista previa de líneas registradas</p>
              <ResultTable rows={rows} setRows={setRows} tipo={tipo} />
            </div>
          </div>
        )}

        {/* ── Phase 4: Resultado ── */}
        {phase===4 && (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:s.card,border:`1px solid ${s.border}`,borderRadius:16,padding:20}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <h2 style={{color:"#e2e8f0",fontSize:15,margin:0,fontWeight:600}}>✅ Datos finales — {rows.length} línea(s)</h2>
                <span style={{color:"#64748b",fontSize:12}}>{Object.values(rows[0]||{}).filter(v=>v!=null&&!Array.isArray(v)).length} campos llenados</span>
              </div>
              <p style={{color:"#64748b",fontSize:12,margin:"0 0 12px"}}>Puedes editar cualquier campo directamente en la tabla. Los campos en <span style={{color:"#f87171"}}>rojo</span> requieren verificación.</p>
              <ResultTable rows={rows} setRows={setRows} tipo={tipo} />
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
                <Btn onClick={handleDownload} color="#16a34a">⬇️ Descargar CSV</Btn>
                <Btn onClick={handleEmail} color="#2563eb">📧 Enviar a {FIXED_EMAIL}</Btn>
                <Btn onClick={()=>{setPhase(1);setTipo(null);setRows([]);setP2imgs([]);setP2prevs([]);setP3imgs([]);setP3prevs([]);setAllImgs([]);setBultoIdx(0);setEmailMsg("");}} outline color="#94a3b8">🔄 Nueva inspección</Btn>
              </div>
              {emailMsg && <p style={{color:emailMsg.startsWith("✅")?"#4ade80":"#f87171",fontSize:13,margin:"10px 0 0",fontWeight:500}}>{emailMsg}</p>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
