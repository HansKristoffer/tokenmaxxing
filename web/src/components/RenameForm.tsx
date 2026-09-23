import { useState } from "react";

interface Props {
  value: string;
  label: string;
  maxLength: number;
  /** Throws on failure; `errorText` turns the error into the message shown. */
  save: (name: string) => Promise<unknown>;
  errorText: (err: unknown) => string;
  onDone: () => void;
  onCancel: () => void;
}

/** Inline rename: Enter saves, Escape cancels. The server trims and checks the name. */
export function RenameForm({ value, label, maxLength, save, errorText, onDone, onCancel }: Props) {
  const [name, setName] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (name.trim() === value) return onCancel();
    setSaving(true);
    setError(null);
    try {
      await save(name);
      onDone();
    } catch (err) {
      setError(errorText(err));
      setSaving(false);
    }
  };

  return (
    <form
      className="rename"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input
        // biome-ignore lint/a11y/noAutofocus: the user just asked to edit this field
        autoFocus
        aria-label={label}
        value={name}
        maxLength={maxLength}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      />
      <button type="submit" className="link" disabled={saving || name.trim() === ""}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" className="link" onClick={onCancel}>
        Cancel
      </button>
      {error && <span className="error">{error}</span>}
    </form>
  );
}
