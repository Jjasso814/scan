// api/sendmail.js — Envío de correo con CSV e imágenes adjuntas via Gmail SMTP
import nodemailer from "nodemailer";

const MAX_BODY_BYTES = 3_500_000; // 3.5 MB para no exceder límite de Vercel (4.5 MB)

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

  const { to, subject, text, csvData, csvFilename, images } = req.body || {};
  if (!csvData) return res.status(400).json({ error: "csvData requerido" });

  // Adjuntar CSV
  const attachments = [{
    filename: csvFilename || "IDEAScan.csv",
    content: Buffer.from(csvData, "utf8"),
    contentType: "text/csv; charset=utf-8",
  }];

  // Adjuntar imágenes (solo las que quepan dentro del límite de tamaño)
  let bytesUsados = Buffer.byteLength(csvData, "utf8");
  let imagenesAdjuntadas = 0;
  if (images && images.length > 0) {
    for (let i = 0; i < images.length; i++) {
      const buf = Buffer.from(images[i], "base64");
      if (bytesUsados + buf.length > MAX_BODY_BYTES) break;
      attachments.push({
        filename: `imagen_${i + 1}.jpg`,
        content: buf,
        contentType: "image/jpeg",
      });
      bytesUsados += buf.length;
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
    return res.status(200).json({ success: true, imagenesAdjuntadas });
  } catch (err) {
    console.error("sendmail error:", err);
    return res.status(500).json({ error: err.message });
  }
}
