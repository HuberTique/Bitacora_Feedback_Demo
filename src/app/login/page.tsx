"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTienda } from "@/lib/tienda-config";
import { fullPath } from "@/lib/asset-path";

export default function LoginPage() {
  const router = useRouter();
  const tienda = useTienda();
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recuperarOpen, setRecuperarOpen] = useState(false);

  // Si ya hay sesión, salir directo a Feedbacks.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/feedbacks");
    });
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: clave,
    });
    setLoading(false);
    if (signErr) {
      setError(
        signErr.message === "Invalid login credentials"
          ? "Correo o clave incorrectos."
          : signErr.message,
      );
      return;
    }
    router.replace("/feedbacks");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-paper">
      <div className="bg-panel border border-line rounded-[10px] p-9 max-w-[420px] w-full shadow-sm">
        <span className="inline-block -rotate-[3deg] border-2 border-warn text-warn font-mono text-[11px] tracking-widest px-2.5 py-0.5 rounded uppercase mb-3.5">
          Acceso restringido
        </span>
        <h1 className="text-[22px] mb-1 font-display font-semibold">
          Feedbacks y Planes de Trabajo
        </h1>
        <p className="text-brand text-xs font-semibold uppercase tracking-wider mb-1">
          {tienda.nombre}
        </p>
        <p className="text-muted text-[13px] mb-6">
          Faltas, retardos y feedbacks del equipo.
        </p>

        {error && (
          <div className="bg-warn-soft text-warn border border-warn-border rounded-md px-3 py-2 text-xs mb-3.5">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <Field label="Correo">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full px-3 py-2.5 border border-line rounded-md bg-white text-sm"
              autoComplete="username"
              required
            />
          </Field>

          <Field label="Clave">
            <input
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 border border-line rounded-md bg-white text-sm"
              autoComplete="current-password"
              required
            />
          </Field>

          <button
            type="submit"
            disabled={loading || !email || !clave}
            className="w-full py-3 bg-brand text-white rounded-md font-semibold text-sm disabled:opacity-50 hover:bg-brand-light transition-colors"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setRecuperarOpen(true)}
          className="w-full text-center text-[12.5px] text-brand hover:underline mt-3"
        >
          ¿Olvidaste tu clave?
        </button>
      </div>

      {recuperarOpen && <RecuperarClaveModal onClose={() => setRecuperarOpen(false)} />}
    </main>
  );
}

function RecuperarClaveModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return;
    setEnviando(true);
    const { error: sendErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: fullPath("/restablecer-clave/"),
    });
    setEnviando(false);
    // Siempre mostramos el mismo mensaje exista o no una cuenta con ese
    // correo — así nadie puede usar este formulario para averiguar qué
    // correos están registrados.
    if (sendErr) {
      setError("No pude enviar el correo. Intenta de nuevo en un momento.");
      return;
    }
    setEnviado(true);
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-panel rounded-[10px] p-6 max-w-md w-full relative shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-muted hover:text-ink text-lg leading-none"
          aria-label="Cerrar"
        >
          ✕
        </button>
        <h3 className="font-display font-semibold text-base mb-1 pr-8">
          Recuperar clave
        </h3>

        {enviado ? (
          <p className="text-[13px] text-ink mt-3">
            Si <strong>{email.trim()}</strong> tiene una cuenta registrada, te enviamos un enlace
            para definir una clave nueva. Revisa tu bandeja de entrada (y la carpeta de spam) — el
            enlace vence pronto.
          </p>
        ) : (
          <>
            <p className="text-muted text-[12.5px] mb-4">
              Escribe el correo con el que ingresas. Te enviaremos un enlace para definir una clave
              nueva — nadie más la ve ni la escribe por ti.
            </p>
            <form onSubmit={onSubmit}>
              <Field label="Correo">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full px-3 py-2.5 border border-line rounded-md bg-white text-sm"
                  autoComplete="email"
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
                disabled={enviando || !email.trim()}
                className="w-full py-2.5 bg-brand text-white rounded-md font-semibold text-sm disabled:opacity-50 hover:bg-brand-light transition-colors"
              >
                {enviando ? "Enviando…" : "Enviar enlace"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[12px] text-muted mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}
