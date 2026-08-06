/**
 * Tipos escritos a mano para el alcance de Fases 1 y 2 (núcleo multiempresa,
 * eventos e inscripciones). Cuando tengas el proyecto enlazado con la Supabase CLI,
 * reemplaza este archivo por el generado con:
 *   npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
 * (mantén el mismo nombre de export `Database` para no romper los imports).
 */

export type EstadoEmpresa = "activa" | "suspendida" | "prueba";
export type RolPlataforma = "super_admin" | "usuario";
export type RolEmpresa = "admin_empresa" | "operador";
export type EstadoMembresia = "invitado" | "activo" | "suspendido";
/** Filtro principal del listado público y chip de la tarjeta de carrera. */
export type Disciplina =
  | "ruta"
  | "trail"
  | "montana"
  | "ciclismo"
  | "triatlon"
  | "caminata"
  | "otro";

export type EstadoEvento =
  | "borrador"
  | "publicado"
  | "inscripciones_cerradas"
  | "finalizado"
  | "cancelado";
export type TipoPoliticaReembolso = "sin_reembolso" | "parcial" | "completo";
export type EstadoInscripcion = "activa" | "anulada" | "transferida" | "lista_espera";
export type EstadoListaEspera = "esperando" | "notificado" | "expirado" | "convertido";
export type Sexo = "masculino" | "femenino" | "otro";
export type EstadoPago =
  | "pendiente"
  | "en_verificacion"
  | "pagado"
  | "rechazado"
  | "reembolsado"
  | "anulado";
export type MetodoPago =
  | "whatsapp"
  | "pasarela"
  | "comprobante_transferencia"
  | "efectivo"
  | "manual";

/** Lo mínimo para entregar un kit: sin datos financieros, que el operador no ve. */
export type InscripcionCheckin = {
  id: string;
  numero_dorsal: number | null;
  nombre_completo: string;
  categoria: string;
  talla: string | null;
  kit_entregado: boolean;
  kit_entregado_en: string | null;
  asistencia_confirmada: boolean;
  asistencia_en: string | null;
  estado: EstadoInscripcion;
};

export type ResumenEvento = {
  inscritos: number;
  anuladas: number;
  kits_entregados: number;
  asistencias: number;
  categorias: number;
  tallas: number;
  imagenes: number;
  patrocinadores: number;
  tramos_precio: number;
  en_espera: number;
  resultados: number;
  resultados_publicados: number;
  tiene_banner: boolean;
  tiene_ubicacion: boolean;
  tiene_ruta: boolean;
  tiene_descripcion: boolean;
};

export type MetricasEmpresa = {
  eventos_por_estado: Record<string, number>;
  inscritos_totales: number;
  corredores_distintos: number;
  proximo_evento: {
    id: string;
    nombre: string;
    slug: string;
    fecha_inicio: string;
    estado: string;
    inscritos: number;
    cupo_total: number | null;
  } | null;
  inscripciones_por_mes: Record<string, number>;
  top_eventos: { evento: string; inscritos: number }[];
  /** null para el operador: lo financiero queda fuera de su alcance. */
  recaudado: number | null;
  pendiente_cobro: number | null;
  pagos_por_verificar: number | null;
};

export type ResultadoPublico = {
  numero_dorsal: number | null;
  nombre_completo: string;
  categoria: string;
  sexo: Sexo | null;
  /** Postgres devuelve el interval como texto, p. ej. "01:23:45". */
  tiempo_oficial: string | null;
  posicion_general: number | null;
  posicion_categoria: number | null;
};

export type MetricasPlataforma = {
  empresas_activas: number;
  empresas_suspendidas: number;
  eventos_publicados: number;
  eventos_totales: number;
  inscripciones_activas: number;
  corredores: number;
  usuarios: number;
  recaudado: number;
  pendiente_cobro: number;
  inscripciones_por_mes: Record<string, number>;
  top_empresas: { empresa: string; inscripciones: number }[];
};

export type MetricasEvento = {
  inscritos: number;
  anuladas: number;
  kits_entregados: number;
  por_categoria: { categoria: string; cupo: number | null; inscritos: number }[];
  por_sexo: Record<string, number>;
  por_talla: Record<string, number>;
  por_experiencia: Record<string, number>;
  por_origen: Record<string, number>;
  por_rango_edad: Record<string, number>;
  por_ciudad: Record<string, number>;
  inscripciones_por_dia: Record<string, number>;
};
export type NivelExperiencia = "principiante" | "intermedio" | "avanzado" | "competitivo";

