import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { sendContact } from "@/lib/contact.functions";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  head: () => pageHead("Contact — Trick Machina", "Write to Trick Machina.", "/contact"),
  component: Contact,
});

function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "saved" | "failed">("idle");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("sending");
    try {
      const result = await sendContact({ data: { name, email, message, company } });
      if (!result.ok) {
        setStatus("failed");
        return;
      }
      setStatus(result.mailed ? "sent" : "saved");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <main className="cookies">
      <p>
        <Link to="/">The Archive</Link>
      </p>
      <h1>Contact</h1>
      <p>Write a note. It goes straight to Trick Machina.</p>
      {status === "sent" ? (
        <p>Sent.</p>
      ) : status === "saved" ? (
        <p>Received. It is on the admin desk.</p>
      ) : (
        <form className="contact-form" onSubmit={submit}>
          <label>
            Name
            <input name="name" autoComplete="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Your email
            <input name="email" type="email" autoComplete="email" required maxLength={120} value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Message
            <textarea name="message" required maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} />
          </label>
          <label className="contact-honey" aria-hidden="true">
            Company
            <input tabIndex={-1} autoComplete="off" value={company} onChange={(event) => setCompany(event.target.value)} />
          </label>
          <button type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Send"}
          </button>
          {status === "failed" ? <p>It didn’t send. Try again.</p> : null}
        </form>
      )}
    </main>
  );
}
