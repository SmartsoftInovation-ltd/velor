import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import { FaArrowLeft, FaEdit, FaUser, FaEnvelope, FaPhone, FaShieldAlt, FaCalendarAlt } from "react-icons/fa";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Badge from "../../components/ui/badge/Badge";
import Button from "../../components/ui/button/Button";
import axiosSecure from "../../hooks/useAxiosSecure";
import { User } from "../../components/tables/UserTable/UserTable";

// ---------- Helpers ----------
const Field = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
      {label}
    </p>
    <p className="text-sm text-gray-700 dark:text-gray-200">
      {value || <span className="text-gray-300 dark:text-gray-600">—</span>}
    </p>
  </div>
);

const UserView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: user, isLoading, isError } = useQuery<User>({
    queryKey: ["user", id],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/auth/get-user-added-by-admin");
      const list: User[] = data?.data || [];
      const found = list.find((u) => u._id === id);
      if (!found) throw new Error("User not found");
      return found;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-500 font-semibold">User not found.</p>
        <Button onClick={() => navigate("/userlist")} variant="outline" className="rounded-xl px-6">
          Back to User List
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageMeta title={`${user.name} - User View`} description="View user details" />
      <PageBreadcrumb pageTitle="User Details" />

      <div className="max-w-3xl mx-auto space-y-5 mt-6">
        {/* Top action bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/userlist")}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-brand-500 transition-colors font-medium"
          >
            <FaArrowLeft className="size-3.5" />
            Back to Users
          </button>
          <Button
            onClick={() => navigate(`/user-edit/${user._id}`)}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold text-sm transition-all active:scale-95"
          >
            <FaEdit className="size-3.5" />
            Edit User
          </Button>
        </div>

        {/* Profile card */}
        <div className="rounded-2xl border border-gray-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden shadow-theme-sm">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6 bg-gradient-to-r from-brand-50 to-transparent dark:from-brand-500/5 dark:to-transparent border-b border-gray-100 dark:border-white/[0.06]">
            {user.image?.url ? (
              <img
                src={user.image.url}
                alt={user.name}
                className="size-24 rounded-2xl object-cover border-4 border-white dark:border-gray-800 shadow-lg flex-shrink-0"
              />
            ) : (
              <div className="size-24 rounded-2xl bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center flex-shrink-0 shadow-lg border-4 border-white dark:border-gray-800">
                <span className="text-3xl font-bold text-brand-600 dark:text-brand-400">
                  {user.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex flex-col items-center sm:items-start gap-2 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  size="sm"
                  variant="solid"
                  color={user.isActive ? "success" : "error"}
                  className="font-black text-[10px] uppercase"
                >
                  {user.isActive ? "Active" : "Inactive"}
                </Badge>
                {user.roles && user.roles.length > 0 && (
                  <Badge size="sm" variant="light" color="primary" className="font-semibold text-[11px]">
                    {user.roles[0].name}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <FaUser className="size-4 text-blue-500" />
              </div>
              <Field label="Full Name" value={user.name} />
            </div>

            <div className="flex items-start gap-3">
              <div className="size-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <FaEnvelope className="size-4 text-purple-500" />
              </div>
              <Field label="Email Address" value={user.email} />
            </div>

            <div className="flex items-start gap-3">
              <div className="size-9 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <FaPhone className="size-4 text-green-500" />
              </div>
              <Field label="Phone" value={user.phone} />
            </div>

            <div className="flex items-start gap-3">
              <div className="size-9 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <FaShieldAlt className="size-4 text-orange-500" />
              </div>
              <Field
                label="Assigned Role"
                value={
                  user.roles && user.roles.length > 0 ? (
                    <span className="font-semibold text-brand-600 dark:text-brand-400">
                      {user.roles[0].name}
                    </span>
                  ) : undefined
                }
              />
            </div>

            <div className="flex items-start gap-3">
              <div className="size-9 rounded-xl bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center flex-shrink-0">
                <FaCalendarAlt className="size-4 text-gray-500" />
              </div>
              <Field
                label="Created At"
                value={user.createdAt ? moment(user.createdAt).format("MMM DD, YYYY · hh:mm A") : undefined}
              />
            </div>

            <div className="flex items-start gap-3">
              <div className={`size-9 rounded-xl flex items-center justify-center flex-shrink-0 ${user.isActive ? "bg-green-50 dark:bg-green-500/10" : "bg-red-50 dark:bg-red-500/10"}`}>
                <span className={`text-xs font-black ${user.isActive ? "text-green-500" : "text-red-500"}`}>
                  {user.isActive ? "ON" : "OFF"}
                </span>
              </div>
              <Field
                label="Account Status"
                value={
                  <span className={`font-semibold ${user.isActive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                }
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UserView;
