/** The message under a checkout field the server refused; nothing when it is fine. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-micro text-danger-text">
      {message}
    </p>
  );
}
