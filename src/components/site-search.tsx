import { useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";

const DISCS = [
  ["skate", "Skate"],
  ["bmx", "BMX"],
  ["blades", "Blades"],
  ["scoot", "Scoot"],
] as const;

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
  const [disc, setDisc] = useState(discipline);

  useEffect(() => {
    setText(query);
  }, [query]);

  useEffect(() => {
    setDisc(discipline);
  }, [discipline]);

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

  const go = (nextDisc: string, nextText: string) => {
    if (onQuery && nextDisc === discipline) {
      onQuery(nextText);
      return;
    }
    void navigate({
      to: "/$discipline",
      params: { discipline: nextDisc },
      search: { q: nextText } as never,
    });
  };

  return (
    <form
      className="site-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        go(disc, text.trim());
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
          if (onQuery && disc === discipline) onQuery(next);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setText("");
            onQuery?.("");
            input.current?.blur();
          }
        }}
      />
      <label className="sr-only" htmlFor={`${fieldId}-disc`}>
        Discipline
      </label>
      <select
        id={`${fieldId}-disc`}
        value={disc}
        onChange={(event) => {
          const next = event.target.value;
          setDisc(next);
          go(next, text.trim());
        }}
      >
        {DISCS.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </form>
  );
}
