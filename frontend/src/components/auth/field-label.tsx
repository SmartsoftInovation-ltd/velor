import type { ReactNode } from "react";

/** The red mark after a required field's label. The input's own `required` is what screen readers announce. */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-1 text-small leading-none font-bold text-danger-solid">
      *
    </span>
  );
}

/** A form label, with the red asterisk when the field is required */
export function FieldLabel({
  htmlFor,
  id,
  required = false,
  children,
}: {
  htmlFor?: string;
  id?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const className = "mb-1.5 block text-caption font-medium text-text-secondary";
  const content = (
    <>
      {children}
      {required ? <RequiredMark /> : null}
    </>
  );
  return htmlFor ? (
    <label htmlFor={htmlFor} id={id} className={className}>
      {content}
    </label>
  ) : (
    <p id={id} className={className}>
      {content}
    </p>
  );
}
