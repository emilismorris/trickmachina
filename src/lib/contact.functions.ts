import { createServerFn } from "@tanstack/react-start";

type ContactInput = {
  name: string;
  email: string;
  message: string;
  company?: string;
};

type ContactNote = {
  name: string;
  email: string;
  message: string;
};

function field(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, max);
  if (!text || /[\u0000-\u001f]/.test(text)) return null;
  return text;
}

export const sendContact = createServerFn({ method: "POST" })
  .validator((input: ContactInput): ContactNote | null => {
    if (input.company?.trim()) return null;
    const name = field(input.name, 80);
    const email = field(input.email, 120);
    const message = typeof input.message === "string" ? input.message.trim().slice(0, 4000) : "";
    if (!name || !email || !message || /[\u0000-\u0008]/.test(message)) throw new Error("Check the form");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Check the form");
    return { name, email, message };
  })
  .handler(async ({ data }) => {
    if (!data) return { ok: true as const };
    const { deliverContact } = await import("./contact.server");
    return deliverContact(data);
  });
