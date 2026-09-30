"use client";

import { useMemo, useState } from "react";
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
 * Campo de búsqueda de persona por nombre O por CM — nunca un <select> con
 * la lista completa. Arranca vacío: jefatura tiene que elegir a propósito.
 * Si el nombre se escribe distinto o con errores, igual encuentra a la
 * persona por CM (coincidencia exacta) o por nombre aproximado (mismo
 * matcher que usa la lectura de imágenes), para que el historial de faltas
 * siempre quede ligado a la persona correcta.
 */
export function PersonaBuscador({
  roster,
  value,
  onChange,
  placeholder = "Nombre o CM de la persona…",
}: {
  roster: RosterPublico[];
  value: string; // persona_id, "" si no hay selección
  onChange: (personaId: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const seleccionada = roster.find((p) => p.id === value) ?? null;

  const resultados = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const qDigits = soloDigitos(q);
    const qNorm = normalizar(q);
    // 1) CM exacto o que empiece igual — máxima prioridad.
    const porCm = qDigits.length >= 2 ? roster.filter((p) => p.codigo && p.codigo.startsWith(qDigits)) : [];
    // 2) Nombre contiene el texto escrito.
    const porNombre = roster.filter((p) => normalizar(p.nombre).includes(qNorm));
    // 3) Aproximado (tolera errores de tipeo), solo si lo anterior no bastó.
    const aprox = matchPersonaPorNombre(q, roster);
    const vistos = new Set<string>();
    const out: RosterPublico[] = [];
    for (const p of [...porCm, ...porNombre, ...(aprox ? [aprox] : [])]) {
      if (!vistos.has(p.id)) {
        vistos.add(p.id);
        out.push(p);
      }
    }
    return out.slice(0, 8);
  }, [query, roster]);

  function elegir(p: RosterPublico) {
    onChange(p.id);
    setQuery("");
    setOpen(false);
  }

  if (seleccionada) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border border-line rounded-md bg-white text-sm">
        <span className="font-mono text-xs text-muted">{seleccionada.codigo ?? "sin CM"}</span>
        <span className="flex-1">{seleccionada.nombre}</span>
        <span className="text-muted text-xs">{seleccionada.cargo}</span>
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-muted hover:text-warn text-xs px-1"
          aria-label="Cambiar persona"
          title="Cambiar persona"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-warn-border bg-warn-soft/40 rounded-md text-sm"
      />
      {open && query.trim() && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-line rounded-md shadow-lg max-h-56 overflow-y-auto">
          {resultados.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted">
              Nadie en Personal coincide con &quot;{query}&quot; — revisa el nombre o el CM.
            </div>
          ) : (
            resultados.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={() => elegir(p)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-paper"
              >
                <span className="font-mono text-[11px] text-muted w-14 shrink-0">{p.codigo ?? "—"}</span>
                <span className="flex-1 truncate">{p.nombre}</span>
                <span className="text-muted text-[11px]">{p.cargo}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
