"use client";

import { useEffect, useMemo, useState } from "react";
import { matchPersonaPorNombre } from "@/lib/imagenIA";
import type { RosterPublico } from "@/lib/types";

const soloDigitos = (v: string) => v.replace(/\D/g, "");
const normalizar = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Identificación de persona con DOS datos obligatorios — CM y nombre
 * completo — igual de estricta que la lectura de imágenes (que también
 * extrae CM + nombre). El CM manda: si el nombre se escribe distinto pero
 * el CM coincide con alguien de Personal, igual se resuelve esa persona
 * (con aviso), para no perder el historial por un error de tipeo.
 */
export function PersonaBuscador({
  roster,
  value,
  onChange,
}: {
  roster: RosterPublico[];
  value: string; // persona_id resuelto, "" si aún no hay uno válido
  onChange: (personaId: string) => void;
}) {
  const [cm, setCm] = useState("");
  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [sugerencias, setSugerencias] = useState<RosterPublico[]>([]);
  const [manual, setManual] = useState(false); // true tras limpiar una selección ya resuelta

  const seleccionada = !manual ? roster.find((p) => p.id === value) ?? null : null;

  // Sugerencias por nombre mientras se escribe (para autocompletar CM).
  useEffect(() => {
    const q = normalizar(nombre);
    if (!q || q.length < 3) {
      setSugerencias([]);
      return;
    }
    const porNombre = roster.filter((p) => normalizar(p.nombre).includes(q));
    const aprox = matchPersonaPorNombre(nombre, roster);
    const vistos = new Set<string>();
    const out: RosterPublico[] = [];
    for (const p of [...porNombre, ...(aprox ? [aprox] : [])]) {
      if (!vistos.has(p.id)) {
        vistos.add(p.id);
        out.push(p);
      }
    }
    setSugerencias(out.slice(0, 6));
  }, [nombre, roster]);

  const coincidePorCm = useMemo(() => {
    const cmDigits = soloDigitos(cm);
    if (!cmDigits) return null;
    return roster.find((p) => p.codigo && soloDigitos(p.codigo) === cmDigits) ?? undefined;
  }, [cm, roster]);

  // Solo se resuelve la persona cuando AMBOS datos están escritos — CM por sí
  // solo no basta, es la validación cruzada la que da por buena la identidad.
  useEffect(() => {
    if (coincidePorCm && nombre.trim().length > 0) {
      onChange(coincidePorCm.id);
    } else if (value) {
      onChange("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coincidePorCm, nombre]);

  function elegirSugerencia(p: RosterPublico) {
    setNombre(p.nombre);
    setCm(p.codigo ?? "");
    setSugerencias([]);
  }

  function cambiar() {
    setManual(true);
    setCm("");
    setNombre("");
    setCedula("");
    onChange("");
  }

  if (seleccionada) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border border-line rounded-md bg-white text-sm">
        <span className="font-mono text-xs text-muted">{seleccionada.codigo ?? "sin CM"}</span>
        <span className="flex-1">{seleccionada.nombre}</span>
        <span className="text-muted text-xs">{seleccionada.cargo}</span>
        <button type="button" onClick={cambiar} className="text-muted hover:text-warn text-xs px-1" title="Cambiar persona">
          ✕
        </button>
      </div>
    );
  }

  const nombreNorm = normalizar(nombre);
  const nombreCoincideConCm =
    !coincidePorCm || !nombreNorm ? true : normalizar(coincidePorCm.nombre).includes(nombreNorm.split(" ")[0] || "");

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10.5px] text-muted uppercase tracking-wider mb-1">CM (obligatorio)</label>
          <input
            type="text"
            inputMode="numeric"
            value={cm}
            onChange={(e) => setCm(e.target.value)}
            placeholder="Código de empleado"
            className={
              "w-full px-3 py-2 border rounded-md bg-white text-sm " +
              (cm && !coincidePorCm ? "border-warn-border bg-warn-soft/40" : "border-line")
            }
          />
        </div>
        <div>
          <label className="block text-[10.5px] text-muted uppercase tracking-wider mb-1">Cédula (opcional)</label>
          <input
            type="text"
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
            placeholder="Si la tienes a mano"
            className="w-full px-3 py-2 border border-line rounded-md bg-white text-sm"
          />
        </div>
      </div>

      <div className="relative">
        <label className="block text-[10.5px] text-muted uppercase tracking-wider mb-1">Nombre completo (obligatorio)</label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre y apellidos"
          className="w-full px-3 py-2 border border-line rounded-md bg-white text-sm"
        />
        {sugerencias.length > 0 && !coincidePorCm && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-line rounded-md shadow-lg max-h-48 overflow-y-auto">
            {sugerencias.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={() => elegirSugerencia(p)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-paper"
              >
                <span className="font-mono text-[11px] text-muted w-14 shrink-0">{p.codigo ?? "—"}</span>
                <span className="flex-1 truncate">{p.nombre}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {cm && !coincidePorCm && (
        <p className="text-[11px] text-warn">Ese CM no está registrado en Personal — revísalo antes de continuar.</p>
      )}
      {coincidePorCm && !nombreCoincideConCm && (
        <p className="text-[11px] text-ventas">
          El CM {coincidePorCm.codigo} corresponde a <strong>{coincidePorCm.nombre}</strong>, distinto de lo que
          escribiste — se usa el CM (es el dato que manda) y queda asignado a esa persona.
        </p>
      )}
      {coincidePorCm && nombreCoincideConCm && cm && nombre && (
        <p className="text-[11px] text-operaciones">✓ CM y nombre coinciden con {coincidePorCm.nombre}.</p>
      )}
    </div>
  );
}
