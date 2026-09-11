import React, {useEffect, useState} from 'react';

// Liten UI-kit for admin-/arbeidsflatene. Rolige flater, tydelige
// handlinger, lesbare lister — samme tokens som markedssidene.

export function Button({
  primary,
  danger,
  busy,
  children,
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {primary?: boolean; danger?: boolean; busy?: boolean}) {
  return (
    <button
      className={`ui-btn ${primary ? 'ui-btn-primary' : ''} ${danger ? 'ui-btn-danger' : ''} ${className}`}
      disabled={busy || rest.disabled}
      {...rest}>
      {busy ? 'Vent …' : children}
    </button>
  );
}

export function Field({
  label,
  value,
  onChange,
  hint,
  textarea,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  textarea?: boolean;
}) {
  const id = React.useId();
  return (
    <label className="ui-field" htmlFor={id}>
      <span className="ui-label">{label}</span>
      {textarea ? (
        <textarea id={id} className="ui-input" value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
      ) : (
        <input id={id} className="ui-input" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      )}
      {hint && <span className="ui-hint">{hint}</span>}
    </label>
  );
}

export function Notice({tone = 'info', children}: {tone?: 'info' | 'error' | 'success' | 'warn'; children: React.ReactNode}) {
  return <div className={`ui-notice ui-notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function Badge({tone = 'neutral', children}: {tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info'; children: React.ReactNode}) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>;
}

export function Card({title, aside, children, className = ''}: {title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string}) {
  return (
    <section className={`ui-card ${className}`}>
      {(title || aside) && (
        <header className="ui-card-head">
          {title && <h3>{title}</h3>}
          {aside && <div className="ui-card-aside">{aside}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Spinner({label = 'Laster …'}: {label?: string}) {
  return <div className="ui-spinner" role="status">{label}</div>;
}

export function Empty({children}: {children: React.ReactNode}) {
  return <div className="ui-empty">{children}</div>;
}

export function Row({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div className="ui-row">
      <span className="ui-row-label">{label}</span>
      <span className="ui-row-value">{children}</span>
    </div>
  );
}

/**
 * Handlingsdialog med (valgfritt påkrevd) begrunnelse — alle skrivende
 * ops-/manager-handlinger går gjennom denne så begrunnelsen aldri glemmes.
 */
export interface PromptSpec {
  title: string;
  message?: React.ReactNode;
  placeholder?: string;
  confirm: string;
  destructive?: boolean;
  requireNote?: boolean;
  /** Ekstra felt (navn/e-post) — verdiene kommer tilbake i `run`. */
  fields?: {key: string; label: string; type?: string; required?: boolean}[];
  run: (note: string, fields: Record<string, string>) => Promise<string | void>;
}

export function PromptDialog({spec, onClose, onDone}: {spec: PromptSpec | null; onClose: () => void; onDone: (msg?: string) => void}) {
  const [note, setNote] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setNote('');
    setFields({});
    setError(null);
    setBusy(false);
  }, [spec]);
  useEffect(() => {
    if (!spec) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [spec, onClose]);
  if (!spec) return null;
  const missing = (spec.requireNote && note.trim().length === 0) || (spec.fields ?? []).some((f) => f.required && !(fields[f.key] ?? '').trim());
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const msg = await spec.run(note.trim(), fields);
      onDone(msg ?? undefined);
    } catch (e) {
      setError((e as Error).message || 'Noe gikk galt.');
      setBusy(false);
    }
  };
  return (
    <div className="ui-modal-backdrop" onClick={onClose}>
      <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby="ui-modal-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="ui-modal-title">{spec.title}</h3>
        {spec.message && <div className="ui-modal-msg">{spec.message}</div>}
        {(spec.fields ?? []).map((f) => (
          <Field key={f.key} label={f.label} type={f.type ?? 'text'} value={fields[f.key] ?? ''} onChange={(v) => setFields((s) => ({...s, [f.key]: v}))} required={f.required} />
        ))}
        <Field label={spec.requireNote ? 'Begrunnelse (påkrevd — logges)' : 'Notat (valgfritt)'} value={note} onChange={setNote} textarea placeholder={spec.placeholder} />
        {error && <Notice tone="error">{error}</Notice>}
        <div className="ui-modal-actions">
          <Button type="button" onClick={onClose} disabled={busy}>Avbryt</Button>
          <Button type="button" primary={!spec.destructive} danger={spec.destructive} onClick={go} busy={busy} disabled={missing}>{spec.confirm}</Button>
        </div>
      </div>
    </div>
  );
}

/** Enkel toast for kvitteringer. */
export function useToast(): [React.ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg ? <div className="ui-toast" role="status">{msg}</div> : null, setMsg];
}

export function Tabs<T extends string>({value, onChange, items}: {value: T; onChange: (v: T) => void; items: {key: T; label: string; count?: number}[]}) {
  return (
    <div className="ui-tabs" role="tablist">
      {items.map((it) => (
        <button key={it.key} role="tab" aria-selected={value === it.key} className={value === it.key ? 'on' : ''} onClick={() => onChange(it.key)} type="button">
          {it.label}{typeof it.count === 'number' && it.count > 0 && <span className="ui-count">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}
