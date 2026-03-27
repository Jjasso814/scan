import { useState, useCallback } from "react";
import emailjs from "@emailjs/browser";

const LOGO = "/logo.png";
const FIXED_EMAIL = import.meta.env.VITE_FIXED_EMAIL || "juan.jasso@groupcca.com";
const MODEL = "claude-sonnet-4-5-20250929";
const C = { navy:"#0d2b5e", orange:"#f47920", white:"#ffffff", lightBg:"#f4f7fc", border:"#dce6f5", text:"#1a2a4a", muted:"#6b7fa3", red:"#dc2626", green:"#16a34a" };
const COLUMNS = ["Entry No","No. Inspección","Fecha","Importador","Proveedor","Transportista","Trailer","Referencia","Po","No. Parte","Descripción","Descripción Ingles","Cantidad","U.M.","Peso Lbs","Peso Kgs","Bultos","Tipo Bulto","Valor","Origen","Fracción","Locación","Tracking","Marca","Modelo","Serie","Observaciones"];
const COL_KEYS = ["entry_no","no_inspeccion","fecha","importador","proveedor","transportista","trailer","referencia","po","no_parte","descripcion","descripcion_ingles","cantidad","um","peso_lbs","peso_kgs","bultos","tipo_bulto","valor","origen","fraccion","locacion","tracking","marca","modelo","serie","observaciones"];
const MAQ_ONLY = ["marca","modelo","serie"];
const PHASE2_PROMPT = `Eres experto en documentos logísticos. Analiza las imágenes (Packing Lists y etiquetas de transportista) y devuelve SOLO este JSON sin texto extra ni markdown: {"vendor":null,"po":null,"importador":null,"origen":null,"carrier":null,"tracking":null,"bultos_total":1,"peso_lbs":null,"peso_kgs":null,"tipo_bulto":null,"partes":[{"no_parte":null,"descripcion":null,"descripcion_ingles":null,"cantidad":null,"um":null,"valor":null,"fraccion":null,"marca":null,"modelo":null,"serie":null}]} REGLAS: 1) Solo JSON. 2) Una entrada en partes por cada aparición de número de parte en el Packing List. 3) null si no aparece. 4) Prefija con "⚠️ " si tienes duda sobre el valor. 5) Para bultos_total busca "1 of 3" o "Pkg 1/3" → el número total es 3.`;

const toB64 = f => new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(f);});
const toUrl = f => new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f);});

async function callClaude(system, images, text) {
  const imgs = await Promise.all(images.map(async f=>({type:"image",source:{type:"base64",media_type:f.type||"image/jpeg",data:await toB64(f)}})));
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, images: imgs, text })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error del servidor: " + res.status);
  }
  const d = await res.json();
  const raw = d.content?.find(b=>b.type==="text")?.text||"";
  return JSON.parse(raw.replace(/```json|```/g,"").trim());
}

function buildRows(ext, tipo) {
  const base={entry_no:null,no_inspeccion:null,fecha:new Date().toLocaleDateString("es-MX"),importador:ext.importador,proveedor:ext.vendor,transportista:ext.carrier,trailer:null,referencia:null,po:ext.po,peso_lbs:ext.peso_lbs,peso_kgs:ext.peso_kgs,tipo_bulto:ext.tipo_bulto,valor:null,origen:ext.origen,fraccion:null,locacion:null,tracking:ext.tracking,marca:null,modelo:null,serie:null,observaciones:null};
  let rows=ext.partes.map(p=>({...base,no_parte:p.no_parte,descripcion:p.descripcion,descripcion_ingles:p.descripcion_ingles,cantidad:p.cantidad,um:p.um,valor:p.valor,fraccion:p.fraccion,bultos:ext.bultos_total,marca:tipo==="maquinaria"?p.marca:null,modelo:tipo==="maquinaria"?p.modelo:null,serie:tipo==="maquinaria"?p.serie:null,_warnings:[],_tipo:tipo}));
  if(rows.length===1&&ext.bultos_total>1){const o=rows[0];const cpb=o.cantidad?Math.floor(o.cantidad/ext.bultos_total):null;rows=Array.from({length:ext.bultos_total},(_,i)=>({...o,cantidad:cpb,bultos:1,_bulto:i+1,_total:ext.bultos_total,_cantTotal:o.cantidad}));}
  return rows;
}

