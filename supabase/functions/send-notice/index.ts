// send-notice — Envía avisos por correo del equipo de Redes de Vino Nuevo.
// Usa el Gmail de la iglesia (SMTP) mediante denomailer.
// Secrets requeridos (Edge Functions > Secrets):
//   GMAIL_USER           = redesvinonuevo.ve@gmail.com
//   GMAIL_APP_PASSWORD   = (contraseña de aplicación de 16 letras de Google)
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const LOGO = "https://vinonuevo.netlify.app/logo-vino-nuevo.png";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function esc(s: unknown): string {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)
  );
}

function renderEmail(d: any): string {
  const rows = Array.isArray(d.rows) ? d.rows : [];
  const rowsHtml = rows
    .map(
      ([l, v]: [string, string]) =>
        `<tr><td style="padding:7px 0;font-size:13px;color:#8a8a90;width:100px;vertical-align:top;font-weight:600;">${esc(
          l
        )}</td><td style="padding:7px 0;font-size:13px;color:#2b2b30;">${esc(v)}</td></tr>`
    )
    .join("");
  const cta = d.ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;"><tr><td style="border-radius:12px;background:#7a1427;"><a href="${esc(
        d.ctaUrl
      )}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">${esc(
        d.ctaText || "Abrir la app"
      )}</a></td></tr></table>`
    : "";
  return `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:0;background:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.08);">
  <tr><td style="background:#7a1427;padding:34px 32px 26px;text-align:center;">
  <img src="${LOGO}" width="64" height="64" alt="Vino Nuevo" style="display:block;margin:0 auto 12px;border-radius:50%;">
  <div style="color:#ffffff;font-size:19px;font-weight:700;">Vino Nuevo &middot; Redes</div>
  <div style="height:3px;width:46px;background:#d4af37;margin:14px auto 0;border-radius:2px;"></div></td></tr>
  <tr><td style="padding:32px 34px 6px;">
  <h1 style="margin:0 0 12px;font-size:21px;color:#1a1a1a;font-weight:700;">${esc(d.heading)}</h1>
  <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#44444a;">${esc(d.intro)}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f7f5f6;border:1px solid #efe7ea;border-radius:14px;padding:4px 16px;margin:0 0 20px;"><tbody>${rowsHtml}</tbody></table>
  ${cta}
  ${d.footnote ? `<p style="margin:0;font-size:12px;line-height:1.5;color:#a0a0a6;">${esc(d.footnote)}</p>` : ""}
  </td></tr>
  <tr><td style="padding:20px 34px 28px;border-top:1px solid #eeeeee;">
  <p style="margin:0;font-size:12px;line-height:1.5;color:#a0a0a6;">Iglesia Vino Nuevo &middot; Equipo de Redes<br>Este es un correo autom&aacute;tico, no hace falta responder.</p>
  </td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: cors });

  const J = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const b = await req.json();
    let recipients = (Array.isArray(b.to) ? b.to : [b.to])
      .filter((x: string) => x && /.+@.+\..+/.test(x))
      .map((x: string) => x.trim());
    recipients = [...new Set(recipients)];
    if (!recipients.length) return J({ error: "no valid recipients" }, 400);

    const user = Deno.env.get("GMAIL_USER");
    const pass = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!user || !pass)
      return J({ error: "missing GMAIL_USER / GMAIL_APP_PASSWORD secrets" }, 500);

    const subject = b.subject || "Aviso · Vino Nuevo Redes";
    const html = renderEmail(b);
    const text =
      (b.heading ? b.heading + "\n\n" : "") +
      (b.intro || "Tienes un nuevo aviso del equipo de Redes de Vino Nuevo.");

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: user, password: pass },
      },
    });

    let sent = 0;
    for (const to of recipients) {
      await client.send({
        from: `Vino Nuevo · Redes <${user}>`,
        to,
        subject,
        content: text,
        html,
      });
      sent++;
    }
    await client.close();

    return J({ ok: true, sent });
  } catch (e) {
    return J({ error: String((e as any)?.message || e) }, 500);
  }
});
