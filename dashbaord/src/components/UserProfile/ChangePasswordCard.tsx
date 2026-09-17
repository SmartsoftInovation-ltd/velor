import { useState } from "react";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import axios from "axios";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useAuth } from "../../context/AuthContext";
import axiosSecure, { clearAccessToken } from "../../hooks/useAxiosSecure";
import { NEW_PASSWORD_MIN } from "../../lib/credentials";
import { getWorkspace } from "../../lib/session";

const empty = { oldPassword: "", newPassword: "", confirm: "" };

// Changing the password ends every session, this one included, so the user
// signs in again with the new password.
export default function ChangePasswordCard() {
  const navigate = useNavigate();
  const { clearAuth } = useAuth();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof empty) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.oldPassword) return setError("Enter your current password.");
    if (form.newPassword.length < NEW_PASSWORD_MIN) return setError(`New password must be at least ${NEW_PASSWORD_MIN} characters.`);
    if (form.newPassword !== form.confirm) return setError("New passwords do not match.");
    if (form.newPassword === form.oldPassword) return setError("Choose a password different from the current one.");
    setError("");

    setSaving(true);
    try {
      await axiosSecure.post("/auth/change-password", { oldPassword: form.oldPassword, newPassword: form.newPassword });
      toast.success("Password changed. Sign in with your new password.");
      const workspace = getWorkspace();
      clearAccessToken();
      clearAuth();
      navigate(`/signin${workspace ? `?workspace=${encodeURIComponent(workspace)}` : ""}`, { replace: true });
    } catch (err) {
      setError(axios.isAxiosError(err) && err.response?.data?.message ? err.response.data.message : "Could not change the password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
      <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">Change password</h4>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        You will be signed out on every device and sign in again with the new password.
      </p>
      <form onSubmit={submit} noValidate className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div>
          <Label htmlFor="current-password">Current password</Label>
          <Input id="current-password" type="password" autoComplete="current-password" value={form.oldPassword} onChange={set("oldPassword")} />
        </div>
        <div>
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" value={form.newPassword} onChange={set("newPassword")} />
        </div>
        <div>
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-error-500 lg:col-span-3">
            {error}
          </p>
        )}
        <div className="flex justify-end lg:col-span-3">
          <Button size="sm" disabled={saving}>
            {saving ? "Saving…" : "Change password"}
          </Button>
        </div>
      </form>
    </div>
  );
}