function buildCSV(rows){
  const h=COLUMNS.join(",");
  const body=rows.map(r=>COL_KEYS.map(k=>{const v=r[k];return v==null?"":`"${String(v).replace(/"/g,'""')}"`;}).join(",")).join("\n");
  return "\uFEFF"+h+"\n"+body;
}

function Header() {
  return (
    <div style={{background:C.navy,padding:"14px 20px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 2px 12px rgba(13,43,94,0.15)"}}>
      <img src={LOGO} style={{width:42,height:42,borderRadius:10}} alt="IDEAScan" />
      <div>
        <div style={{color:C.white,fontWeight:700,fontSize:18,letterSpacing:"-0.3px"}}>IDEA<span style={{color:C.orange}}>Scan</span></div>
        <div style={{color:"rgba(255,255,255,0.55)",fontSize:11}}>Inspección de material inteligente</div>
      </div>
    </div>
  );
}

function StepBar({ phase }) {
  const steps=["Tipo","Documentos","Bultos","Resultado"];
  return (
    <div style={{display:"flex",background:C.white,borderBottom:`1px solid ${C.border}`,padding:"0 16px"}}>
      {steps.map((s,i)=>{
        const active=phase===i+1; const done=phase>i+1;
        return (
          <div key={i} style={{flex:1,padding:"10px 4px",textAlign:"center",borderBottom:`3px solid ${active?C.orange:done?C.navy:"transparent"}`,transition:"all 0.2s"}}>
            <div style={{fontSize:15}}>{done?"✅":["1️⃣","2️⃣","3️⃣","4️⃣"][i]}</div>
            <div style={{fontSize:10,fontWeight:active?700:400,color:active?C.orange:done?C.navy:C.muted,marginTop:2}}>{s}</div>
          </div>
        );
      })}
    </div>
  );
}

function Card({ children, style={} }) {
  return <div style={{background:C.white,borderRadius:16,padding:20,boxShadow:"0 2px 12px rgba(13,43,94,0.07)",border:`1px solid ${C.border}`,...style}}>{children}</div>;
}

function PrimaryBtn({ onClick, disabled, children }) {
  return <button onClick={onClick} disabled={disabled} style={{background:disabled?"#c0cce0":C.navy,color:C.white,border:"none",borderRadius:10,padding:"13px 22px",fontSize:14,fontWeight:700,cursor:disabled?"not-allowed":"pointer",transition:"all 0.15s",width:"100%"}}>{children}</button>;
}

function GhostBtn({ onClick, children }) {
  return <button onClick={onClick} style={{background:"transparent",color:C.muted,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"11px 18px",fontSize:13,fontWeight:600,cursor:"pointer",width:"100%"}}>{children}</button>;
}

