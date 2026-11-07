/** The form-level message above an auth form: an error, or a neutral note */
export function FormAlert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "info" }) {
  return tone === "error" ? (
    <p role="alert" className="rounded-md border border-danger-solid/30 bg-danger-subtle px-3 py-2.5 text-small text-danger-text">
      {children}
    </p>
  ) : (
    <p role="status" className="rounded-md border border-border-default bg-bg-sunken px-3 py-2.5 text-small text-text-secondary">
      {children}
    </p>
  );
}
