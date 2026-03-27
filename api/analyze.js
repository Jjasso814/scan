export default async function handler(req, res) {
  // Solo aceptar POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key no configurada en Vercel" });
  }

  try {
    const { system, images, text } = req.body;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
                            model: "claude-sonnet-4-5",
        max_tokens: 2000,
        system,
        messages: [
          {
            role: "user",
            content: [
              ...images,
              { type: "text", text },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errData?.error?.message || "Error de Anthropic: " + response.status,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("analyze handler error:", error);
    return res.status(500).json({ error: error.message || "Error interno del servidor" });
  }
}
