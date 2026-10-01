export type Rol = "jefatura" | "asesor";

// Rol jerárquico: reemplaza la inferencia frágil desde texto libre de `cargo`.
// Se conserva aquí solo como clasificación de personas (roster) — los usos
// específicos de horarios/ventas del app completa no viven en este módulo
// aislado de Feedbacks.
export type RolJerarquico =
  | "jefe_tienda"
  | "subjefe"
  | "cajero"
  | "full_time"
  | "part_time";

export type Persona = {
  id: string;
  auth_user_id: string | null;
  nombre: string;
  codigo: string | null;
  cedula: string;
  cargo: string;
  rol: Rol;
  rol_jerarquico: RolJerarquico;
  activo: boolean;
  motivo_baja: string | null;
  fecha_baja: string | null;
  foto_path: string | null;
  created_at: string;
  updated_at: string;
};

export type RosterPublico = {
  id: string;
  nombre: string;
  cargo: string;
  rol: Rol;
  rol_jerarquico: RolJerarquico;
  foto_path: string | null;
  codigo: string | null; // CM — identifica a la persona igual que en Ventas
};

/** Convierte un id de persona al email sintético usado para Supabase Auth. */
export function emailFor(personaId: string): string {
  return `${personaId}@bitacora-tienda.local`;
}

// ---------- Feedbacks / Retardos ----------

export type FaltaConfig = {
  tipo_id: string;
  nombre: string;
  requiere_minutos: boolean;
  ladder: string[];
  posicion: number;
  articulos_relacionados: number[];
  requiere_descripcion: boolean; // ej. tipo "otro" — exige explicar la falta
};

export const ESTADOS_RETARDO = ["pendiente", "realizada"] as const;
export type EstadoRetardo = (typeof ESTADOS_RETARDO)[number];

export type Retardo = {
  id: string;
  persona_id: string;
  tipo_id: string;
  fecha: string;
  minutos: number | null;
  observacion: string;
  ocurrencia: number;
  accion: string; // acción sugerida por la escalera — nunca se sobrescribe
  estado: EstadoRetardo;
  registrado_por: string;
  created_at: string;
  updated_at: string;
  // Excusa suficiente (Art. 64 R.I.T.: la sanción aplica "sin excusa
  // suficiente") y ajuste justificado (parágrafo del mismo artículo).
  excusa_suficiente: boolean;
  detalle_excusa: string | null;
  accion_aplicada: string | null; // null = igual a `accion` (sin ajuste)
  justificacion_ajuste: string | null;
};

export function labelEstadoRetardo(e: EstadoRetardo): string {
  return e === "pendiente" ? "Pendiente" : "Realizada";
}

// ---------- Artículos del reglamento (modo técnico) ----------

export type FuenteArticulo = "RIT" | "CST";

export type ArticuloReglamento = {
  id: number;
  fuente: FuenteArticulo;
  numero: string;
  titulo: string | null;
  texto: string;
};

// ---------- Reconocimientos (feedback positivo) ----------

export type Reconocimiento = {
  id: string;
  persona_id: string;
  fecha: string;
  motivo: string;
  texto: string;
  estado: EstadoRetardo;
  registrado_por: string;
  created_at: string;
  updated_at: string;
};

// ---------- Notificaciones ----------

export type Notificacion = {
  id: string;
  tipo: string;
  destinatario_persona_id: string | null;
  destinatario_jefatura: boolean;
  mensaje: string;
  ref_fecha: string | null;
  ref_tabla: string | null;
  ref_id: string | null;
  leida: boolean;
  created_at: string;
};
