// Edge Function: generar-feedback-contenido
//
// Recibe los datos de un retardo/falta y le pide a Claude que redacte los tres
// campos libres del Formato de Feedback oficial (Descripción de la Situación,
// Comentarios del Jefe Inmediato y Plan de Acción) para que jefatura los
// revise y ajuste antes de descargar el PDF.
//
// System prompt portado del artifact original — la clave está en la regla de
// NUNCA mencionar términos del sistema (bitácora, ocurrencia, matriz…) para
// que suene a documento firmado por un humano de RRHH, no a salida de app.
//
// Modo técnico/básico (Reglamento Interno de Trabajo de Skechers Colombia):
// la IA NUNCA recibe ni debe inventar el texto de un artículo — solo el
// NÚMERO y la FUENTE (RIT/CST) de los artículos ya verificados que el
// cliente resuelve desde `reglamento_articulos`. El texto completo del
// artículo se muestra aparte, tal cual está en la base, nunca generado.
// Así, lo máximo que puede hacer mal la IA es mencionar un número que no le
// dimos — nunca inventar contenido legal.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { contextoEmpresa } from "../_shared/contexto-empresa.ts";

const MODEL = "claude-haiku-4-5-20251001";

const systemPrompt = (CONTEXTO_EMPRESA: string, tecnico: boolean) =>
  `${CONTEXTO_EMPRESA}

TAREA: eres un profesional de recursos humanos de esta tienda que redacta el contenido de un 'Formato de Feedback' oficial en papel, listo para entregarse físicamente al colaborador. Escribe como se escribiría a mano en ese formato impreso: lenguaje natural de recursos humanos, con los hechos concretos (fechas, horas, nombres) que se te den. NUNCA menciones software, sistemas de bitácora, 'matriz de faltas', 'ocurrencia', 'vigencia', ni ningún término técnico o administrativo interno del sistema de gestión — eso nunca debe aparecer en el documento que lee el colaborador. (Sí puedes mencionar plataformas operativas del CONTEXTO como GeoVictoria si la situación lo amerita.)

Responde ÚNICAMENTE con un JSON con las claves:
- situacion (string, MUY PUNTUAL Y BREVE, máximo 25 palabras, UNA sola frase directa que indique qué pasó, cuándo y el dato concreto — sin rodeos, sin justificaciones, sin adjetivos, solo el hecho objetivo)
- comentarioJefe (string, hasta 90 palabras, escrito en PRIMERA PERSONA por el jefe inmediato dirigiéndose al colaborador — un comentario cercano pero profesional que dé contexto práctico y prevención a futuro)
- planAccion (string, hasta 70 palabras, compromisos concretos y verificables de ambas partes)
${
  tecnico
    ? `- fundamento (string, hasta 35 palabras, EXCLUSIVAMENTE menciona por su número y fuente los artículos que se te dieron — ej. "Conforme al Artículo 64 del Reglamento Interno de Trabajo." — NUNCA cites un número de artículo que no se te haya dado explícitamente, NUNCA inventes ni parafrasees el contenido del artículo, NUNCA cites el Código Sustantivo del Trabajo salvo que se te haya dado explícitamente)`
    : `- fundamento (string vacío "" siempre — este documento NO debe citar artículos ni normas)`
}

Reglas de caracteres: usa SOLO letras del alfabeto español (á é í ó ú ñ ü ¿ ¡), dígitos y puntuación estándar (. , : ; ! ? ' " ( ) - / %). NO uses símbolos matemáticos (≥, ≤, ≠), guiones tipográficos (— –), comillas curly (' ' " "), bullets (•), flechas, ni caracteres Unicode fuera del rango Latin-1 — la fuente del PDF final no los soporta.

No inventes hechos que no estén en los datos dados. No agregues texto fuera del JSON.`;

type ArticuloRef = { fuente: string; numero: string };

