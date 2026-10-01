// Extrae un objeto JSON de la respuesta cruda de la IA. Intenta, en cascada:
//  1) JSON.parse directo.
//  2) Después de quitar fences de código markdown (```json ... ```).
//  3) Buscando el primer '{' y el último '}' del texto.
// Devuelve null si ninguna estrategia funciona.
//
// Repetido idéntico en las 4 Edge Functions de este módulo que le piden JSON
// a Claude (generar-feedback-contenido, generar-plan-trabajo,
// generar-reconocimiento-contenido, leer-retardos-imagen) — centralizado acá
// para no mantener 4 copias.
export function tryParseJson(text: string): Record<string, unknown> | null {
  const attempts: string[] = [];
  attempts.push(text.trim());
  attempts.push(
    text
      .replace(/```(?:json|JSON)?[\r\n]*/g, "")
      .replace(/```/g, "")
      .trim(),
  );
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s >= 0 && e > s) attempts.push(text.slice(s, e + 1));

  for (const candidate of attempts) {
    try {
      const p = JSON.parse(candidate);
      if (p && typeof p === "object") return p as Record<string, unknown>;
    } catch {
      // sigue con la próxima estrategia
    }
  }
  return null;
}
