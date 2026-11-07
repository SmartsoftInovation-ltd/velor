import { StoreTag } from "./sign-up-heading";

/** The top of the sign-in form: one heading, and the shop the account belongs to. */
export function SignInHeading({ storeName }: { storeName: string }) {
  return (
    <div className="animate-rise-in">
      <h1 className="text-h1 font-bold tracking-tight text-text-primary">
        Welcome <span className="text-text-brand">back</span>
      </h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-body text-text-secondary">
        Sign in to
        <StoreTag storeName={storeName} />
      </p>
    </div>
  );
}
