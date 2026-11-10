import { useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";

export function SiteSearch({
  discipline = "skate",
  query = "",
  onQuery,
}: {
  discipline?: string;
  query?: string;
  onQuery?: (value: string) => void;
}) {
  const navigate = useNavigate();
  const fieldId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(query);

  useEffect(() => {
    setText(query);
  }, [query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (event.key === "/" && !typing) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (nextText: string) => {
    if (onQuery) {
      onQuery(nextText);
      return;
    }
    void navigate({
      to: "/$discipline",
      params: { discipline },
      search: { q: nextText } as never,
    });
  };

  return (
    <form
      className="site-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        go(text.trim());
        input.current?.focus();
      }}
    >
      <label className="sr-only" htmlFor={fieldId}>
        Search films
      </label>
      <input
        id={fieldId}
        ref={input}
        type="search"
        name="q"
        value={text}
        placeholder="Title, rider, company, year"
        autoComplete="off"
        enterKeyHint="search"
        maxLength={80}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          if (onQuery) onQuery(next);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setText("");
            onQuery?.("");
            input.current?.blur();
          }
        }}
      />
    </form>
  );
}