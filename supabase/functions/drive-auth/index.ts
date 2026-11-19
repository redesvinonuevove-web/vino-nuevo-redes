// drive-auth — Autorización ÚNICA de Google Drive para la cuenta de Vino Nuevo.
// Paso 1 (sin ?code): redirige a la pantalla de permisos de Google.
// Paso 2 (?code=...): Google regresa aquí; cambiamos el código por un refresh_token
// y lo guardamos en drive_config. Nadie más vuelve a tocar esto.
// verify_jwt debe estar DESACTIVADO (Google llega sin sesión).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REDIRECT = `${SUPABASE_URL}/functions/v1/drive-auth`;
const SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.events";

function page(msg: string, ok = true) {
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vino Nuevo · Drive</title></head>
    <body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh">
    <div style="max-width:420px;background:#fff;border-radius:20px;box-shadow:0 10px 40px rgba(0,0,0,.08);padding:34px 30px;text-align:center">
    <div style="width:56px;height:56px;border-radius:50%;margin:0 auto 14px;background:${ok ? "#2fa35a" : "#e5484d"};color:#fff;font-size:30px;line-height:56px">${ok ? "✓" : "!"}</div>
    <h2 style="margin:0 0 8px;color:#1a1a1a">${msg}</h2>
    <p style="color:#8a8a90;font-size:14px;margin:0">Ya puedes cerrar esta pestaña y volver a la app.</p>
    </div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  if (err) return page("No se concedió el permiso", false);

  if (!code) {
    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.searchParams.set("client_id", CLIENT_ID);
    auth.searchParams.set("redirect_uri", REDIRECT);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("scope", SCOPE);
    auth.searchParams.set("access_type", "offline");
    auth.searchParams.set("prompt", "consent");
    return Response.redirect(auth.toString(), 302);
  }

  try {
    const body = new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    });
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const tok = await r.json();
    if (!tok.refresh_token) {
      return page("Google no devolvió el permiso. Intenta de nuevo.", false);
    }
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    await sb.from("drive_config").upsert({
      id: 1,
      refresh_token: tok.refresh_token,
      updated_at: new Date().toISOString(),
    });
    return page("¡Drive conectado!");
  } catch (e) {
    return page("Error: " + String((e as any)?.message || e), false);
  }
});
