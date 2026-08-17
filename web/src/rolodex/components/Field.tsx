import type { ReactNode } from "react";

/**
 * A labelled control. The label wraps its input rather than pointing at an id: nothing has to
 * invent unique ids, and the association holds however the field is composed.
 */
export function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  // The hint sits outside the label: inside it, it would become part of the control's name.
  return (
    <div className={`field${wide ? " span2" : ""}`}>
      <label className="field-wrap">
        <span className="field-label">{label}</span>
        {children}
      </label>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/** The same, for a group of buttons or chips that has no single control to wrap. */
export function FieldGroup({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`field${wide ? " span2" : ""}`}
      role="group"
      aria-label={label}
    >
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
