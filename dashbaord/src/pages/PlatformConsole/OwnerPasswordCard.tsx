import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { errorMessage } from "../../platform/api";
import { tenantsApi, type CredentialsNotice, type OwnerSummary } from "../../platform/endpoints";
import { NEW_PASSWORD_MIN } from "../../lib/credentials";
import { cardClass, CredentialsNoticeLine, Field, inputClass, primaryButtonClass } from "./ui";

// Support sets a new password for a seller's owner (e.g. when they forgot it).
// The owner is signed out everywhere and, optionally, sent the new details.
const OwnerPasswordCard = ({ tenantId }: { tenantId: string }) => {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [notify, setNotify] = useState(true);
  const [result, setResult] = useState<{ owner: OwnerSummary; notification: CredentialsNotice; notified: boolean } | null>(null);

  const save = useMutation({
    mutationFn: () => tenantsApi.setOwnerPassword(tenantId, { password, notify }),
    onSuccess: (data) => {
      setResult({ ...data, notified: notify });
      setPassword("");
      setShow(false);
      toast.success(
        notify ? "New password set. Sign-in details sent to the owner." : "New password set for the owner.",
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <section className={`${cardClass} p-6 lg:col-span-3`}>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">Owner password</h2>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        Set a new password for this seller&apos;s owner. They are signed out on every device.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (password.length < NEW_PASSWORD_MIN) {
            toast.error(`Password must be at least ${NEW_PASSWORD_MIN} characters`);
            return;
          }
          setResult(null);
          save.mutate();
        }}
        className="mt-5 space-y-4"
      >
        <Field id="owner-new-password" label="New password" hint={`At least ${NEW_PASSWORD_MIN} characters.`}>
          <div className="relative">
            <input
              id="owner-new-password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              className={`${inputClass} pr-11`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
            >
              {show ? <FiEyeOff className="size-4" /> : <FiEye className="size-4" />}
            </button>
          </div>
        </Field>
        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            className="size-4 cursor-pointer accent-accent-500"
          />
          Send the new sign-in details to the owner by SMS
        </label>
        {result?.notified && <CredentialsNoticeLine notice={result.notification} owner={result.owner} />}
        <div className="flex justify-end">
          <button type="submit" disabled={!password || save.isPending} className={primaryButtonClass}>
            {save.isPending ? "Saving…" : "Set owner password"}
          </button>
        </div>
      </form>
    </section>
  );
};

export default OwnerPasswordCard;
