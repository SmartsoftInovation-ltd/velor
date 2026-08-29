import { useEffect, useState } from "react";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import CreatePermissionForm from "../../components/rolepermission/CreatePermissionForm";
import PermissionTable from "../../components/tables/RolePermissionTable/PermissionTable";
import axiosSecure from "../../hooks/useAxiosSecure";

const CreatePermission = () => {
  const [permission, setPermission] = useState([]);
  const fetchPermission = async () => {
    try {
      const { data } = await axiosSecure.get(
        `/permission/allpermissions`
      );
      setPermission(data.data);
    } catch (error) {
      console.error("Error fetching permission:", error);
    }
  };
  useEffect(() => {
    fetchPermission();
  }, []);
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      <PageBreadcrumb pageTitle="Create Permission" />
      <div className="space-y-6">
        <ComponentCard title="Create Permission">
          <CreatePermissionForm />
        </ComponentCard>
        <ComponentCard title="Permission List">
          <PermissionTable permission={permission} />
        </ComponentCard>
      </div>
    </>
  );
};

export default CreatePermission;
