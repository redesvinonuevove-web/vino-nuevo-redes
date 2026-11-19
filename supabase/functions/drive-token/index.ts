// drive-token — Entrega a un miembro del equipo (con sesión en la app) un token
// de acceso de corta duración de la cuenta de Vino Nuevo + el id de la carpeta
// compartida, para que el navegador suba el archivo DIRECTO a Drive.
// Así los archivos grandes (video) no pasan por la función. verify_jwt ACTIVADO.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FOLDER_NAME = "Vino Nuevo · Redes";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const J = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function accessToken(refresh: string) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refresh,
    grant_type: "refresh_token",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: cfg } = await sb.from("drive_config").select("*").eq("id", 1).maybeSingle();
    if (!cfg?.refresh_token) return J({ error: "not_connected" }, 400);

    const tok = await accessToken(cfg.refresh_token);
    const access = tok.access_token;
    if (!access) return J({ error: "token_failed", detail: tok }, 400);

    let folderId = cfg.folder_id as string | null;
    if (!folderId) {
      const q = encodeURIComponent(
        `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
      );
      const sr = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`,
        { headers: { Authorization: `Bearer ${access}` } }
      );
      const sj = await sr.json();
      if (sj.files && sj.files.length) folderId = sj.files[0].id;
      else {
        const cr = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
          method: "POST",
          headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
        });
        const cj = await cr.json();
        folderId = cj.id;
      }
      // compartir la carpeta: cualquiera con el enlace puede ver
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}/permissions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
          body: JSON.stringify({ role: "reader", type: "anyone" }),
        });
      } catch (_) { /* no bloquear */ }
      await sb.from("drive_config").update({ folder_id: folderId }).eq("id", 1);
    }

    return J({ access_token: access, folder_id: folderId, expires_in: tok.expires_in || 3600 });
  } catch (e) {
    return J({ error: String((e as any)?.message || e) }, 500);
  }
});
