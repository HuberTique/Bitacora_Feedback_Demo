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
 * Identidad resuelta por el buscador: una persona ya registrada, o una
 * nueva (aún no existe en `personal` — este módulo no tiene una pantalla
 * de Personal aparte, así que la única forma de que alguien exista es
 * siendo el sujeto de un feedback/reconocimiento). El padre decide cuándo
 * crear la fila (normalmente al guardar, no mientras se escribe).
 */
export type IdentidadPersona =
  | { tipo: "existente"; personaId: string }
  | { tipo: "nueva"; cm: string; nombre: string; cedula: string | null };

/**
 * Identificación con DOS datos obligatorios — CM y nombre completo — igual
 * de estricta que la lectura de imágenes. El CM manda: si el nombre se
 * escribe distinto pero el CM coincide con alguien ya registrado, igual se
 * resuelve esa persona (con aviso). Si el CM no coincide con nadie, no es
 * un error — es una persona nueva, que se crea al guardar.
 */
export function PersonaBuscador({
  roster,
  value,
  onChange,
}: {
  roster: RosterPublico[];
  value: IdentidadPersona | null;
  onChange: (identidad: IdentidadPersona | null) => void;
}) {
  const [cm, setCm] = useState("");
  const [nombre, setNombre] = useState("");
  const [cedula, setCedula] = useState("");
  const [sugerencias, setSugerencias] = useState<RosterPublico[]>([]);

  const seleccionadaExistente =
    value?.tipo === "existente" ? roster.find((p) => p.id === value.personaId) ?? null : null;

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

  // Solo se resuelve algo cuando AMBOS datos están escritos.
  useEffect(() => {
    const cmDigits = soloDigitos(cm);
    const nombreOk = nombre.trim().length > 0;
    if (coincidePorCm && nombreOk) {
      onChange({ tipo: "existente", personaId: coincidePorCm.id });
    } else if (cmDigits.length >= 4 && nombreOk && !coincidePorCm) {
      onChange({ tipo: "nueva", cm: cmDigits, nombre: nombre.trim(), cedula: cedula.trim() || null });
    } else if (value) {
      onChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coincidePorCm, nombre, cedula, cm]);

  function elegirSugerencia(p: RosterPublico) {
    setNombre(p.nombre);
    setCm(p.codigo ?? "");
    setSugerencias([]);
  }

  function cambiar() {
    setCm("");
    setNombre("");
    setCedula("");
    onChange(null);
  }

  if (seleccionadaExistente) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border border-line rounded-md bg-white text-sm">
        <span className="font-mono text-xs text-muted">{seleccionadaExistente.codigo ?? "sin CM"}</span>
        <span className="flex-1">{seleccionadaExistente.nombre}</span>
        <span className="text-muted text-xs">{seleccionadaExistente.cargo}</span>
        <button type="button" onClick={cambiar} className="text-muted hover:text-warn text-xs px-1" title="Cambiar persona">
          ✕
        </button>
      </div>
    );
  }

  if (value?.tipo === "nueva") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border border-operaciones/40 bg-operaciones/5 rounded-md text-sm">
        <span className="font-mono text-xs text-muted">{value.cm}</span>
        <span className="flex-1">{value.nombre}</span>
        <span className="text-[10px] font-semibold text-operaciones uppercase tracking-wider">Nueva</span>
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
            className="w-full px-3 py-2 border border-line rounded-md bg-white text-sm"
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

      {cm && soloDigitos(cm).length > 0 && soloDigitos(cm).length < 4 && (
        <p className="text-[11px] text-muted">El CM se ve muy corto — revísalo.</p>
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
      {!coincidePorCm && soloDigitos(cm).length >= 4 && nombre.trim() && (
        <p className="text-[11px] text-muted">
          No hay nadie con ese CM todavía — se registrará como persona nueva al guardar.
        </p>
      )}
    </div>
  );
}