function DropZone({ onFiles, label, sublabel }) {
  const [drag,setDrag]=useState(false);
  const idG=`g-${label}`; const idC=`c-${label}`;
  return (
    <div>
      <div onDrop={e=>{e.preventDefault();setDrag(false);onFiles(Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith("image/")));}} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} style={{border:`2px dashed ${drag?C.orange:C.border}`,borderRadius:12,padding:"18px 12px",textAlign:"center",background:drag?"#fff7f0":C.lightBg,transition:"all 0.2s",marginBottom:10}}>
        <div style={{fontSize:28,marginBottom:6}}>🖼️</div>
        <p style={{color:C.text,margin:0,fontSize:13,fontWeight:600}}>{label}</p>
        {sublabel&&<p style={{color:C.muted,margin:"4px 0 0",fontSize:12}}>{sublabel}</p>}
        <input id={idG} type="file" multiple accept="image/*" style={{display:"none"}} onChange={e=>onFiles(Array.from(e.target.files))} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <button onClick={()=>document.getElementById(idC).click()} style={{background:C.orange,color:C.white,border:"none",borderRadius:10,padding:"13px 8px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>📷 Tomar foto</button>
        <button onClick={()=>document.getElementById(idG).click()} style={{background:C.white,color:C.navy,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"13px 8px",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>🗂️ Desde galería</button>
      </div>
      <input id={idC} type="file" accept="image/*" capture="environment" multiple style={{display:"none"}} onChange={e=>onFiles(Array.from(e.target.files))} />
    </div>
  );
}

function Thumbs({ previews, onRemove }) {
  if(!previews.length)return null;
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(72px,1fr))",gap:8,marginTop:12}}>
      {previews.map((src,i)=>(
        <div key={i} style={{position:"relative"}}>
          <img src={src} style={{width:"100%",aspectRatio:"1/1",objectFit:"cover",borderRadius:8,border:`1px solid ${C.border}`}} />
          <button onClick={()=>onRemove(i)} style={{position:"absolute",top:3,right:3,background:"rgba(220,38,38,0.9)",color:"#fff",border:"none",borderRadius:"50%",width:18,height:18,fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>✕</button>
        </div>
      ))}
    </div>
  );
}

function InfoBadge({ label, value }) {
  if(!value)return null;
  return (
    <div style={{display:"inline-flex",flexDirection:"column",background:C.lightBg,borderRadius:8,padding:"6px 12px",border:`1px solid ${C.border}`}}>
      <span style={{fontSize:10,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</span>
      <span style={{fontSize:13,color:C.text,fontWeight:600,marginTop:1}}>{value}</span>
    </div>
  );
}

function ResultTable({ rows, setRows, tipo }) {
  const vKeys=tipo==="maquinaria"?COL_KEYS:COL_KEYS.filter(k=>!MAQ_ONLY.includes(k));
  const vCols=COLUMNS.filter((_,i)=>!MAQ_ONLY.includes(COL_KEYS[i])||tipo==="maquinaria");
  return (
    <div style={{overflowX:"auto",borderRadius:10,border:`1px solid ${C.border}`}}>
      <table style={{borderCollapse:"collapse",fontSize:12,minWidth:600,width:"100%"}}>
        <thead><tr>{vCols.map(c=><th key={c} style={{padding:"8px 10px",background:C.navy,color:C.white,whiteSpace:"nowrap",textAlign:"left",fontSize:11}}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((row,ri)=>(
            <tr key={ri} style={{background:ri%2===0?C.white:C.lightBg,borderBottom:`1px solid ${C.border}`}}>
              {vKeys.map(k=>{
                const val=row[k];
                const isWarn=val&&String(val).startsWith("⚠️");
                const isRed=row._warnings?.includes(k);
                return (
                  <td key={k} style={{padding:"5px 8px"}}>
                    <input value={val??""} onChange={e=>{const nr=[...rows];nr[ri]={...nr[ri],[k]:e.target.value};setRows(nr);}} style={{background:"transparent",border:"none",color:isRed?C.red:isWarn?"#ea580c":C.text,width:"100%",fontSize:12,outline:"none",minWidth:50,fontWeight:isRed||isWarn?600:400}} />
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

export default function App() {
  const [phase,setPhase]=useState(1);
  const [tipo,setTipo]=useState(null);
  const [p2imgs,setP2imgs]=useState([]);
  const [p2prevs,setP2prevs]=useState([]);
  const [rows,setRows]=useState([]);
  const [p3imgs,setP3imgs]=useState([]);
  const [p3prevs,setP3prevs]=useState([]);
  const [bultoIdx,setBultoIdx]=useState(0);
  const [loading,setLoading]=useState(false);
  const [loadMsg,setLoadMsg]=useState("");
  const [emailMsg,setEmailMsg]=useState("");
  const [allImgs,setAllImgs]=useState([]);
  const [extracted,setExtracted]=useState(null);

  const addFiles=useCallback(async(files,setI,setP)=>{setI(p=>[...p,...files]);const urls=await Promise.all(files.map(toUrl));setP(p=>[...p,...urls]);setAllImgs(p=>[...p,...files]);},[]);
  const removeFile=(i,setI,setP)=>{setI(p=>p.filter((_,j)=>j!==i));setP(p=>p.filter((_,j)=>j!==i));};

  const runPhase2=async()=>{
    if(!p2imgs.length)return;
    setLoading(true);setLoadMsg("Analizando Packing List y etiqueta del transportista...");
    try{
      const ext=await callClaude(PHASE2_PROMPT,p2imgs,"Extrae toda la información y devuelve el JSON.");
      setExtracted(ext);
      setRows(buildRows(ext,tipo));
      setPhase(3);
    }catch(e){alert("Error al analizar imágenes: "+e.message);}
    finally{setLoading(false);}
  };

  const runPhase3=async()=>{
    if(!p3imgs.length)return;
    setLoading(true);setLoadMsg(`Verificando bulto ${bultoIdx+1}...`);
    try{
      const prompt=`Eres experto en verificación de material logístico. Analiza las imágenes de UN SOLO BULTO. Devuelve SOLO este JSON: {"no_parte_detectado":null,"cantidad_detectada":null${tipo==="maquinaria"?',"marca_detectada":null,"modelo_detectado":null,"serie_detectada":null':''},"confianza":"alta","observaciones":null} Líneas registradas: ${JSON.stringify(rows.map(r=>({no_parte:r.no_parte,cantidad:r.cantidad})))} Solo JSON. null si no puedes leer. Prefija con ⚠️ si tienes duda.`;
      const res=await callClaude(prompt,p3imgs,"Analiza este bulto.");
      const newRows=[...rows];
      const idx=newRows.findIndex(r=>r.no_parte===res.no_parte_detectado);
      const target=idx>=0?idx:bultoIdx;
      const row={...newRows[target]};
      const warns=[...(row._warnings||[])];
      if(res.cantidad_detectada!==null&&res.cantidad_detectada!==row.cantidad){row.cantidad=res.cantidad_detectada;if(!warns.includes("cantidad"))warns.push("cantidad");}
      if(tipo==="maquinaria"){if(res.marca_detectada)row.marca=res.marca_detectada;if(res.modelo_detectado)row.modelo=res.modelo_detectado;if(res.serie_detectada)row.serie=res.serie_detectada;}
      if(res.observaciones)row.observaciones=res.observaciones;
      if(res.confianza==="baja"&&!warns.includes("no_parte"))warns.push("no_parte");
      row._warnings=warns;
      newRows[target]=row;
      const cantTotal=newRows[0]?._cantTotal;
      if(cantTotal){const suma=newRows.reduce((s,r)=>s+(Number(r.cantidad)||0),0);if(suma===cantTotal)newRows.forEach(r=>r._warnings=r._warnings?.filter(w=>w!=="cantidad"));}
      setRows(newRows);
      setP3imgs([]);setP3prevs([]);
      if(bultoIdx<rows.length-1){setBultoIdx(i=>i+1);}else{setPhase(4);}
    }catch(e){alert("Error al analizar bulto: "+e.message);}
    finally{setLoading(false);}
  };

  const handleDownload=()=>{
    const csv=buildCSV(rows);
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=`IDEAScan_${new Date().toLocaleDateString("es-MX").replace(/\//g,"-")}.csv`;
    a.click();URL.revokeObjectURL(url);
  };

  const handleEmail=async()=>{
    setLoading(true);setLoadMsg("Enviando correo...");
    try{
      const csv=buildCSV(rows);
      const tableRows=rows.map(r=>COL_KEYS.map(k=>`<td style="padding:5px 10px;border:1px solid #ddd;color:${r._warnings?.includes(k)?"red":"#222"}">${r[k]??""}</td>`).join("")).map(r=>`<tr>${r}</tr>`).join("");
      const htmlBody=`<div style="font-family:Arial,sans-serif"><div style="background:#0d2b5e;color:#fff;padding:16px;border-radius:8px 8px 0 0"><span style="font-size:18px;font-weight:700">IDEA<span style="color:#f47920">Scan</span></span><p style="margin:4px 0 0;opacity:.7;font-size:12px">${rows.length} línea(s) · ${allImgs.length} imagen(es)</p></div><div style="padding:16px;border:1px solid #dce6f5;border-top:none"><p style="font-size:12px;color:#555">Campos en <span style="color:red;font-weight:600">rojo</span> requieren verificación manual.</p><table style="border-collapse:collapse;font-size:12px;width:100%"><thead><tr>${COLUMNS.map(c=>`<th style="padding:6px 10px;background:#f4f7fc;border:1px solid #dce6f5;text-align:left">${c}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table></div></div>`;

      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          to_email: FIXED_EMAIL,
          subject: `IDEAScan — Inspección Material ${new Date().toLocaleDateString("es-MX")}`,
          html_body: htmlBody,
          csv_data: csv,
          lines_count: rows.length,
          images_count: allImgs.length,
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      );

      setEmailMsg(`✅ Correo enviado a ${FIXED_EMAIL}`);
    }catch(e){
      console.error("Email error:", e);
      setEmailMsg("❌ Error al enviar: "+(e?.text||e?.message||"Verifica la configuración de EmailJS"));
    }finally{setLoading(false);}
  };

  const reset=()=>{setPhase(1);setTipo(null);setRows([]);setP2imgs([]);setP2prevs([]);setP3imgs([]);setP3prevs([]);setAllImgs([]);setBultoIdx(0);setEmailMsg("");setExtracted(null);};

  return (
    <div style={{minHeight:"100vh",background:C.lightBg,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <Header />
      <StepBar phase={phase} />
      <div style={{maxWidth:600,margin:"0 auto",padding:"16px 14px",display:"flex",flexDirection:"column",gap:14}}>
        {loading&&(
          <Card style={{textAlign:"center",padding:"24px"}}>
            <div style={{fontSize:32,marginBottom:10}}>⚙️</div>
            <p style={{color:C.navy,fontWeight:700,margin:"0 0 4px",fontSize:15}}>{loadMsg}</p>
            <p style={{color:C.muted,margin:0,fontSize:12}}>Esto puede tardar unos segundos...</p>
          </Card>
        )}

        {phase===1&&!loading&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{textAlign:"center",padding:"24px 16px 8px"}}>
              <img src={LOGO} style={{width:80,height:80,borderRadius:18,marginBottom:12,boxShadow:"0 4px 20px rgba(13,43,94,0.15)"}} />
              <h1 style={{color:C.navy,fontSize:22,fontWeight:800,margin:"0 0 6px"}}>IDEA<span style={{color:C.orange}}>Scan</span></h1>
              <p style={{color:C.muted,fontSize:14,margin:0}}>Inspección de material inteligente</p>
            </div>
            <Card>
              <h2 style={{color:C.navy,fontSize:16,fontWeight:700,margin:"0 0 6px"}}>¿Qué tipo de material vas a inspeccionar?</h2>
              <p style={{color:C.muted,fontSize:13,margin:"0 0 16px"}}>Selecciona una opción para continuar.</p>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[{id:"materia_prima",icon:"🧪",title:"Materia Prima",desc:"Insumos, componentes y materiales. No requiere Marca, Modelo ni Serie."},{id:"maquinaria",icon:"⚙️",title:"Maquinaria / Equipo",desc:"Máquinas y equipos. Incluye Marca, Modelo y Número de Serie."}].map(opt=>(
                  <button key={opt.id} onClick={()=>{setTipo(opt.id);setPhase(2);}} style={{background:C.white,border:`2px solid ${C.border}`,borderRadius:12,padding:"16px",cursor:"pointer",textAlign:"left",transition:"all 0.2s",display:"flex",alignItems:"center",gap:14}}>
                    <div style={{fontSize:32,flexShrink:0}}>{opt.icon}</div>
                    <div><div style={{color:C.navy,fontWeight:700,fontSize:15}}>{opt.title}</div><div style={{color:C.muted,fontSize:12,marginTop:3}}>{opt.desc}</div></div>
                    <div style={{marginLeft:"auto",color:C.orange,fontSize:20}}>›</div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}

        {phase===2&&!loading&&(
          <Card>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <img src={LOGO} style={{width:36,height:36,borderRadius:8}} />
              <div>
                <h2 style={{color:C.navy,fontSize:16,fontWeight:700,margin:0}}>Paso 2 — Documentos de envío</h2>
                <span style={{background:tipo==="maquinaria"?"#fff3e0":"#e8f0fe",color:tipo==="maquinaria"?C.orange:C.navy,fontSize:11,padding:"2px 8px",borderRadius:20,fontWeight:600}}>{tipo==="maquinaria"?"⚙️ Maquinaria":"🧪 Materia Prima"}</span>
              </div>
            </div>
            <p style={{color:C.text,fontSize:13,margin:"0 0 16px",lineHeight:1.6}}>Toma o sube las fotos del <strong>Packing List</strong> y de la <strong>etiqueta del transportista</strong> (Carrier Label). Puedes subir todas las fotos juntas.</p>
            <DropZone onFiles={f=>addFiles(f,setP2imgs,setP2prevs)} label="Sube tus imágenes aquí" sublabel="Packing List · Carrier Label · Etiquetas" />
            <Thumbs previews={p2prevs} onRemove={i=>removeFile(i,setP2imgs,setP2prevs)} />
            {p2imgs.length>0&&<div style={{marginTop:14,display:"flex",flexDirection:"column",gap:8}}>
              <PrimaryBtn onClick={runPhase2}>🔍 Analizar {p2imgs.length} imagen{p2imgs.length>1?"es":""}</PrimaryBtn>
              <GhostBtn onClick={()=>{setRows([]);setPhase(4);}}>Ir directo a resultados (sin análisis)</GhostBtn>
            </div>}
          </Card>
        )}

        {phase===3&&!loading&&rows.length>0&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <Card>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <img src={LOGO} style={{width:36,height:36,borderRadius:8}} />
                <div>
                  <h2 style={{color:C.navy,fontSize:16,fontWeight:700,margin:0}}>Paso 3 — Verificar bultos</h2>
                  <p style={{color:C.muted,fontSize:12,margin:0}}>Bulto {bultoIdx+1} de {rows.length}</p>
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
                {extracted&&<><InfoBadge label="Proveedor" value={extracted.vendor} /><InfoBadge label="Tracking" value={extracted.tracking} /><InfoBadge label="Carrier" value={extracted.carrier} /></>}
              </div>
              <div style={{background:"#fff7f0",border:"1px solid #fde8d0",borderRadius:10,padding:"10px 14px",marginBottom:14}}>
                <p style={{margin:0,fontSize:13,color:"#92400e"}}>📦 Toma las fotos del <strong>bulto {bultoIdx+1}</strong>. La app identificará a qué número de parte corresponde y verificará la cantidad.</p>
              </div>
              <DropZone onFiles={f=>addFiles(f,setP3imgs,setP3prevs)} label={`Fotos del bulto ${bultoIdx+1}`} sublabel="Etiquetas, código de barras, contenido visible" />
              <Thumbs previews={p3prevs} onRemove={i=>removeFile(i,setP3imgs,setP3prevs)} />
              <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:8}}>
                <PrimaryBtn onClick={runPhase3} disabled={!p3imgs.length}>✅ Verificar bulto {bultoIdx+1}</PrimaryBtn>
                <GhostBtn onClick={()=>setPhase(4)}>Finalizar sin verificar más bultos</GhostBtn>
              </div>
            </Card>
            <Card>
              <p style={{color:C.navy,fontSize:13,fontWeight:700,margin:"0 0 10px"}}>Vista previa de líneas registradas</p>
              <ResultTable rows={rows} setRows={setRows} tipo={tipo} />
            </Card>
          </div>
        )}

        {phase===4&&!loading&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <Card>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                <img src={LOGO} style={{width:36,height:36,borderRadius:8}} />
                <div>
                  <h2 style={{color:C.navy,fontSize:16,fontWeight:700,margin:0}}>Resultado final</h2>
                  <p style={{color:C.muted,fontSize:12,margin:0}}>{rows.length} línea(s) registrada(s)</p>
                </div>
              </div>
              {rows.some(r=>r._warnings?.length>0)&&(
                <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"10px 14px",margin:"12px 0"}}>
                  <p style={{margin:0,fontSize:13,color:C.red,fontWeight:600}}>⚠️ Hay campos en rojo que requieren verificación manual. Puedes editarlos directamente en la tabla.</p>
                </div>
              )}
            </Card>
            <Card style={{padding:0,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`}}>
                <p style={{margin:0,fontSize:13,color:C.navy,fontWeight:600}}>Campos en <span style={{color:C.red}}>rojo</span> = verificar · Puedes editar cualquier celda</p>
              </div>
              <div style={{padding:12,overflowX:"auto"}}>
                <ResultTable rows={rows} setRows={setRows} tipo={tipo} />
              </div>
            </Card>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <PrimaryBtn onClick={handleDownload}>⬇️ Descargar archivo Excel (CSV)</PrimaryBtn>
              <button onClick={handleEmail} style={{background:C.orange,color:C.white,border:"none",borderRadius:10,padding:"13px 22px",fontSize:14,fontWeight:700,cursor:"pointer",width:"100%"}}>📧 Enviar por correo a {FIXED_EMAIL}</button>
              <GhostBtn onClick={reset}>🔄 Nueva inspección</GhostBtn>
            </div>
            {emailMsg&&<div style={{background:emailMsg.startsWith("✅")?"#f0fdf4":"#fef2f2",border:`1px solid ${emailMsg.startsWith("✅")?"#bbf7d0":"#fecaca"}`,borderRadius:10,padding:"12px 16px"}}>
              <p style={{margin:0,fontSize:13,color:emailMsg.startsWith("✅")?C.green:C.red,fontWeight:600}}>{emailMsg}</p>
            </div>}
          </div>
        )}
      </div>
    </div>
  );
}
