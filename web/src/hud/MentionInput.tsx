import { type KeyboardEvent, type RefObject, useEffect, useState } from "react";
import { world } from "../game/world.ts";
import { town } from "../net.ts";
import { useHud } from "../store.ts";

/** The `@partial` being typed at the end of the input, if any. */
const typingMention = (text: string) => /(?:^|\s)@([a-z0-9._-]*)$/i.exec(text)?.[1]?.toLowerCase() ?? null;

/** People you can see first (this room, and inside houses), then everyone else by name. */
function useSuggestions(query: string | null, myName: string | undefined): string[] {
  const [remote, setRemote] = useState<string[]>([]);
  useEffect(() => {
    setRemote([]);
    if (!query) return;
    const id = setTimeout(() => void town.searchNames(query).then(setRemote, () => {}), 150);
    return () => clearTimeout(id);
  }, [query]);
  if (query === null) return [];
  const nearby = [
    ...[...world.avatars.values()].map((a) => a.info.name),
    ...Object.values(world.houses).flatMap((list) => list.map((p) => p.name)),
  ];
  return [...new Set([...nearby, ...remote])]
    .filter((name) => name !== myName && name.startsWith(query))
    .slice(0, 6);
}

/**
 * A text input where `@` suggests people by name (↑↓ to choose, Tab or Enter to take one): the chat and
 * the game invites both use it. Enter with no suggestion open submits the surrounding form as usual.
 */
export function MentionInput({
  value,
  onChange,
  inputRef,
  label,
  placeholder,
  maxLength,
  onEscape,
}: {
  value: string;
  onChange: (text: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  label: string;
  placeholder: string;
  maxLength?: number;
  onEscape?: (input: HTMLInputElement) => void;
}) {
  const myName = useHud((s) => s.me?.name);
  const [picked, setPicked] = useState(0);
  const suggestions = useSuggestions(typingMention(value), myName);
  const shown = Math.min(picked, suggestions.length - 1);

  const pick = (name: string) => {
    onChange(`${value.replace(/@[a-z0-9._-]*$/i, `@${name}`)} `);
    setPicked(0);
    inputRef?.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setPicked((i) => (i + step + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        pick(suggestions[shown]!);
        return;
      }
    }
    if (e.key === "Escape") onEscape?.(e.currentTarget);
  };

  return (
    <span className="mention-input">
      {suggestions.length > 0 && (
        <ul className="suggestions" aria-label="Mention someone">
          {suggestions.map((name, i) => (
            <li key={name}>
              <button
                type="button"
                aria-pressed={i === shown}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus in the input
                  pick(name);
                }}
              >
                @{name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={inputRef}
        aria-label={label}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value);
          setPicked(0);
        }}
        onKeyDown={onKeyDown}
      />
    </span>
  );
}
