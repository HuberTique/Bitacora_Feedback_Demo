// Edge Function: generar-reconocimiento-contenido
//
// Feedback POSITIVO — flujo separado de las faltas: sin escalera, sin
// artículos, sin fundamento legal. Redacta el texto de un reconocimiento
// para entregar al colaborador.

import { corsHeaders, json } from "../_shared/cors.ts";
import { contextoEmpresa } from "../_shared/contexto-empresa.ts";
import { requireJefatura } from "../_shared/auth-jefatura.ts";
import { tryParseJson } from "../_shared/parse-json.ts";

const MODEL = "claude-haiku-4-5-20251001";

const systemPrompt = (CONTEXTO_EMPRESA: string) =>
  `${CONTEXTO_EMPRESA}

TAREA: eres un profesional de recursos humanos de esta tienda que redacta el texto de un reconocimiento POSITIVO para entregar físicamente a un colaborador — no es un documento disciplinario. Escribe en tono cercano, profesional y genuino, sin sonar genérico ni exagerado. NUNCA menciones software, sistemas de bitácora, ni ningún término técnico o administrativo interno.

Responde ÚNICAMENTE con un JSON con las claves:
- texto (string, hasta 90 palabras, en PRIMERA PERSONA por el jefe/DSM dirigiéndose al colaborador, reconociendo concretamente el motivo dado — evita frases vacías como "sigue así", sé específico sobre qué hizo bien y por qué importa)

Reglas de caracteres: usa SOLO letras del alfabeto español (á é í ó ú ñ ü ¿ ¡), dígitos y puntuación estándar (. , : ; ! ? ' " ( ) - / %). NO uses símbolos matemáticos, guiones tipográficos (— –), comillas curly (' ' " "), bullets (•), flechas, ni caracteres Unicode fuera del rango Latin-1.

No inventes hechos que no estén en los datos dados. No agregues texto fuera del JSON.`;

type Body = {
  colaborador?: string;
  fecha?: string;
  motivo?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return json({ error: "Falta la variable de entorno ANTHROPIC_API_KEY." }, 500);
  }

  const auth = await requireJefatura(req, "Solo jefatura puede generar reconocimientos.");
  if (!auth.ok) return auth.response;
  const { supabaseAsUser } = auth;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Cuerpo inválido." }, 400);
  }

  const motivo = body.motivo?.trim();
  if (!motivo) return json({ error: "Falta el motivo del reconocimiento." }, 400);

  const userMsg = `Colaborador: ${body.colaborador ?? ""}
Fecha: ${body.fecha ?? ""}
Motivo del reconocimiento: ${motivo}

Genera el JSON solicitado.`;

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: systemPrompt(await contextoEmpresa(supabaseAsUser)),
      messages: [{ role: "user", content: userMsg }],
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    return json(
      { error: `Error de Anthropic (${anthropicRes.status}): ${errText.slice(0, 400)}` },
      502,
    );
  }

  const anthropicJson = await anthropicRes.json();
  const text: string = anthropicJson?.content?.[0]?.text ?? "";
  const parsed = tryParseJson(text);
  if (!parsed) {
    return json(
      { error: `No pude interpretar la respuesta de la IA: ${text.slice(0, 400)}` },
      502,
    );
  }

  return json({ texto: String(parsed.texto ?? "") });
});
