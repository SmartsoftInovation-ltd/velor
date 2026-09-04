import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";

interface Permission {
  actions: string[];
  _id: number;
  permissionName: string;
  slug: string;
  isActive: boolean;
}
interface PermissionTableProps {
  permission: Permission[];
}
export default function PermissionTable({ permission }: PermissionTableProps) {
  const tableData: Permission[] = permission ?? [];

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Serial No.
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Permission Name
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Create User Permission
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {tableData.map((permission, index) => (
                <TableRow key={permission._id} className="dark:text-gray-400">
                  <TableCell className="px-4 py-3 text-theme-sm">
                    {index + 1}.
                  </TableCell>
                  <TableCell className="px-4 py-3 text-theme-sm">
                    {permission.permissionName}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-theme-sm">
                    <div className="flex space-x-6">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          className="accent-blue-500 rounded border-gray-300 dark:border-gray-600"
                        />
                        <span className="capitalize">view</span>
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          className="accent-blue-500 rounded border-gray-300 dark:border-gray-600"
                        />
                        <span className="capitalize">add</span>
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          className="accent-blue-500 rounded border-gray-300 dark:border-gray-600"
                        />
                        <span className="capitalize">edit</span>
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          className="accent-blue-500 rounded border-gray-300 dark:border-gray-600"
                        />
                        <span className="capitalize">delete</span>
                      </label>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
