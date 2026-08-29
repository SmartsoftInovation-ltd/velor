import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import toast from "react-hot-toast";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import ComponentCard from "../common/ComponentCard";
import axiosSecure from "../../hooks/useAxiosSecure";

const RoleUpdate = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [roleName, setRoleName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const res = await axiosSecure.get(`/singlerole/${slug}`);
        setRoleName(res.data.data.name);
      } catch (error) {
        toast.error("Failed to fetch role");
        console.error(error);
      }
    };
    if (slug) fetchRole();
  }, [slug]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axiosSecure.put(`/updaterole/${slug}`, {
        name: roleName,
      });
      toast.success("Role updated successfully");
      navigate("/create-role");
    } catch (error) {
      toast.error("Failed to update role");
      console.error("Update error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="Update Product Inventory"
      />
      <PageBreadcrumb pageTitle="Update Product Inventory" />
      <div className="space-y-6">
        <ComponentCard title="Product Inventory Update">
          <form onSubmit={handleUpdate}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col">
                <Label htmlFor="roleName">Role Name</Label>
                <Input
                  id="roleName"
                  name="roleName"
                  type="text"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="Enter new role name"
                />
              </div>
            </div>

            <div className="mt-6">
              <Button disabled={loading}>
                {loading ? "Updating..." : "Update Role"}
              </Button>
            </div>
          </form>
        </ComponentCard>
      </div>
    </>
  );
};

export default RoleUpdate;
