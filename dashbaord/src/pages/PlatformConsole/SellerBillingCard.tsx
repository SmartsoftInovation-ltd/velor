import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { errorMessage } from "../../platform/api";
import { tenantsApi } from "../../platform/endpoints";
import type { BillingCycle, Tenant } from "../../platform/types";
import { BILLING_CYCLES, nextRenewal } from "./billing";
import BillingDateField from "./BillingDateField";
import { cardClass, Field, inputClass, primaryButtonClass, secondaryButtonClass, Select } from "./ui";

// What the platform sold this store for, and when it renews. Feeds the
// Platform Console dashboard. Only a superadmin edits it.

const toInput = (value: string | null | undefined) => (value ? value.slice(0, 10) : "");

const formOf = (seller: Tenant) => ({
  price: seller.billing?.price ? String(seller.billing.price) : "",
  cycle: (seller.billing?.cycle ?? "monthly") as BillingCycle,
  startedAt: toInput(seller.billing?.startedAt),
  renewsAt: toInput(seller.billing?.renewsAt),
});

const SellerBillingCard = ({ seller, canEdit }: { seller: Tenant; canEdit: boolean }) => {
  const queryClient = useQueryClient();
  const initial = formOf(seller);
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(formOf(seller)), [seller]);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = useMutation({
    mutationFn: () =>
      tenantsApi.update(seller._id, {
        billing: {
          price: form.price === "" ? 0 : Number(form.price),
          cycle: form.cycle,
          startedAt: form.startedAt || null,
          renewsAt: form.cycle === "one-time" ? null : form.renewsAt || null,
        },
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["platform", "tenant", seller._id], updated);
      queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
      queryClient.invalidateQueries({ queryKey: ["platform", "dashboard"] });
      toast.success("Billing saved");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  // Changing the start or the cycle moves the renewal along with it; the
  // renewal date can still be set by hand afterwards
  const setStart = (startedAt: string) =>
    setForm((f) => ({ ...f, startedAt, renewsAt: nextRenewal(startedAt, f.cycle) || f.renewsAt }));
  const setCycle = (cycle: BillingCycle) =>
    setForm((f) => ({ ...f, cycle, renewsAt: cycle === "one-time" ? "" : nextRenewal(f.startedAt, cycle) || f.renewsAt }));

  return (
    <section className={`${cardClass} p-6 lg:col-span-3`}>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">Billing</h2>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        What this seller pays the platform, and when it renews. Shown on the Platform Console dashboard.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
        className="mt-5 space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="billing-price" label="Price (৳)" hint={form.cycle === "one-time" ? "Paid once" : `Per ${form.cycle === "monthly" ? "month" : "year"}`}>
            <input
              id="billing-price"
              type="number"
              min={0}
              placeholder="0"
              className={inputClass}
              value={form.price}
              readOnly={!canEdit}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </Field>
          <Field id="billing-cycle" label="Billing cycle">
            <Select
              id="billing-cycle"
              value={form.cycle}
              onChange={(v) => setCycle(v as BillingCycle)}
              options={BILLING_CYCLES}
              disabled={!canEdit}
            />
          </Field>
          <Field id="billing-start" label="Sold on" hint="When this seller started paying">
            <BillingDateField id="billing-start" value={form.startedAt} readOnly={!canEdit} onChange={setStart} />
          </Field>
          <Field id="billing-renews" label="Renews on" hint={form.cycle === "one-time" ? "No renewal for a one-time sale" : "Next payment due"}>
            <BillingDateField
              id="billing-renews"
              value={form.renewsAt}
              readOnly={!canEdit}
              disabled={form.cycle === "one-time"}
              onChange={(renewsAt) => setForm((f) => ({ ...f, renewsAt }))}
            />
          </Field>
        </div>
        {canEdit && (
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" disabled={!dirty} onClick={() => setForm(initial)} className={secondaryButtonClass}>
              Reset
            </button>
            <button type="submit" disabled={!dirty || save.isPending} className={primaryButtonClass}>
              {save.isPending ? "Saving…" : "Save billing"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
};

export default SellerBillingCard;
