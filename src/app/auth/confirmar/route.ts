import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { rutaInternaSegura } from "@/lib/seguridad";

/** Los tipos que emiten nuestras tres plantillas de correo. */
const TIPOS: EmailOtpType[] = ["signup", "recovery", "invite", "magiclink", "email_change"];

/**
 * Destino de todos los enlaces que llegan por correo: confirmación de cuenta,
 * recuperación de contraseña e invitación a un equipo.
 *
 * Acepta **dos formas** a propósito:
 *
 * · `token_hash` + `type` — la de las plantillas nuevas. Se verifica contra
 *   Supabase sin depender del navegador, así que el correo puede abrirse en el
 *   móvil aunque el registro se hiciera en el portátil. Es el caso normal y
 *   antes fallaba.
 *
 * · `code` — el flujo PKCE anterior. Necesita una cookie que solo existe en el
 *   navegador donde empezó la operación. Se mantiene para que los enlaces ya
 *   enviados sigan funcionando mientras caducan.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  // El destino llega en la URL del correo, así que se depura igual que en el
  // resto del proyecto: si no es una ruta interna se ignora.
  const next = rutaInternaSegura(searchParams.get("next")) ?? "/";

  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const fallo = (motivo: "enlace_invalido" | "enlace_caducado") =>
    NextResponse.redirect(`${origin}/login?error=${motivo}`);

  if (tokenHash && tipo && TIPOS.includes(tipo)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return fallo(esGastado(error) ? "enlace_caducado" : "enlace_invalido");
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return fallo(esGastado(error) ? "enlace_caducado" : "enlace_invalido");
  }

  // Ni token ni código: alguien llegó aquí a mano.
  return fallo("enlace_invalido");
}

/**
 * Enlace que ya no sirve, sea porque caducó o porque ya se usó.
 *
 * **Supabase no distingue los dos casos**: ante un token caducado, uno ya
 * consumido y uno inventado responde siempre `otp_expired` con el mensaje
 * «Email link is invalid or has expired». Por eso aquí se agrupan bajo un solo
 * motivo y el aviso del acceso está redactado para cubrir ambos: prometer una
 * distinción que la API no da acabaría diciéndole a alguien que su enlace
 * caducó cuando en realidad ya lo había usado.
 */
function esGastado(error: { code?: string; message: string }): boolean {
  return error.code === "otp_expired" || /expired|caduc/i.test(error.message);
}
