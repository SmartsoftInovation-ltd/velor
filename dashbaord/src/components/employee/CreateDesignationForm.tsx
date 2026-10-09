import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import MobileActionBar from "../common/MobileActionBar";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { useFormDraft, draftValue, clearDraft } from "../../hooks/useFormDraft";

// Unsaved input survives a reload or a trip to another page in this tab
// (sessionStorage, per store); cleared once the form is submitted.
const DRAFT_KEY = "create-designation";

const CreateDesignationForm = () => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(() => draftValue(DRAFT_KEY, "name", ""));
  useFormDraft(
    DRAFT_KEY,
    useMemo(() => ({ name }), [name]),
  );
  const [nameError, setNameError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { setNameError("Designation name is required."); return; }
    setIsCreating(true);
    try {
      await axiosSecure.post("/employee/create-employee-designation", { name: name.trim() });
      toast.success("Designation created successfully!");
      clearDraft(DRAFT_KEY);
      queryClient.invalidateQueries({ queryKey: ["designations"] });
      setName("");
      setNameError("");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create designation.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="designation-name">
          Designation Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="designation-name"
          type="text"
          placeholder="e.g. Software Engineer, Manager..."
          value={name}
          onChange={(e) => { setName(e.target.value); setNameError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !isCreating) handleSubmit(); }}
          className={nameError ? "border-red-500 focus:border-red-500" : ""}
        />
        {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
      </div>

      <MobileActionBar>
      <Button
        onClick={handleSubmit}
        disabled={isCreating}
          className="w-full py-2.5 !bg-accent-500 hover:!bg-accent-600 !text-white rounded-xl font-semibold border-none transition-all active:scale-95 disabled:opacity-60"
      >
        {isCreating ? (
          <div className="flex items-center justify-center gap-2">
            <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Creating...</span>
          </div>
        ) : "Create Designation"}
      </Button>
      </MobileActionBar>
    </div>
  );
};

export default CreateDesignationForm;