export interface Database {
  public: {
    Tables: {
      empresas: {
        Row: {
          id: string;
          nombre_comercial: string;
          slug: string;
          logo_url: string | null;
          colores_marca: Record<string, unknown>;
          correo_contacto: string | null;
          telefono_contacto: string | null;
          rtn: string | null;
          estado: EstadoEmpresa;
          zona_horaria: string;
          moneda: string;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          nombre_comercial: string;
          slug: string;
          logo_url?: string | null;
          colores_marca?: Record<string, unknown>;
          correo_contacto?: string | null;
          telefono_contacto?: string | null;
          rtn?: string | null;
          estado?: EstadoEmpresa;
          zona_horaria?: string;
          moneda?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["empresas"]["Insert"]>;
        Relationships: [];
      };
      /**
       * Une varias inscripciones bajo un solo pago. Existe desde 0005 y estuvo
       * sin usar hasta que los acompañantes le dieron sentido: `pagos` ya sabe
       * colgar de un grupo y `actualizar_estado_pago` reparte el dorsal a todas
       * sus inscripciones al confirmarse el cobro.
       */
      grupos_inscripcion: {
        Row: {
          id: string;
          empresa_id: string;
          evento_id: string;
          pagador_id: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          evento_id: string;
          pagador_id: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["grupos_inscripcion"]["Insert"]>;
        Relationships: [];
      };
      /**
       * Personas que un corredor inscribe sin que ellas creen cuenta (migración
       * 0026). Sus datos viven en `perfiles`, como los de cualquier corredor.
       */
      acompanantes: {
        Row: {
          id: string;
          titular_id: string;
          usuario_id: string;
          parentesco: "hijo" | "pareja" | "familiar" | "otro";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          titular_id: string;
          usuario_id: string;
          parentesco?: "hijo" | "pareja" | "familiar" | "otro";
        };
        Update: Partial<Database["public"]["Tables"]["acompanantes"]["Insert"]>;
        Relationships: [];
      };
      perfiles: {
        Row: {
          id: string;
          rol_plataforma: RolPlataforma;
          nombres: string | null;
          apellidos: string | null;
          correo: string | null;
          telefono: string | null;
          fecha_nacimiento: string | null;
          sexo: "masculino" | "femenino" | "otro" | null;
          documento_identidad: string | null;
          pais_id: string | null;
          departamento_id: string | null;
          ciudad_id: string | null;
          nacionalidad: string | null;
          talla_predeterminada: string | null;
          tipo_sangre: string | null;
          contacto_emergencia_nombre: string | null;
          contacto_emergencia_parentesco: string | null;
          contacto_emergencia_telefono: string | null;
          ocupacion: string | null;
          como_se_entero: string | null;
          nivel_experiencia:
            | "principiante"
            | "intermedio"
            | "avanzado"
            | "competitivo"
            | null;
          terminos_aceptados_en: string | null;
          /** URL pública del avatar en el bucket `avatares` (migración 0025). */
          foto_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["perfiles"]["Row"]> & {
          id: string;
        };
        Update: Partial<Database["public"]["Tables"]["perfiles"]["Row"]>;
        Relationships: [];
      };
      empresa_miembros: {
        Row: {
          id: string;
          empresa_id: string;
          usuario_id: string;
          rol: RolEmpresa;
          estado: EstadoMembresia;
          invitado_en: string;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          usuario_id: string;
          rol: RolEmpresa;
          estado?: EstadoMembresia;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["empresa_miembros"]["Insert"]>;
        Relationships: [];
      };
      eventos: {
        Row: {
          id: string;
          empresa_id: string;
          nombre: string;
          slug: string;
          descripcion: string | null;
          fecha_inicio: string;
          fecha_limite_inscripcion: string | null;
          direccion: string | null;
          lat: number | null;
          lng: number | null;
          estado: EstadoEvento;
          imagen_banner_url: string | null;
          moneda: string;
          zona_horaria: string;
          ruta_gpx_url: string | null;
          punto_encuentro_lat: number | null;
          punto_encuentro_lng: number | null;
          disciplina: Disciplina;
          departamento_id: string | null;
          kit_contenido: string[];
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          nombre: string;
          slug: string;
          descripcion?: string | null;
          fecha_inicio: string;
          fecha_limite_inscripcion?: string | null;
          direccion?: string | null;
          lat?: number | null;
          lng?: number | null;
          estado?: EstadoEvento;
          imagen_banner_url?: string | null;
          moneda?: string;
          zona_horaria?: string;
          ruta_gpx_url?: string | null;
          punto_encuentro_lat?: number | null;
          punto_encuentro_lng?: number | null;
          disciplina?: Disciplina;
          departamento_id?: string | null;
          kit_contenido?: string[];
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["eventos"]["Insert"]>;
        Relationships: [];
      };
      evento_puntos_entrega: {
        Row: {
          id: string;
          evento_id: string;
          nombre: string;
          direccion: string | null;
          horario: string | null;
          lat: number | null;
          lng: number | null;
          orden: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          evento_id: string;
          nombre: string;
          direccion?: string | null;
          horario?: string | null;
          lat?: number | null;
          lng?: number | null;
          orden?: number;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["evento_puntos_entrega"]["Insert"]>;
        Relationships: [];
      };
      evento_imagenes: {
        Row: {
          id: string;
          evento_id: string;
          url: string;
          orden: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          evento_id: string;
          url: string;
          orden?: number;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["evento_imagenes"]["Insert"]>;
        Relationships: [];
      };
      categorias: {
        Row: {
          id: string;
          evento_id: string;
          nombre: string;
          distancia_km: number | null;
          desnivel_m: number | null;
          precio_base: number;
          cupo_maximo: number | null;
          edad_minima: number | null;
          edad_maxima: number | null;
          hora_salida: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          evento_id: string;
          nombre: string;
          distancia_km?: number | null;
          desnivel_m?: number | null;
          precio_base?: number;
          cupo_maximo?: number | null;
          edad_minima?: number | null;
          edad_maxima?: number | null;
          hora_salida?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["categorias"]["Insert"]>;
        Relationships: [];
      };
      precios_escalonados: {
        Row: {
          id: string;
          categoria_id: string;
          nombre: string;
          precio: number;
          fecha_inicio: string;
          fecha_fin: string;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          categoria_id: string;
          nombre: string;
          precio: number;
          fecha_inicio: string;
          fecha_fin: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["precios_escalonados"]["Insert"]>;
        Relationships: [];
      };
      evento_tallas: {
        Row: {
          id: string;
          evento_id: string;
          talla: string;
          inventario_total: number | null;
          inventario_disponible: number | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          evento_id: string;
          talla: string;
          inventario_total?: number | null;
          inventario_disponible?: number | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["evento_tallas"]["Insert"]>;
        Relationships: [];
      };
      patrocinadores: {
        Row: {
          id: string;
          evento_id: string;
          nombre: string;
          logo_url: string | null;
          url_sitio: string | null;
          orden: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          evento_id: string;
          nombre: string;
          logo_url?: string | null;
          url_sitio?: string | null;
          orden?: number;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["patrocinadores"]["Insert"]>;
        Relationships: [];
      };
      eventos_politica_reembolso: {
        Row: {
          id: string;
          evento_id: string;
          tipo: TipoPoliticaReembolso;
          dias_limite: number | null;
          porcentaje_reembolso: number | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          evento_id: string;
          tipo: TipoPoliticaReembolso;
          dias_limite?: number | null;
          porcentaje_reembolso?: number | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["eventos_politica_reembolso"]["Insert"]>;
        Relationships: [];
      };
      paises: {
        Row: { id: string; nombre: string; codigo_iso: string; created_at: string };
        Insert: { id?: string; nombre: string; codigo_iso: string };
        Update: Partial<Database["public"]["Tables"]["paises"]["Insert"]>;
        Relationships: [];
      };
      departamentos: {
        Row: { id: string; pais_id: string; nombre: string; created_at: string };
        Insert: { id?: string; pais_id: string; nombre: string };
        Update: Partial<Database["public"]["Tables"]["departamentos"]["Insert"]>;
        Relationships: [];
      };
      ciudades: {
        Row: { id: string; departamento_id: string; nombre: string; created_at: string };
        Insert: { id?: string; departamento_id: string; nombre: string };
        Update: Partial<Database["public"]["Tables"]["ciudades"]["Insert"]>;
        Relationships: [];
      };
      inscripciones: {
        Row: {
          id: string;
          evento_id: string;
          categoria_id: string;
          empresa_id: string;
          corredor_id: string;
          talla: string | null;
          numero_dorsal: number | null;
          codigo_qr: string | null;
          cupon_id: string | null;
          precio_pagado: number;
          moneda: string;
          estado: EstadoInscripcion;
          kit_entregado: boolean;
          kit_entregado_en: string | null;
          kit_entregado_por: string | null;
          asistencia_confirmada: boolean;
          asistencia_en: string | null;
          asistencia_por: string | null;
          datos_adicionales: Record<string, unknown>;
          grupo_inscripcion_id: string | null;
          transferido_de_inscripcion_id: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          evento_id: string;
          categoria_id: string;
          empresa_id: string;
          corredor_id: string;
          talla?: string | null;
          precio_pagado?: number;
          moneda?: string;
          estado?: EstadoInscripcion;
          datos_adicionales?: Record<string, unknown>;
          grupo_inscripcion_id?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["inscripciones"]["Insert"]>;
        Relationships: [];
      };
      declaraciones_salud: {
        Row: {
          id: string;
          empresa_id: string;
          evento_id: string | null;
          version: number;
          contenido: string;
          vigente_desde: string;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          evento_id?: string | null;
          version: number;
          contenido: string;
          vigente_desde?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["declaraciones_salud"]["Insert"]>;
        Relationships: [];
      };
      inscripcion_firmas: {
        Row: {
          id: string;
          inscripcion_id: string;
          declaracion_id: string;
          firma_imagen_url: string | null;
          aceptado_checkbox: boolean;
          ip_address: string | null;
          dispositivo: string | null;
          firmado_en: string;
          tutor_nombre: string | null;
          tutor_documento: string | null;
          pdf_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          inscripcion_id: string;
          declaracion_id: string;
          firma_imagen_url?: string | null;
          aceptado_checkbox?: boolean;
          ip_address?: string | null;
          dispositivo?: string | null;
          tutor_nombre?: string | null;
          tutor_documento?: string | null;
          pdf_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["inscripcion_firmas"]["Insert"]>;
        Relationships: [];
      };
      cupones: {
        Row: {
          id: string;
          empresa_id: string;
          evento_id: string | null;
          codigo: string;
          tipo_descuento: "porcentaje" | "monto_fijo";
          valor: number;
          usos_maximos: number | null;
          usos_actuales: number;
          vigente_desde: string | null;
          vigente_hasta: string | null;
          activo: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          empresa_id: string;
          evento_id?: string | null;
          codigo: string;
          tipo_descuento: "porcentaje" | "monto_fijo";
          valor: number;
          usos_maximos?: number | null;
          vigente_desde?: string | null;
          vigente_hasta?: string | null;
          activo?: boolean;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["cupones"]["Insert"]>;
        Relationships: [];
      };
      resultados: {
        Row: {
          id: string;
          inscripcion_id: string;
          tiempo_oficial: string | null;
          posicion_general: number | null;
          posicion_categoria: number | null;
          publicado: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          inscripcion_id: string;
          tiempo_oficial?: string | null;
          posicion_general?: number | null;
          posicion_categoria?: number | null;
          publicado?: boolean;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["resultados"]["Insert"]>;
        Relationships: [];
      };
      certificados: {
        Row: {
          id: string;
          inscripcion_id: string;
          pdf_url: string;
          generado_en: string;
          created_at: string;
        };
        Insert: { id?: string; inscripcion_id: string; pdf_url: string };
        Update: Partial<Database["public"]["Tables"]["certificados"]["Insert"]>;
        Relationships: [];
      };
      bitacora_auditoria: {
        Row: {
          id: string;
          usuario_id: string | null;
          empresa_id: string | null;
          accion: string;
          entidad: string;
          entidad_id: string | null;
          datos_anteriores: Record<string, unknown> | null;
          datos_nuevos: Record<string, unknown> | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id?: string | null;
          empresa_id?: string | null;
          accion: string;
          entidad: string;
          entidad_id?: string | null;
          datos_anteriores?: Record<string, unknown> | null;
          datos_nuevos?: Record<string, unknown> | null;
          ip_address?: string | null;
        };
        /** Append-only por diseño: sin UPDATE ni DELETE, tampoco para super_admin. */
        Update: never;
        Relationships: [];
      };
      notificaciones: {
        Row: {
          id: string;
          usuario_id: string;
          tipo: string;
          titulo: string;
          mensaje: string;
          leido: boolean;
          leido_en: string | null;
          enlace: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          usuario_id: string;
          tipo: string;
          titulo: string;
          mensaje: string;
          enlace?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["notificaciones"]["Insert"]> & {
          leido?: boolean;
          leido_en?: string | null;
        };
        Relationships: [];
      };
      pagos: {
        Row: {
          id: string;
          inscripcion_id: string | null;
          grupo_inscripcion_id: string | null;
          empresa_id: string;
          monto: number;
          moneda: string;
          metodo: MetodoPago;
          proveedor: string | null;
          referencia_externa: string | null;
          comprobante_url: string | null;
          estado: EstadoPago;
          verificado_por: string | null;
          verificado_en: string | null;
          notas: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          inscripcion_id?: string | null;
          grupo_inscripcion_id?: string | null;
          empresa_id: string;
          monto: number;
          moneda?: string;
          metodo: MetodoPago;
          proveedor?: string | null;
          referencia_externa?: string | null;
          comprobante_url?: string | null;
          estado?: EstadoPago;
          notas?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["pagos"]["Insert"]>;
        Relationships: [];
      };
      pagos_historial: {
        Row: {
          id: string;
          pago_id: string;
          estado_anterior: EstadoPago | null;
          estado_nuevo: EstadoPago;
          usuario_id: string | null;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          pago_id: string;
          estado_anterior?: EstadoPago | null;
          estado_nuevo: EstadoPago;
          usuario_id?: string | null;
          notas?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["pagos_historial"]["Insert"]>;
        Relationships: [];
      };
      lista_espera: {
        Row: {
          id: string;
          evento_id: string;
          categoria_id: string;
          usuario_id: string;
          estado: EstadoListaEspera;
          notificado_en: string | null;
          enlace_expira_en: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          evento_id: string;
          categoria_id: string;
          usuario_id: string;
          estado?: EstadoListaEspera;
        };
        Update: Partial<Database["public"]["Tables"]["lista_espera"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      vista_exportacion_cronometraje: {
        Row: {
          evento_id: string;
          numero_dorsal: number | null;
          nombre_completo: string;
          categoria: string;
          sexo: Sexo | null;
          chip: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      aceptar_invitacion_empresa: {
        Args: { p_empresa_id: string };
        Returns: void;
      };
      anular_inscripcion: {
        Args: { p_inscripcion_id: string; p_motivo?: string };
        Returns: void;
      };
      asignar_dorsal: {
        Args: { p_inscripcion_id: string };
        Returns: number;
      };
      validar_cupon: {
        Args: { p_empresa_id: string; p_evento_id: string; p_codigo: string };
        Returns: { valido: boolean; tipo_descuento: string | null; valor: number | null; motivo: string | null }[];
      };
      categorias_con_cupo: {
        Args: { p_evento_id: string };
        Returns: {
          id: string;
          nombre: string;
          distancia_km: number | null;
          // La migración 0022 se escribió solo para añadir esta columna al
          // `returns table` y este archivo no se actualizó: `consultas.ts`
          // declaraba su propio tipo y lo colaba con un cast.
          desnivel_m: number | null;
          precio_base: number;
          precio_vigente: number;
          cupo_maximo: number | null;
          edad_minima: number | null;
          edad_maxima: number | null;
          hora_salida: string | null;
          inscritos: number;
          cupos_disponibles: number | null;
        }[];
      };
      consumir_limite: {
        Args: { p_clave: string; p_maximo: number; p_ventana_segundos: number };
        Returns: boolean;
      };
      registrar_auditoria: {
        Args: {
          p_accion: string;
          p_entidad: string;
          p_entidad_id?: string | null;
          p_empresa_id?: string | null;
          p_datos_anteriores?: Record<string, unknown> | null;
          p_datos_nuevos?: Record<string, unknown> | null;
          p_ip?: string | null;
        };
        Returns: void;
      };
      metricas_plataforma: {
        Args: Record<string, never>;
        Returns: MetricasPlataforma;
      };
      inscribir_manualmente: {
        Args: {
          p_categoria_id: string;
          p_corredor_id: string;
          p_declaracion_id: string;
          p_talla?: string | null;
          p_datos_adicionales?: Record<string, unknown>;
          p_firma_imagen_url?: string | null;
          p_ip?: string | null;
          p_dispositivo?: string | null;
          p_tutor_nombre?: string | null;
          p_tutor_documento?: string | null;
          p_precio?: number | null;
          p_cobrar_en_efectivo?: boolean;
        };
        Returns: string;
      };
      ajustar_inventario_talla: {
        Args: { p_talla_id: string; p_inventario_total: number | null };
        Returns: void;
      };
      expirar_lista_espera: {
        Args: { p_categoria_id: string };
        Returns: number;
      };
      cambiar_talla_inscripcion: {
        Args: { p_inscripcion_id: string; p_talla: string | null };
        Returns: void;
      };
      marcar_kit_entregado: {
        Args: { p_inscripcion_id: string };
        Returns: void;
      };
      marcar_asistencia: {
        Args: { p_inscripcion_id: string };
        Returns: void;
      };
      resumen_evento: {
        Args: { p_evento_id: string };
        Returns: ResumenEvento;
      };
      metricas_empresa: {
        Args: { p_empresa_id: string };
        Returns: MetricasEmpresa;
      };
      /**
       * RETIRADA. Existe en la base pero la migración 0020 le revocó el
       * `execute` a `authenticated`: llamarla desde la aplicación devuelve 403.
       * El traspaso se hace con `transferir_inscripcion_firmada`, que exige la
       * firma del nuevo corredor. Se deja declarada, y con este aviso, para que
       * nadie la use creyendo que está disponible.
       */
      transferir_inscripcion: {
        Args: { p_inscripcion_id: string; p_nuevo_corredor_id: string };
        Returns: string;
      };
      convertir_lista_espera: {
        Args: { p_lista_espera_id: string };
        Returns: string;
      };
      buscar_inscripcion_por_qr: {
        Args: { p_evento_id: string; p_codigo_qr: string };
        Returns: InscripcionCheckin[];
      };
      buscar_inscripcion_por_dorsal: {
        Args: { p_evento_id: string; p_dorsal: number };
        Returns: InscripcionCheckin[];
      };
      inventario_tallas: {
        Args: { p_evento_id: string };
        Returns: {
          talla: string;
          inventario_total: number | null;
          inventario_disponible: number | null;
          comprometidas: number;
        }[];
      };
      notificar_siguiente_lista_espera: {
        Args: { p_categoria_id: string };
        Returns: string | null;
      };
      registrar_resultado: {
        Args: {
          p_evento_id: string;
          p_dorsal: number;
          p_tiempo: string;
          p_posicion_general?: number | null;
          p_posicion_categoria?: number | null;
        };
        Returns: string;
      };
      recalcular_posiciones: {
        Args: { p_evento_id: string };
        Returns: number;
      };
      resultados_publicos: {
        Args: { p_evento_id: string };
        Returns: ResultadoPublico[];
      };
      metricas_evento: {
        Args: { p_evento_id: string };
        Returns: MetricasEvento;
      };
      registrar_intento_pago: {
        Args: {
          p_inscripcion_id: string;
          p_metodo: "whatsapp" | "comprobante_transferencia";
          p_comprobante_url?: string | null;
          p_referencia?: string | null;
        };
        Returns: string;
      };
      actualizar_estado_pago: {
        Args: { p_pago_id: string; p_nuevo_estado: EstadoPago; p_notas?: string | null };
        Returns: void;
      };
      inscribirse_en_evento: {
        Args: {
          p_categoria_id: string;
          p_declaracion_id: string;
          p_talla?: string | null;
          p_datos_adicionales?: Record<string, unknown>;
          p_firma_imagen_url?: string | null;
          p_acepto?: boolean;
          p_ip?: string | null;
          p_dispositivo?: string | null;
          p_tutor_nombre?: string | null;
          p_tutor_documento?: string | null;
          p_codigo_cupon?: string | null;
          /** Une la inscripción a un grupo, para que un pago cubra a toda la familia. */
          p_grupo_id?: string | null;
        };
        Returns: string;
      };
      /**
       * Inscribe a un acompañante del usuario en sesión. Comparte con
       * `inscribirse_en_evento` las reglas de cupo, edad, inventario y precio;
       * solo cambia de quién es la inscripción.
       */
      inscribir_acompanante: {
        Args: {
          p_categoria_id: string;
          p_acompanante_id: string;
          p_declaracion_id: string;
          p_talla?: string | null;
          p_datos_adicionales?: Record<string, unknown>;
          p_firma_imagen_url?: string | null;
          p_acepto?: boolean;
          p_ip?: string | null;
          p_dispositivo?: string | null;
          p_tutor_nombre?: string | null;
          p_tutor_documento?: string | null;
          p_codigo_cupon?: string | null;
          p_grupo_id?: string | null;
        };
        Returns: string;
      };
      transferir_inscripcion_firmada: {
        Args: {
          p_inscripcion_id: string;
          p_nuevo_corredor_id: string;
          p_declaracion_id: string;
          p_firma_imagen_url?: string | null;
          p_ip?: string | null;
          p_dispositivo?: string | null;
          p_motivo?: string | null;
        };
        Returns: string;
      };
      fotos_por_dorsal: {
        Args: { p_evento_id: string; p_dorsal: number };
        Returns: { id: string; url: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
