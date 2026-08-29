import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";

const CreateRoleForm = ({ onCreated }: { onCreated: () => void }) => {
  const queryClient = useQueryClient();
  const [roleName, setRoleName] = useState("");
  const [nameError, setNameError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async () => {
    if (!roleName.trim()) { setNameError("Role name is required."); return; }
    setIsCreating(true);
    try {
      await axiosSecure.post("/create-role", { name: roleName.trim() });
      toast.success("Role created successfully!");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      onCreated();
      setRoleName("");
      setNameError("");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create role.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="role-name">
          Role Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="role-name"
          type="text"
          placeholder="e.g. Admin, Warehouse, Manager..."
          value={roleName}
          onChange={(e) => { setRoleName(e.target.value); setNameError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          className={nameError ? "border-red-500 focus:border-red-500" : ""}
        />
        {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isCreating}
          className="w-full py-2.5 bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] rounded-xl font-semibold border-none transition-all active:scale-95 disabled:opacity-60"
      >
        {isCreating ? (
          <div className="flex items-center justify-center gap-2">
            <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Creating...</span>
          </div>
        ) : "Create Role"}
      </Button>
    </div>
  );
};

export default CreateRoleForm;
