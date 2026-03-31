// netlify/functions/sendmail.js — Envío de correo con XLSX e imágenes adjuntas via Gmail SMTP
import nodemailer from "nodemailer";

const MAX_BODY_BYTES = 6_000_000; // 6 MB — Netlify permite hasta 6 MB por request (vs 4.5 MB en Vercel)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "GMAIL_USER o GMAIL_APP_PASSWORD no configurados en Netlify → Site configuration → Environment variables" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Body no es JSON válido" }) };
  }

  const { to, subject, text, xlsxData, xlsxFilename, images } = body;
  if (!xlsxData) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "xlsxData requerido" }) };
  }

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
    const imgBuffers = images.map((b64, i) => ({ i, buf: Buffer.from(b64, "base64") }));
    imgBuffers.sort((a, b) => a.buf.length - b.buf.length);
    const incluidas = [];
    for (const item of imgBuffers) {
      if (bytesUsados + item.buf.length <= MAX_BODY_BYTES) {
        incluidas.push(item);
        bytesUsados += item.buf.length;
      }
    }
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
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, imagenesAdjuntadas, imagenesOmitidas: (images?.length || 0) - imagenesAdjuntadas }),
    };
  } catch (err) {
    console.error("sendmail error:", err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
