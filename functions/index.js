const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {setGlobalOptions} = require("firebase-functions");
const logger = require("firebase-functions/logger");

setGlobalOptions({maxInstances: 10});

// La clave se guarda como "secret" de Firebase (ver INSTRUCCIONES.md).
// Nunca queda escrita en este archivo ni en el repositorio.
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const GPT_MODEL = "gpt-4o-mini";
const MAX_TOKENS = 450;
const MAX_HISTORY_MESSAGES = 30; // límite anti-abuso

exports.chatCompletion = onRequest(
    {
      secrets: [OPENAI_API_KEY],
      cors: true,
      region: "us-central1",
    },
    async (req, res) => {
      if (req.method !== "POST") {
        return res.status(405).json({error: "Método no permitido"});
      }

      const {systemPrompt, messages} = req.body || {};

      if (typeof systemPrompt !== "string" || !systemPrompt.trim()) {
        return res.status(400).json({error: "Falta systemPrompt"});
      }
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({error: "Falta el historial de mensajes"});
      }
      if (messages.length > MAX_HISTORY_MESSAGES) {
        return res.status(400).json({error: "Historial demasiado largo"});
      }
      const formatoValido = messages.every(
          (m) => m && (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string",
      );
      if (!formatoValido) {
        return res.status(400).json({error: "Formato de mensajes inválido"});
      }

      try {
        const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY.value()}`,
              },
              body: JSON.stringify({
                model: GPT_MODEL,
                max_tokens: MAX_TOKENS,
                temperature: 0.75,
                messages: [
                  {role: "system", content: systemPrompt},
                  ...messages,
                ],
              }),
            },
        );

        const data = await response.json();

        if (!response.ok) {
          logger.error("Error de OpenAI:", data);
          return res.status(response.status).json({
            error: data.error && data.error.message ?
              data.error.message :
              "Error al contactar OpenAI",
          });
        }

        const reply = data.choices &&
          data.choices[0] &&
          data.choices[0].message &&
          data.choices[0].message.content ?
          data.choices[0].message.content.trim() :
          null;

        if (!reply) {
          return res.status(502).json({error: "Respuesta vacía de OpenAI"});
        }

        return res.status(200).json({reply});
      } catch (err) {
        logger.error("Error interno:", err);
        return res.status(500).json({error: "Error interno del servidor"});
      }
    },
);
