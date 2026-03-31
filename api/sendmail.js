// api/sendmail.js — Envío de correo con CSV e imágenes adjuntas via Gmail SMTP
import nodemailer from "nodemailer";

const MAX_BODY_BYTES = 4_000_000; // 4 MB (calidad dinámica en cliente mantiene imágenes pequeñas; Vercel permite 4.5 MB)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    return res.status(500).json({
      error: "GMAIL_USER o GMAIL_APP_PASSWORD no configurados en Vercel → Settings → Environment Variables",
    });
  }

  const { to, subject, text, xlsxData, xlsxFilename, images } = req.body || {};
  if (!xlsxData) return res.status(400).json({ error: "xlsxData requerido" });

  // Adjuntar XLSX
  const attachments = [{
    filename: xlsxFilename || "IDEAScan.xlsx",
    content: Buffer.from(xlsxData, "base64"),
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }];

  // Adjuntar imágenes: ordenar por tamaño ascendente para incluir la mayor cantidad posible
  let bytesUsados = Buffer.from(xlsxData, "base64").length;
  let imagenesAdjuntadas = 0;
  if (images && images.length > 0) {
    // Construir buffers con índice original para reordenar después
    const imgBuffers = images.map((b64, i) => ({ i, buf: Buffer.from(b64, "base64") }));
    // Ordenar por tamaño ascendente: si hay presupuesto ajustado, caben más imágenes pequeñas
    imgBuffers.sort((a, b) => a.buf.length - b.buf.length);
    const incluidas = [];
    for (const item of imgBuffers) {
      if (bytesUsados + item.buf.length <= MAX_BODY_BYTES) {
        incluidas.push(item);
        bytesUsados += item.buf.length;
      }
    }
    // Reordenar por índice original para que los adjuntos lleguen en orden de captura
    incluidas.sort((a, b) => a.i - b.i);
    for (const { i, buf } of incluidas) {
      attachments.push({
        filename: `imagen_${i + 1}.jpg`,
        content: buf,
        contentType: "image/jpeg",
      });
      imagenesAdjuntadas++;
    }
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPass },
  });

  const notaImagenes = imagenesAdjuntadas < (images?.length || 0)
    ? `\n⚠️ Solo se adjuntaron ${imagenesAdjuntadas} de ${images.length} imágenes por límite de tamaño.`
    : "";

  try {
    await transporter.sendMail({
      from: `"IDEAScan" <${gmailUser}>`,
      to,
      subject,
      text: text + notaImagenes,
      attachments,
    });
    return res.status(200).json({ success: true, imagenesAdjuntadas, imagenesOmitidas: (images?.length || 0) - imagenesAdjuntadas });
  } catch (err) {
    console.error("sendmail error:", err);
    return res.status(500).json({ error: err.message });
  }
}
