import { ADMIN_EMAIL } from "@/lib/admin-email";

export type ContactNote = {
  name: string;
  email: string;
  message: string;
};

export async function deliverContact(note: ContactNote): Promise<{ ok: boolean }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (key) {
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Trick Machina <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        reply_to: note.email,
        subject: "Trick Machina",
        text: `${note.name}\n${note.email}\n\n${note.message}`,
      }),
    });
    if (sent.ok) return { ok: true };
  }

  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(ADMIN_EMAIL)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      name: note.name,
      email: note.email,
      message: note.message,
      _replyto: note.email,
      _subject: "Trick Machina",
      _captcha: "false",
      _template: "table",
    }),
  });
  const body = (await response.json().catch(() => null)) as { success?: string | boolean } | null;
  return { ok: response.ok && (body?.success === true || body?.success === "true") };
}
