import { ADMIN_EMAIL } from "@/lib/admin-email";
import { getSql } from "@/lib/db";

export type ContactNote = {
  name: string;
  email: string;
  message: string;
};

async function sendMail(note: ContactNote): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (key) {
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Trick Machina <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        reply_to: note.email,
        subject: `Trick Machina — ${note.name}`,
        text: `${note.name}\n${note.email}\n\n${note.message}`,
      }),
    });
    if (sent.ok) return true;
  }

  try {
    const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(ADMIN_EMAIL)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Origin: "https://trickmachina.com",
        Referer: "https://trickmachina.com/contact",
      },
      body: new URLSearchParams({
        name: note.name,
        email: note.email,
        message: note.message,
        _replyto: note.email,
        _subject: `Trick Machina — ${note.name}`,
        _captcha: "false",
        _template: "table",
      }),
    });
    const body = (await response.json().catch(() => null)) as { success?: string | boolean } | null;
    return response.ok && (body?.success === true || body?.success === "true");
  } catch (err) {
    console.error("[contact]", err);
    return false;
  }
}

export async function deliverContact(note: ContactNote): Promise<{ ok: boolean; mailed: boolean }> {
  try {
    const sql = await getSql();
    await sql`create table if not exists contact_note (
      id bigserial primary key,
      name text not null,
      email text not null,
      message text not null,
      created_at timestamptz not null default now()
    )`;
    await sql`insert into contact_note (name, email, message) values (${note.name}, ${note.email}, ${note.message})`;
  } catch (err) {
    console.error("[contact]", err);
    const mailed = await sendMail(note);
    return { ok: mailed, mailed };
  }
  const mailed = await sendMail(note);
  return { ok: true, mailed };
}
