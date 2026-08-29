import { useState } from "react";
import toast from "react-hot-toast";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import axiosSecure from "../../hooks/useAxiosSecure";

const CreatePermissionForm = () => {
  const [permissionName, setPermissionName] = useState("");
  const [actions, setActions] = useState<string>(""); // comma-separated actions
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissionName.trim()) {
      toast.error("Permission name is required.");
      return;
    }

    const actionArray = actions
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a);

    if (actionArray.length === 0) {
      toast.error("At least one action is required.");
      return;
    }

    setLoading(true);
    try {
      await axiosSecure.post(`/permission/addpermission`, {
        permissionName,
        actions: actionArray,
      });
      toast.success("Permission created successfully.");
      setPermissionName("");
      setActions("");
    } catch (error) {
      console.error("Error creating permission:", error);
      toast.error("Failed to create permission.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="flex flex-col">
        <Label htmlFor="permissionName">Permission Name</Label>
        <Input
          id="permissionName"
          name="permissionName"
          type="text"
          placeholder="e.g. brand"
          value={permissionName}
          onChange={(e) => setPermissionName(e.target.value)}
        />
      </div>
      <div className="flex flex-col">
        <Label htmlFor="actions">Action</Label>
        <Input
          id="actions"
          name="actions"
          type="text"
          placeholder="View"
          value={actions}
          onChange={(e) => setActions(e.target.value)}
        />
      </div>
      <Button disabled={loading}>
        {loading ? "Creating..." : "Create Permission"}
      </Button>
    </form>
  );
};

export default CreatePermissionForm;
