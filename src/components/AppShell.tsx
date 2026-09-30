"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";
import { NotificationBell } from "./NotificationBell";
import { useTienda } from "@/lib/tienda-config";
import type { Persona } from "@/lib/types";

type Tab = { href: string; label: string; roles: ("jefatura" | "asesor")[] };

// Versión aislada: un solo módulo (Feedbacks) y un solo usuario (jefatura).
// Los demás módulos del producto completo quedan suprimidos a propósito.
const TABS: Tab[] = [{ href: "/feedbacks", label: "Feedbacks", roles: ["jefatura"] }];

/** Logo de la empresa; si aún no se cargó ninguno, muestra sus iniciales en un círculo. */
function LogoEmpresa({ nombre, url }: { nombre: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- export estático, sin loader de imágenes
    return <img src={url} alt={nombre} className="w-8 h-8 rounded-full object-cover shrink-0 bg-white" />;
  }
  const iniciales = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <div className="w-8 h-8 rounded-full bg-white/15 text-white text-[12px] font-semibold flex items-center justify-center shrink-0">
      {iniciales || "·"}
    </div>
  );
}

export function AppShell({
  persona,
  children,
}: {
  persona: Persona;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const tienda = useTienda();
  const [oscuro, setOscuro] = useState(false);
  useEffect(() => {
    setOscuro(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);
  function alternarTema() {
    const nuevo = !oscuro;
    setOscuro(nuevo);
    if (nuevo) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    try {
      localStorage.setItem("tema", nuevo ? "dark" : "light");
    } catch {
      /* sin almacenamiento: el cambio vale solo para esta sesión */
    }
  }

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  const visibleTabs = TABS.filter((t) => t.roles.includes(persona.rol));

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <header className="bg-brand text-white flex flex-wrap items-center gap-x-3 sm:gap-x-6 px-4 sm:px-7 sm:h-[60px] shrink-0">
        <div className="flex items-center gap-2.5 pr-4 sm:pr-5 border-r border-white/15 h-[60px] shrink-0 mr-auto sm:mr-0">
          <LogoEmpresa nombre={tienda.nombre} url={tienda.logo_url} />
          <h1 className="text-[15px] m-0 text-white font-display font-semibold leading-tight">
            {tienda.nombre}
          </h1>
        </div>

        <nav className="flex items-center h-[46px] sm:h-[60px] order-last sm:order-none w-[calc(100%+2rem)] sm:w-auto sm:flex-1 overflow-x-auto -mx-4 px-2 sm:mx-0 sm:px-0 border-t border-white/10 sm:border-0">
          {visibleTabs.map((t) => {
            const active = pathname === t.href || pathname.startsWith(t.href + "/");
            return (
              <Link
                key={t.href}
                href={t.href}
                className={
                  "flex items-center px-3 sm:px-4 h-[46px] sm:h-[60px] text-[13.5px] font-medium border-b-[3px] whitespace-nowrap transition-colors " +
                  (active
                    ? "text-white border-white bg-white/8"
                    : "text-white/75 border-transparent hover:bg-white/6 hover:text-white")
                }
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <NotificationBell />
        <button
          type="button"
          onClick={alternarTema}
          title="Cambiar entre tema claro y oscuro"
          aria-label="Cambiar tema"
          className="text-base px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-md transition-colors shrink-0"
        >
          {oscuro ? "☀️" : "🌙"}
        </button>

        <div className="hidden sm:block text-[13px] text-white/70 truncate max-w-[180px]">
          {persona.nombre}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="text-xs px-3 py-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors shrink-0"
        >
          Cerrar sesión
        </button>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
