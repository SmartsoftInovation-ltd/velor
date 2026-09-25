import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";

type EntityType = "designation" | "department" | "section";

interface QuickCreateModalProps {
  type: EntityType;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (item: { _id: string; name: string }) => void;
}

const CONFIG: Record<EntityType, { label: string; endpoint: string }> = {
  designation: {
    label: "Designation",
    endpoint: "/employee/create-employee-designation",
  },
  department: {
    label: "Department",
    endpoint: "/employee/create-employee-department",
  },
  section: {
    label: "Section",
    endpoint: "/employee/create-employee-section",
  },
};

const QuickCreateModal = ({ type, isOpen, onClose, onCreated }: QuickCreateModalProps) => {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const cfg = CONFIG[type];

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(`${cfg.label} name is required.`);
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await axiosSecure.post(cfg.endpoint, { name: name.trim() });
      const created = data?.data;
      if (!created?._id) throw new Error("Invalid response");
      toast.success(`${cfg.label} created successfully!`);
      onCreated({ _id: created._id, name: created.name });
      setName("");
      setError("");
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to create ${cfg.label.toLowerCase()}.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-800 dark:text-white">
            Add {cfg.label}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <FaTimes className="size-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex flex-col">
            <Label htmlFor="quick-create-name">
              {cfg.label} Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="quick-create-name"
              type="text"
              placeholder={`Enter ${cfg.label.toLowerCase()} name`}
              value={name}
              className={error ? "border-red-500" : ""}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              onKeyDown={handleKeyDown}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
              className="px-5 py-2 rounded-xl bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] text-sm font-semibold border-none disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating...</span>
              </div>
            ) : `Create ${cfg.label}`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuickCreateModal;