type Body = {
  falta_nombre?: string;
  falta_tipo_id?: string;
  colaborador?: string;
  fecha?: string;
  minutos?: number | null;
  observacion?: string;
  ocurrencia?: number;
  modo?: "tecnico" | "basico";
  excusa_suficiente?: boolean;
  detalle_excusa?: string;
  accion_sugerida?: string;
  accion_aplicada?: string;
  justificacion_ajuste?: string;
  articulos?: ArticuloRef[];
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!url || !anonKey || !anthropicKey) {
    return json({ error: "Faltan variables de entorno." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Falta encabezado Authorization." }, 401);

  const supabaseAsUser = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabaseAsUser.auth.getUser();
  if (userErr || !user) return json({ error: "Sesión inválida o expirada." }, 401);

  const { data: caller } = await supabaseAsUser
    .from("personal")
    .select("rol")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!caller || caller.rol !== "jefatura") {
    return json({ error: "Solo jefatura puede generar feedback." }, 403);
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Cuerpo inválido." }, 400);
  }

  // Técnico solo si hay artículos Y no hay excusa suficiente (Art. 64: la
  // sanción — y por tanto su fundamento — aplica "sin excusa suficiente").
  const articulos = Array.isArray(body.articulos) ? body.articulos : [];
  const tecnico = body.modo === "tecnico" && !body.excusa_suficiente && articulos.length > 0;

  const hayAjuste =
    body.accion_aplicada != null &&
    body.accion_sugerida != null &&
    body.accion_aplicada !== body.accion_sugerida;

  const esLlegadaTarde = (body.falta_tipo_id || "").startsWith("llegada");
  const userMsg =
    `Situación a documentar (uso interno para redactar, no debe aparecer citado literalmente):
- Motivo general: ${body.falta_nombre ?? ""}
- Colaborador: ${body.colaborador ?? ""}
- Fecha del hecho: ${body.fecha ?? ""}
${body.minutos != null ? `- Minutos de retraso: ${body.minutos}\n` : ""}- Es una reincidencia: ${
      (body.ocurrencia ?? 1) > 1
        ? `sí, van ${body.ocurrencia} veces en el periodo reciente`
        : "no, es la primera vez"
    }
- Contexto de la situación dado por jefatura: ${body.observacion?.trim() || "sin contexto adicional, básate solo en los datos anteriores"}
${esLlegadaTarde ? "- Recuerda: el horario de la tienda se publica todos los viernes con anticipación para la semana siguiente." : ""}
${body.excusa_suficiente ? `- El colaborador presentó una excusa que jefatura considera suficiente: ${body.detalle_excusa?.trim() || "(sin detalle)"}. Esto NO es una falta disciplinaria sancionable — redacta en tono de seguimiento/recordatorio, nunca de sanción.` : ""}
${
  hayAjuste
    ? `- Jefatura ajustó la medida respecto a lo que sugiere la escalera habitual (de "${body.accion_sugerida}" a "${body.accion_aplicada}"), con esta justificación: ${body.justificacion_ajuste?.trim() || "(sin detalle)"}. Menciona este ajuste y su motivo en el comentario o el plan de acción, en tono profesional.`
    : ""
}
${
  tecnico
    ? `- Artículos a citar por número (NO tienen más texto que este, no inventes contenido adicional): ${articulos
        .map((a) => `${a.fuente === "RIT" ? "Artículo" : "Artículo (C.S.T.)"} ${a.numero}`)
        .join("; ")}`
    : ""
}

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
      max_tokens: 1200,
      system: systemPrompt(await contextoEmpresa(supabaseAsUser), tecnico),
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

  return json({
    situacion: String(parsed.situacion ?? ""),
    comentarioJefe: String(parsed.comentarioJefe ?? ""),
    planAccion: String(parsed.planAccion ?? ""),
    fundamento: tecnico ? String(parsed.fundamento ?? "") : "",
  });
});

function tryParseJson(text: string): Record<string, unknown> | null {
  const attempts: string[] = [];
  attempts.push(text.trim());
  attempts.push(text.replace(/```(?:json|JSON)?[\r\n]*/g, "").replace(/```/g, "").trim());
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s >= 0 && e > s) attempts.push(text.slice(s, e + 1));
  for (const c of attempts) {
    try {
      const p = JSON.parse(c);
      if (p && typeof p === "object") return p as Record<string, unknown>;
    } catch {
      /* try next */
    }
  }
  return null;
}
