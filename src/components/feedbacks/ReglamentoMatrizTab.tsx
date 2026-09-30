"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ArticuloReglamento, FaltaConfig, FuenteArticulo } from "@/lib/types";

/**
 * Consulta y edición de la matriz de faltas y del reglamento — para cuando
 * Recursos Humanos cambie la política, sin tener que tocar código ni SQL.
 * El texto de los artículos es lo que la IA usa en modo técnico: cualquier
 * edición aquí se refleja de inmediato en los próximos feedbacks.
 */
export function ReglamentoMatrizTab({
  tipos,
  articulos,
  onChanged,
}: {
  tipos: FaltaConfig[];
  articulos: ArticuloReglamento[];
  onChanged: () => void;
}) {
  const [sub, setSub] = useState<"tipos" | "articulos">("tipos");

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <SubTabBtn active={sub === "tipos"} onClick={() => setSub("tipos")}>
          Tipos de falta y escalera
        </SubTabBtn>
        <SubTabBtn active={sub === "articulos"} onClick={() => setSub("articulos")}>
          Artículos del reglamento
        </SubTabBtn>
      </div>
      {sub === "tipos" ? (
        <TiposTable tipos={tipos} articulos={articulos} onChanged={onChanged} />
      ) : (
        <ArticulosTable articulos={articulos} onChanged={onChanged} />
      )}
    </div>
  );
}

function SubTabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-1.5 rounded-md text-[12.5px] font-medium border transition-colors " +
        (active ? "bg-brand text-white border-brand" : "bg-white border-line hover:bg-paper")
      }
    >
      {children}
    </button>
  );
}

// ---------- Tipos de falta ----------

