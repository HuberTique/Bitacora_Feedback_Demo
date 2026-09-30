"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * /restablecer-clave — a donde llega el enlace que envía
 * supabase.auth.resetPasswordForEmail(). El cliente de Supabase detecta el
 * token de recuperación en la URL solo (detectSessionInUrl) y abre una
 * sesión temporal; mientras esa sesión exista, se puede llamar
 * updateUser({password}) sin pedir la clave anterior.
 */
export default function RestablecerClavePage() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [claveNueva, setClaveNueva] = useState("");
  const [claveConfirma, setClaveConfirma] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    // El evento PASSWORD_RECOVERY llega cuando el cliente procesa el enlace;
    // si la pestaña ya tenía sesión y se recarga aquí, getSession alcanza.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setListo(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setListo(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (claveNueva.length < 8 || !/[A-Za-z]/.test(claveNueva) || !/[0-9]/.test(claveNueva)) {
      setError("Mínimo 8 caracteres, con letras y números.");
      return;
    }
    if (claveNueva !== claveConfirma) {
      setError("Las claves no coinciden.");
      return;
    }
    setGuardando(true);
    const { error: updErr } = await supabase.auth.updateUser({ password: claveNueva });
    setGuardando(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setOk(true);
    setTimeout(() => router.replace("/login"), 1800);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-paper">
      <div className="bg-panel border border-line rounded-[10px] p-9 max-w-[420px] w-full shadow-sm">
        <h1 className="text-[20px] mb-1 font-display font-semibold">Definir clave nueva</h1>

        {!listo && !ok && (
          <p className="text-muted text-[13px] mt-3">
            Verificando el enlace… Si llegaste aquí sin venir del correo de recuperación, el enlace
            puede haber vencido —{" "}
            <button type="button" onClick={() => router.replace("/login")} className="text-brand hover:underline">
              vuelve a pedir uno nuevo
            </button>
            .
          </p>
        )}

        {listo && !ok && (
          <form onSubmit={onSubmit} className="mt-4">
            <Field label="Clave nueva">
              <input
                type="password"
                value={claveNueva}
                onChange={(e) => setClaveNueva(e.target.value)}
                className="w-full px-3 py-2.5 border border-line rounded-md bg-white text-sm"
                autoComplete="new-password"
                required
              />
              <p className="text-[11px] text-muted mt-1">Mínimo 8 caracteres, con letras y números.</p>
            </Field>
            <Field label="Confirmar clave nueva">
              <input
                type="password"
                value={claveConfirma}
                onChange={(e) => setClaveConfirma(e.target.value)}
                className="w-full px-3 py-2.5 border border-line rounded-md bg-white text-sm"
                autoComplete="new-password"
                required
              />
            </Field>
            {error && (
              <div className="bg-warn-soft text-warn border border-warn-border rounded-md px-3 py-2 text-xs mb-3.5">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={guardando}
              className="w-full py-3 bg-brand text-white rounded-md font-semibold text-sm disabled:opacity-50 hover:bg-brand-light transition-colors"
            >
              {guardando ? "Guardando…" : "Guardar clave nueva"}
            </button>
          </form>
        )}

        {ok && (
          <div className="bg-emerald-50 text-operaciones border border-emerald-200 rounded-md px-3 py-2 text-sm mt-4">
            Clave actualizada. Ya puedes entrar con tu correo y tu clave nueva.
          </div>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[12px] text-muted mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
