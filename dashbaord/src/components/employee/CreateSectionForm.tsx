import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";

const CreateSectionForm = () => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) { setNameError("Section name is required."); return; }
    setIsCreating(true);
    try {
      await axiosSecure.post("/employee/create-employee-section", { name: name.trim() });
      toast.success("Section created successfully!");
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      setName("");
      setNameError("");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create section.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="section-name">
          Section Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="section-name"
          type="text"
          placeholder="e.g. Sales, Operations, Support..."
          value={name}
          onChange={(e) => { setName(e.target.value); setNameError(""); }}
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
        ) : "Create Section"}
      </Button>
    </div>
  );
};

export default CreateSectionForm;