function TiposTable({
  tipos,
  articulos,
  onChanged,
}: {
  tipos: FaltaConfig[];
  articulos: ArticuloReglamento[];
  onChanged: () => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <div className="bg-panel border border-line rounded-[10px] p-5 overflow-x-auto">
      <p className="text-[12px] text-muted mb-3">
        La escalera es la secuencia de acciones (1.ª vez, 2.ª vez…) que sugiere el sistema. Los artículos vinculados
        son los que cita el modo técnico para este tipo de falta.
      </p>
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="text-left border-b border-line text-[11px] uppercase tracking-wider text-muted">
            <th className="pb-2 pr-3">Tipo</th>
            <th className="pb-2 pr-3">Escalera</th>
            <th className="pb-2 pr-3">Artículos</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody>
          {tipos.map((t) => (
            <TipoRow
              key={t.tipo_id}
              tipo={t}
              articulos={articulos}
              editando={editando === t.tipo_id}
              onEditar={() => setEditando(t.tipo_id)}
              onCerrar={() => setEditando(null)}
              onChanged={onChanged}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TipoRow({
  tipo,
  articulos,
  editando,
  onEditar,
  onCerrar,
  onChanged,
}: {
  tipo: FaltaConfig;
  articulos: ArticuloReglamento[];
  editando: boolean;
  onEditar: () => void;
  onCerrar: () => void;
  onChanged: () => void;
}) {
  const [nombre, setNombre] = useState(tipo.nombre);
  const [ladder, setLadder] = useState<string[]>(tipo.ladder);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set(tipo.articulos_relacionados));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function actualizarPaso(i: number, valor: string) {
    setLadder((prev) => prev.map((p, idx) => (idx === i ? valor : p)));
  }
  function quitarPaso(i: number) {
    setLadder((prev) => prev.filter((_, idx) => idx !== i));
  }
  function agregarPaso() {
    setLadder((prev) => [...prev, ""]);
  }
  function toggleArticulo(id: number) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function guardar() {
    setError(null);
    const ladderLimpio = ladder.map((p) => p.trim()).filter(Boolean);
    if (ladderLimpio.length === 0) {
      setError("La escalera necesita al menos un paso.");
      return;
    }
    setSaving(true);
    const { error: err } = await supabase
      .from("faltas_config")
      .update({
        nombre: nombre.trim(),
        ladder: ladderLimpio,
        articulos_relacionados: Array.from(seleccionados),
      })
      .eq("tipo_id", tipo.tipo_id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onChanged();
    onCerrar();
  }

  if (!editando) {
    return (
      <tr className="border-b border-line/60 last:border-0 align-top">
        <td className="py-2.5 pr-3">{tipo.nombre}</td>
        <td className="py-2.5 pr-3 text-[12px] text-muted">{tipo.ladder.join(" → ")}</td>
        <td className="py-2.5 pr-3 text-[12px] text-muted">
          {articulos.filter((a) => tipo.articulos_relacionados.includes(a.id)).map((a) => a.numero).join(", ") || "—"}
        </td>
        <td className="py-2.5 text-right">
          <button type="button" onClick={onEditar} className="text-xs px-2 py-1 border border-line rounded bg-white hover:bg-paper">
            Editar
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-line/60 last:border-0 align-top bg-brand/5">
      <td className="py-2.5 pr-3" colSpan={4}>
        <div className="space-y-2.5">
          <div>
            <label className="block text-[10.5px] text-muted uppercase tracking-wider mb-1">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-2 py-1.5 border border-line rounded bg-white text-sm"
            />
          </div>
          <div>
            <label className="block text-[10.5px] text-muted uppercase tracking-wider mb-1">
              Escalera (en orden: 1.ª vez, 2.ª vez…)
            </label>
            {ladder.map((paso, i) => (
              <div key={i} className="flex gap-1.5 mb-1">
                <span className="text-[11px] text-muted w-4 pt-1.5">{i + 1}.</span>
                <input
                  type="text"
                  value={paso}
                  onChange={(e) => actualizarPaso(i, e.target.value)}
                  className="flex-1 px-2 py-1 border border-line rounded bg-white text-sm"
                />
                <button type="button" onClick={() => quitarPaso(i)} className="text-warn text-xs px-1">
                  ✕
                </button>
              </div>
            ))}
            <button type="button" onClick={agregarPaso} className="text-[11.5px] text-brand hover:underline">
              + Agregar paso
            </button>
          </div>
          <div>
            <label className="block text-[10.5px] text-muted uppercase tracking-wider mb-1">
              Artículos que cita el modo técnico
            </label>
            <div className="flex flex-wrap gap-2">
              {articulos.map((a) => (
                <label key={a.id} className="flex items-center gap-1 text-[11.5px] bg-white border border-line rounded px-2 py-1 cursor-pointer">
                  <input type="checkbox" checked={seleccionados.has(a.id)} onChange={() => toggleArticulo(a.id)} />
                  {a.fuente} {a.numero}
                </label>
              ))}
              {articulos.length === 0 && <span className="text-[11.5px] text-muted">No hay artículos cargados todavía.</span>}
            </div>
          </div>
          {error && <p className="text-xs text-warn">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onCerrar} className="text-xs px-2.5 py-1.5 border border-line rounded bg-white hover:bg-paper">
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={saving}
              className="text-xs px-2.5 py-1.5 bg-brand text-white rounded font-semibold hover:bg-brand-light disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ---------- Artículos del reglamento ----------

function ArticulosTable({ articulos, onChanged }: { articulos: ArticuloReglamento[]; onChanged: () => void }) {
  const [editando, setEditando] = useState<number | "nuevo" | null>(null);

  return (
    <div className="bg-panel border border-line rounded-[10px] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] text-muted max-w-xl">
          Texto exacto que usa el modo técnico — cópialo tal cual del reglamento vigente. La IA nunca inventa este
          texto, solo lo que quede guardado aquí.
        </p>
        <button
          type="button"
          onClick={() => setEditando("nuevo")}
          className="text-xs px-2.5 py-1.5 bg-brand text-white rounded font-semibold hover:bg-brand-light shrink-0"
        >
          + Nuevo artículo
        </button>
      </div>

      {editando === "nuevo" && (
        <ArticuloForm articulo={null} onCancel={() => setEditando(null)} onSaved={() => { setEditando(null); onChanged(); }} />
      )}

      <div className="space-y-2 mt-3">
        {articulos.map((a) =>
          editando === a.id ? (
            <ArticuloForm
              key={a.id}
              articulo={a}
              onCancel={() => setEditando(null)}
              onSaved={() => { setEditando(null); onChanged(); }}
            />
          ) : (
            <div key={a.id} className="border border-line rounded-md p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-semibold text-brand uppercase tracking-wider">
                    {a.fuente} — Artículo {a.numero}
                  </span>
                  {a.titulo && <span className="text-[11px] text-muted"> · {a.titulo}</span>}
                </div>
                <button type="button" onClick={() => setEditando(a.id)} className="text-xs px-2 py-1 border border-line rounded bg-white hover:bg-paper shrink-0">
                  Editar
                </button>
              </div>
              <p className="text-[12.5px] mt-1.5">{a.texto}</p>
            </div>
          ),
        )}
        {articulos.length === 0 && editando !== "nuevo" && (
          <p className="text-sm text-muted text-center py-6">Aún no hay artículos cargados.</p>
        )}
      </div>
    </div>
  );
}

function ArticuloForm({
  articulo,
  onCancel,
  onSaved,
}: {
  articulo: ArticuloReglamento | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [fuente, setFuente] = useState<FuenteArticulo>(articulo?.fuente ?? "RIT");
  const [numero, setNumero] = useState(articulo?.numero ?? "");
  const [titulo, setTitulo] = useState(articulo?.titulo ?? "");
  const [texto, setTexto] = useState(articulo?.texto ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    if (!numero.trim() || !texto.trim()) {
      setError("Completa el número y el texto del artículo.");
      return;
    }
    setSaving(true);
    const payload = { fuente, numero: numero.trim(), titulo: titulo.trim() || null, texto: texto.trim() };
    const { error: err } = articulo
      ? await supabase.from("reglamento_articulos").update(payload).eq("id", articulo.id)
      : await supabase.from("reglamento_articulos").insert(payload);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved();
  }

  async function eliminar() {
    if (!articulo) return;
    if (!confirm(`¿Eliminar el Artículo ${articulo.numero}? Si algún tipo de falta lo tiene vinculado, dejará de citarlo.`)) return;
    setSaving(true);
    const { error: err } = await supabase.from("reglamento_articulos").delete().eq("id", articulo.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved();
  }

  return (
    <div className="border border-brand/30 bg-brand/5 rounded-md p-3 mb-2">
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <label className="block text-[10.5px] text-muted uppercase tracking-wider mb-1">Fuente</label>
          <select value={fuente} onChange={(e) => setFuente(e.target.value as FuenteArticulo)} className="w-full px-2 py-1.5 border border-line rounded bg-white text-sm">
            <option value="RIT">RIT (Reglamento Interno)</option>
            <option value="CST">CST (Código Sustantivo)</option>
          </select>
        </div>
        <div>
          <label className="block text-[10.5px] text-muted uppercase tracking-wider mb-1">Número</label>
          <input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ej: 64 o 65.2"
            className="w-full px-2 py-1.5 border border-line rounded bg-white text-sm" />
        </div>
        <div>
          <label className="block text-[10.5px] text-muted uppercase tracking-wider mb-1">Título (opcional)</label>
          <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)}
            className="w-full px-2 py-1.5 border border-line rounded bg-white text-sm" />
        </div>
      </div>
      <label className="block text-[10.5px] text-muted uppercase tracking-wider mb-1">Texto exacto del artículo</label>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        placeholder="Transcribe el artículo tal como está en el documento oficial"
        className="w-full px-2 py-1.5 border border-line rounded bg-white text-sm resize-y"
      />
      {error && <p className="text-xs text-warn mt-1">{error}</p>}
      <div className="flex gap-2 mt-2">
        <button type="button" onClick={onCancel} className="text-xs px-2.5 py-1.5 border border-line rounded bg-white hover:bg-paper">
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={saving}
          className="text-xs px-2.5 py-1.5 bg-brand text-white rounded font-semibold hover:bg-brand-light disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        {articulo && (
          <button type="button" onClick={eliminar} disabled={saving} className="text-xs px-2.5 py-1.5 border border-warn text-warn rounded bg-white hover:bg-warn-soft ml-auto">
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}
