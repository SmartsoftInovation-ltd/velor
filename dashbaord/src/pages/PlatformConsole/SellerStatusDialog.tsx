import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiAlertTriangle, FiPlay } from "react-icons/fi";
import { errorMessage } from "../../platform/api";
import { tenantsApi } from "../../platform/endpoints";
import type { Tenant } from "../../platform/types";
import { Field, inputClass, Modal, primaryButtonClass, secondaryButtonClass } from "./ui";

export const canSuspend = (seller: Tenant) => seller.status === "active" || seller.status === "provisioning";

// Suspend (with a reason) or re-activate a seller
const SellerStatusDialog = ({ seller, onClose, onDone }: { seller: Tenant; onClose: () => void; onDone: (seller: Tenant) => void }) => {
  const suspending = canSuspend(seller);
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () => (suspending ? tenantsApi.suspend(seller._id, reason.trim()) : tenantsApi.activate(seller._id)),
    onSuccess: (updated) => {
      toast.success(suspending ? `${seller.name} suspended` : `${seller.name} is live again`);
      onDone(updated);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Modal
      title={`${suspending ? "Suspend" : "Activate"} ${seller.name}`}
      icon={suspending ? <FiAlertTriangle className="text-warning-600" /> : <FiPlay />}
      description={
        suspending
          ? "Staff are signed out and the seller's dashboard shows “Store unavailable” until you activate it again."
          : "Staff can sign in again and the storefront comes back online."
      }
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
        className="space-y-5"
      >
        {suspending && (
          <Field id="suspend-reason" label="Reason" hint="Shown in the audit log.">
            <input id="suspend-reason" className={inputClass} placeholder="e.g. Unpaid invoice" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className={
              suspending
                ? "inline-flex h-10 items-center rounded-xl bg-error-500 px-4 text-sm font-semibold text-white transition hover:bg-error-600 disabled:opacity-60"
                : primaryButtonClass
            }
          >
            {suspending ? "Suspend seller" : "Activate seller"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default SellerStatusDialog;
