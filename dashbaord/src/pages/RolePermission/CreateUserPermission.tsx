import { useEffect, useRef, useState } from "react";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import MobileActionBar from "../../components/common/MobileActionBar";
import axiosSecure from "../../hooks/useAxiosSecure";
import { usePermissionDraft } from "../../hooks/usePermissionDraft";
import toast from "react-hot-toast";
import {
  FaSearch, FaTimes, FaChevronDown, FaUser, FaCheckSquare,
  FaShieldAlt, FaListUl, FaEye, FaPlus, FaEdit, FaTrash, FaPrint,
} from "react-icons/fa";
import { showApiError } from "../../utils/apiError";
import {
  type Action,
  type ModuleGroup,
  DASHBOARD_PARENT,
  MODULE_GROUPS,
  actionsForModule,
  isDashboardWidget,
} from "../../lib/permissionCatalog";

// ---------- Types ----------
interface Role {
  _id: string;
  name: string;
  slug: string;
}

interface UserImage {
  url?: string;
  status?: string;
}

interface User {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  roles?: Role[];
  image?: UserImage;
}

interface Permission {
  _id: string;
  permissionName: string;
  slug: string;
}

type Actions = Record<Action, boolean>;
type PermissionState = Record<string, Actions>;

// ---------- Helpers ----------
const emptyActions = (): Actions => ({ view: false, add: false, edit: false, delete: false, print: false });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconComponent = React.ComponentType<any>;

const ACTION_CONFIG: Record<Action, { icon: IconComponent; color: string; border: string; selectedBg: string; selectedColor: string; selectedBorder: string }> = {
  view:   { icon: FaEye,   color: "text-blue-600 dark:text-blue-400",   border: "border-blue-300 dark:border-blue-600",   selectedBg: "bg-blue-500 dark:bg-blue-500/40",    selectedColor: "text-white dark:text-blue-100",   selectedBorder: "border-blue-600 dark:border-blue-400" },
  add:    { icon: FaPlus,  color: "text-green-600 dark:text-green-400", border: "border-green-300 dark:border-green-600",  selectedBg: "bg-green-500 dark:bg-green-500/40",  selectedColor: "text-white dark:text-green-100",  selectedBorder: "border-green-600 dark:border-green-400" },
  edit:   { icon: FaEdit,  color: "text-amber-600 dark:text-amber-400", border: "border-amber-300 dark:border-amber-600",  selectedBg: "bg-amber-500 dark:bg-amber-500/40",  selectedColor: "text-white dark:text-amber-100",  selectedBorder: "border-amber-600 dark:border-amber-400" },
  delete: { icon: FaTrash, color: "text-red-600 dark:text-red-400",     border: "border-red-300 dark:border-red-600",     selectedBg: "bg-red-500 dark:bg-red-500/40",      selectedColor: "text-white dark:text-red-100",     selectedBorder: "border-red-600 dark:border-red-400" },
  print:  { icon: FaPrint, color: "text-purple-600 dark:text-purple-400", border: "border-purple-300 dark:border-purple-600", selectedBg: "bg-purple-500 dark:bg-purple-500/40", selectedColor: "text-white dark:text-purple-100", selectedBorder: "border-purple-600 dark:border-purple-400" },
};

// ---------- Action Toggle ----------
interface ToggleProps { checked: boolean; onChange: () => void; action: Action }

const ActionToggle = ({ checked, onChange, action }: ToggleProps) => {
  const cfg = ACTION_CONFIG[action];
  const Icon = cfg.icon;
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative flex items-center gap-2 px-3 py-2 max-md:min-h-11 rounded-lg text-xs font-semibold transition-all duration-150 border select-none w-full justify-start
        ${checked
          ? `${cfg.selectedBg} ${cfg.selectedColor} ${cfg.selectedBorder} shadow-sm`
          : `bg-white dark:bg-gray-800/60 ${cfg.border} ${cfg.color} hover:opacity-80 active:scale-95`
        }`}
    >
      <Icon className="size-3" />
      <span className="capitalize">{action}</span>
    </button>
  );
};

// ---------- User Avatar ----------
const UserAvatar = ({ user, size = "sm", isSelected = false }: { user: User; size?: "sm" | "md"; isSelected?: boolean }) => {
  const imgUrl = user.image?.url && user.image.status === "uploaded" ? user.image.url : null;
  const sizeClass = size === "md" ? "size-10" : "size-9";
  if (imgUrl) {
    return (
      <img
        src={imgUrl}
        alt={user.name}
        className={`${sizeClass} rounded-xl object-cover shrink-0 border-2 ${isSelected ? "border-accent-400" : "border-gray-200 dark:border-gray-700"}`}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-xl flex items-center justify-center shrink-0 ${
      isSelected ? "bg-gradient-to-br from-accent-400 to-accent-600 shadow-sm shadow-accent-500/30" : "bg-gray-100 dark:bg-gray-800"
    }`}>
      <span className={`${size === "md" ? "text-sm" : "text-xs"} font-black ${isSelected ? "text-white" : "text-gray-500 dark:text-gray-400"}`}>
        {user.name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
};

// ---------- User Searchable Dropdown ----------
interface UserDropdownProps {
  users: User[];
  value: string;
  onChange: (id: string) => void;
}

const UserDropdown = ({ users, value, onChange }: UserDropdownProps) => {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selected = users.find((u) => u._id === value);

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.phone || "").toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setSearch(""); }}
        className={`w-full h-14 flex items-center justify-between gap-3 px-4 rounded-xl border text-sm transition-all
          ${open ? "border-accent-500 ring-2 ring-accent-500/20" : "border-gray-200 dark:border-gray-700"}
          bg-white dark:bg-gray-900 shadow-theme-xs`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {selected ? (
            <UserAvatar user={selected} size="sm" isSelected />
          ) : (
            <div className="size-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
              <FaUser className="size-3.5 text-gray-400" />
            </div>
          )}
          <div className="min-w-0 text-left">
            {selected ? (
              <>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate leading-none">{selected.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {selected.email && <p className="text-xs text-gray-400 truncate">{selected.email}</p>}
                  {selected.phone && <span className="text-xs text-gray-400">• {selected.phone}</span>}
                  {selected.roles && selected.roles.length > 0 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 text-[10px] font-bold">
                      {selected.roles[0].name}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <span className="text-gray-400 text-sm">Select a user...</span>
            )}
          </div>
        </div>
        <FaChevronDown className={`size-3.5 text-gray-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-2.5 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email or phone..."
                className="w-full h-9 pl-9 pr-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-accent-400 transition"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">No users found</div>
            ) : (
              filtered.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => { onChange(u._id); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-colors
                    ${u._id === value ? "bg-accent-50 dark:bg-accent-500/10" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                >
                  <UserAvatar user={u} size="md" isSelected={u._id === value} />
                  <div className="min-w-0 text-left flex-1">
                    <p className={`text-sm font-semibold truncate ${u._id === value ? "text-accent-600 dark:text-accent-400" : "text-gray-800 dark:text-gray-200"}`}>
                      {u.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {u.email && <p className="text-xs text-gray-400 truncate">{u.email}</p>}
                      {u.phone && <span className="text-xs text-gray-400">• {u.phone}</span>}
                      {u.roles && u.roles.length > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[10px] font-bold">
                          {u.roles[0].name}
                        </span>
                      )}
                    </div>
                  </div>
                  {u._id === value && <FaCheckSquare className="size-4 text-accent-500 shrink-0 ml-auto" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Module Permission Card ----------
interface ModuleCardProps {
  name: string;
  permissions: Actions | undefined;
  onToggle: (action: Action) => void;
  onToggleAll: () => void;
}

const ModuleCard = ({ name, permissions, onToggle, onToggleAll }: ModuleCardProps) => {
  const moduleActions = actionsForModule(name);
  const allOn  = moduleActions.every((a) => permissions?.[a]);
  const someOn = moduleActions.some((a) => permissions?.[a]);

  return (
    <div className="group relative rounded-2xl border transition-all duration-200 overflow-hidden h-full flex flex-col border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] hover:border-gray-300 dark:hover:border-white/[0.12] hover:shadow-sm">
      {someOn && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-accent-400 to-accent-600 rounded-l-2xl" />}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2.5 truncate">{name}</p>
        <div className={`grid gap-1.5 mb-2 flex-1 ${moduleActions.length <= 2 ? "grid-cols-1" : "grid-cols-2"}`}>
          {moduleActions.map((action, idx) => {
            const isLastOdd = moduleActions.length > 2 && moduleActions.length % 2 === 1 && idx === moduleActions.length - 1;
            return (
              <div key={action} className={isLastOdd ? "col-span-2" : undefined}>
                <ActionToggle action={action} checked={permissions?.[action] || false} onChange={() => onToggle(action)} />
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onToggleAll}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-black transition-all duration-150 border active:scale-95
            ${allOn
 ?"bg-accent-500 text-white border-transparent shadow-sm"
              : someOn
 ?"bg-accent-50 dark:bg-accent-500/15 text-accent-700 dark:text-accent-400 border-accent-200 dark:border-accent-500/30"
                : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-accent-300"}`}
        >
          {/* One icon slot and one label slot, always in the same positions.
              Swapping whole fragments here made React reuse the wrong DOM node
              when several cards flipped in a single state update. */}
          <span className="flex items-center">
            {allOn ? <FaCheckSquare className="size-3" /> : <FaListUl className="size-3" />}
          </span>
          <span>{allOn ? "All Selected" : "Select All"}</span>
        </button>
      </div>
    </div>
  );
};

// ---------- Group Header ----------
interface GroupHeaderProps {
  group: ModuleGroup;
  allChecked: boolean;
  someChecked: boolean;
  onToggleAll: () => void;
}

const GroupHeader = ({ group, allChecked, someChecked, onToggleAll }: GroupHeaderProps) => {
  const Icon = group.icon;
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`size-9 rounded-xl bg-gradient-to-br ${group.color} flex items-center justify-center text-white text-sm shadow-sm shrink-0`}>
        <Icon />
      </div>
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex-1">{group.label}</h3>
      <button
        type="button"
        onClick={onToggleAll}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 border active:scale-95
          ${allChecked
 ?"bg-accent-500 text-white border-transparent shadow-md"
            : someChecked
 ?"bg-accent-50 dark:bg-accent-500/15 text-accent-700 dark:text-accent-400 border-accent-200 dark:border-accent-500/30"
              : "bg-white dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-accent-300 hover:shadow-sm"}`}
      >
        {allChecked ? (
          <span className="flex items-center gap-2"><FaCheckSquare className="size-3.5" /><span className="text-[11px] font-black uppercase tracking-wider">Deselect All</span></span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="flex items-center justify-center size-5 rounded-md bg-blue-100 dark:bg-blue-500/20"><FaEye className="size-2.5 text-blue-500 dark:text-blue-400" /></span>
              <span className="flex items-center justify-center size-5 rounded-md bg-green-100 dark:bg-green-500/20"><FaPlus className="size-2.5 text-green-500 dark:text-green-400" /></span>
              <span className="flex items-center justify-center size-5 rounded-md bg-amber-100 dark:bg-amber-500/20"><FaEdit className="size-2.5 text-amber-500 dark:text-amber-400" /></span>
              <span className="flex items-center justify-center size-5 rounded-md bg-red-100 dark:bg-red-500/20"><FaTrash className="size-2.5 text-red-500 dark:text-red-400" /></span>
            </span>
            <span className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
            <span className="text-[11px] font-black uppercase tracking-wider">Select All</span>
          </span>
        )}
      </button>
    </div>
  );
};


const OPTIONS = ["Allow to Buy price"];

// ---------- Main Page ----------
const CreateUserPermission = () => {
  const [users, setUsers]               = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [perms, setPerms]               = useState<Permission[]>([]);
  const [permissions, setPermissions]   = useState<PermissionState>({});
  const [options, setOptions]           = useState<string[]>([]);

  const [moduleSearch, setModuleSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPerms, setIsLoadingPerms] = useState(false);

  // Unsaved edits are kept in localStorage per user, so a refresh or an
  // accidental navigation does not lose the work.
  const { savedAt, restoreDraft, destroyDraft, hasDraft } = usePermissionDraft<{
    permissions: PermissionState;
    options: string[];
  }>({
    namespace: "user",
    targetId: selectedUser,
    value: { permissions, options },
    enabled: !!selectedUser && !isLoadingPerms,
  });

  const handleDestroyDraft = () => {
    destroyDraft();
    if (selectedUser) void handleUserChange(selectedUser);
    toast.success("Draft discarded — reloaded saved permissions");
  };

  useEffect(() => {
    axiosSecure.get("/auth/get-user-added-by-admin")
      .then((r) => setUsers(r.data.data || []))
      .catch((error) => showApiError(error, "Failed to fetch users"));
    axiosSecure.get("/permission/allpermissions")
      .then((r) => {
        const raw = r.data.data || [];
        setPerms(raw.map((p: Permission) => ({ ...p, _id: String(p._id) })));
      })
      .catch((error) => showApiError(error, "Failed to fetch permissions"));
  }, []);

  const handleUserChange = async (id: string) => {
    setSelectedUser(id);
    setPermissions({});
    setOptions([]);

    setIsLoadingPerms(true);
    try {
      const res = await axiosSecure.get(`/userpermission/get-user-permissions/${id}`);
      const existing: { _id: string; actions: string[]; hasPermission: boolean }[] =
        res.data?.data?.permissions || [];
      const initial: PermissionState = {};
      existing.forEach((entry) => {
        if (!entry.hasPermission) return;
        const permId = String(entry._id);
        const acts: Actions = emptyActions();
        (entry.actions as Action[]).forEach((a) => { if (a in acts) acts[a] = true; });
        initial[permId] = acts;
      });
      const serverOptions: string[] = res.data?.data?.user?.Options || [];

      // A stored draft is newer than what the server has, so it wins.
      const stored = restoreDraft();
      if (stored) {
        setPermissions(stored.permissions ?? initial);
        setOptions(stored.options ?? serverOptions);
        toast("Unsaved draft restored", { icon: "📝" });
      } else {
        setPermissions(initial);
        setOptions(serverOptions);
      }
    } catch {
      // user may have no permissions yet — start empty
    } finally {
      setIsLoadingPerms(false);
    }
  };

  // Switching on any dashboard widget also switches on the parent "Dashboard"
  // permission, since a widget is unreachable without access to the page.
  const withDashboardParent = (
    state: PermissionState,
    changedId: string,
  ): PermissionState => {
    const changed = perms.find((p) => p._id === changedId);
    if (!changed || !isDashboardWidget(changed.permissionName)) return state;

    const parent = perms.find((p) => p.permissionName === DASHBOARD_PARENT);
    if (!parent || state[parent._id]?.view) return state;

    return {
      ...state,
      [parent._id]: { ...emptyActions(), ...state[parent._id], view: true },
    };
  };

  // view is a prerequisite for add/edit/delete — you can't edit/delete what you can't see.
  // Turning on any of add/edit/delete auto-enables view; turning view off clears all others.
  const toggle = (id: string, action: Action) => {
    setPermissions((prev) => {
      const cur: Actions = { ...emptyActions(), ...prev[id] };
      const next = !cur[action];
      cur[action] = next;
      if (action === "view") {
        if (!next) { cur.add = false; cur.edit = false; cur.delete = false; cur.print = false; }
      } else if (next) {
        cur.view = true;
      }
      const state = { ...prev, [id]: cur };
      return cur.view ? withDashboardParent(state, id) : state;
    });
  };

  const toggleModule = (id: string, name: string) => {
    const moduleActions = actionsForModule(name);
    const allChecked = moduleActions.every((a) => permissions[id]?.[a]);
    setPermissions((prev) => {
      const next: Actions = { ...emptyActions(), ...prev[id] };
      moduleActions.forEach((a) => { next[a] = !allChecked; });
      const state = { ...prev, [id]: next };
      return allChecked ? state : withDashboardParent(state, id);
    });
  };

  const toggleGroup = (groupModules: string[], allOn: boolean) => {
    setPermissions((prev) => {
      const next = { ...prev };
      groupModules.forEach((modName) => {
        const perm = perms.find((p) => p.permissionName === modName);
        if (!perm) return;
        const moduleActions = actionsForModule(modName);
        const cur: Actions = { ...emptyActions(), ...next[perm._id] };
        moduleActions.forEach((a) => { cur[a] = !allOn; });
        next[perm._id] = cur;
      });
      return next;
    });
  };

  const toggleAllModules = () => {
    const allOn = perms.every((p) => actionsForModule(p.permissionName).every((a) => permissions[p._id]?.[a]));
    if (allOn) {
      setPermissions({});
    } else {
      const next: PermissionState = {};
      perms.forEach((p) => {
        const cur: Actions = emptyActions();
        actionsForModule(p.permissionName).forEach((a) => { cur[a] = true; });
        next[p._id] = cur;
      });
      setPermissions(next);
    }
  };

  const allModulesOn = perms.length > 0 && perms.every((p) => actionsForModule(p.permissionName).every((a) => permissions[p._id]?.[a]));
  const someModulesOn = perms.some((p) => actionsForModule(p.permissionName).some((a) => permissions[p._id]?.[a]));

  const filteredGroups = MODULE_GROUPS.map((g) => ({
    ...g,
    modules: g.modules.filter((m) => m.toLowerCase().includes(moduleSearch.toLowerCase())),
  })).filter((g) => g.modules.length > 0);

  const handleSubmit = async () => {
    if (!selectedUser) { toast.error("Please select a user"); return; }

    const formattedPermissions = Object.entries(permissions)
      .map(([permissionId, actions]) => {
        const activeActions = (Object.entries(actions) as [Action, boolean][])
          .filter(([, v]) => v)
          .map(([k]) => k);
        // safety net: any granted action implies view — never persist edit/delete without view
        if (activeActions.length > 0 && !activeActions.includes("view")) {
          activeActions.unshift("view");
        }
        return activeActions.length > 0 ? { permissionId, actions: activeActions } : null;
      })
      .filter(Boolean) as { permissionId: string; actions: string[] }[];



    try {
      setIsSubmitting(true);
      await axiosSecure.put(`/userpermission/update-user-permissions/${selectedUser}`, {
        permissions: formattedPermissions,
        Options: options,
      });
      toast.success("User permissions updated successfully!");
      destroyDraft();
      setSelectedUser("");
      setPermissions({});
      setOptions([]);

    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to update permissions");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageMeta title="User Permissions - Baig Ecommerce" description="Manage user module permissions" />
      <PageBreadcrumb pageTitle="User Permissions" />

      <div className="space-y-5">
        {/* ── User Selector ── */}
        <ComponentCard title="Select User">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              User <span className="text-red-500">*</span>
            </label>
            <UserDropdown users={users} value={selectedUser} onChange={handleUserChange} />
            {isLoadingPerms && (
              <p className="text-xs text-accent-500 flex items-center gap-1.5 mt-1">
                <span className="size-3 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin inline-block" />
                Loading user permissions...
              </p>
            )}
          </div>
        </ComponentCard>

        {/* ── Module Permissions ── */}
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.02] shadow-theme-sm overflow-hidden">
          {/* Panel header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-white/[0.05] bg-gray-50/50 dark:bg-white/[0.01]">
            <div className="flex items-center gap-2.5 flex-1">
              <div className="size-9 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-sm shadow-accent-500/30">
                <FaShieldAlt className="size-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-800 dark:text-white leading-none">Module Permissions</h2>
                <p className="text-xs text-gray-400 mt-0.5">{perms.length} modules available</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={toggleAllModules}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-150 border active:scale-95
                  ${allModulesOn
 ?"bg-accent-500 text-white border-transparent shadow-md"
                    : someModulesOn
 ?"bg-accent-50 dark:bg-accent-500/15 text-accent-700 dark:text-accent-400 border-accent-200 dark:border-accent-500/30"
                      : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-accent-300 hover:shadow-sm"}`}
              >
                {allModulesOn ? (
                  <span className="flex items-center gap-2"><FaCheckSquare className="size-3.5" /><span className="text-[11px] font-black uppercase tracking-wider">Deselect All</span></span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <span className="flex items-center justify-center size-6 rounded-md bg-blue-100 dark:bg-blue-500/20"><FaEye className="size-3 text-blue-500 dark:text-blue-400" /></span>
                      <span className="flex items-center justify-center size-6 rounded-md bg-green-100 dark:bg-green-500/20"><FaPlus className="size-3 text-green-500 dark:text-green-400" /></span>
                      <span className="flex items-center justify-center size-6 rounded-md bg-amber-100 dark:bg-amber-500/20"><FaEdit className="size-3 text-amber-500 dark:text-amber-400" /></span>
                      <span className="flex items-center justify-center size-6 rounded-md bg-red-100 dark:bg-red-500/20"><FaTrash className="size-3 text-red-500 dark:text-red-400" /></span>
                    </span>
                    <span className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
                    <span className="text-[11px] font-black uppercase tracking-wider">Select All</span>
                  </span>
                )}
              </button>

              <div className="relative w-full sm:w-52">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                <input
                  type="text"
                  value={moduleSearch}
                  onChange={(e) => setModuleSearch(e.target.value)}
                  placeholder="Search modules..."
                  className="w-full h-9 pl-9 pr-8 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-500/10 transition"
                />
                {moduleSearch && (
                  <button onClick={() => setModuleSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors">
                    <FaTimes className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Groups */}
          <div className="p-6 space-y-8">
            {filteredGroups.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">No modules matching &quot;{moduleSearch}&quot;</div>
            ) : (
              filteredGroups.map((group, gi) => {
                const groupPerms = group.modules
                  .map((modName) => perms.find((p) => p.permissionName === modName))
                  .filter(Boolean) as Permission[];
                const fallbackModules = group.modules.filter((m) => !perms.find((p) => p.permissionName === m));

                const groupAllOn = group.modules.every((m) => {
                  const p = perms.find((x) => x.permissionName === m);
                  if (!p) return true;
                  return actionsForModule(m).every((a) => permissions[p._id]?.[a]);
                });
                const groupSomeOn = group.modules.some((m) => {
                  const p = perms.find((x) => x.permissionName === m);
                  if (!p) return false;
                  return actionsForModule(m).some((a) => permissions[p._id]?.[a]);
                });

                const totalCards = groupPerms.length + fallbackModules.length;
                const remainder = totalCards % 4;
                const lastRowStart = remainder === 0 ? totalCards - 4 : totalCards - remainder;
                const getColSpan = (idx: number): string => {
                  if (remainder === 0 || idx < lastRowStart) return "";
                  if (remainder === 1) return "xl:col-span-4";
                  if (remainder === 2) return "xl:col-span-2";
                  return "";
                };
                const gridCols = totalCards === 3
                  ? "grid grid-cols-1 sm:grid-cols-3 gap-3"
                  : "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3";

                return (
                  <div key={group.label}>
                    {/* The sidebar's section heading, shown where a new section starts */}
                    {(gi === 0 || filteredGroups[gi - 1].section !== group.section) && (
                      <p className={`mb-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 ${gi === 0 ? "" : "mt-4"}`}>
                        {group.section}
                        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                      </p>
                    )}
                    <GroupHeader
                      group={group}
                      allChecked={groupAllOn && groupPerms.length > 0}
                      someChecked={groupSomeOn}
                      onToggleAll={() => toggleGroup(group.modules, groupAllOn && groupPerms.length > 0)}
                    />
                    <div className={gridCols}>
                      {groupPerms.map((perm, idx) => (
                        <div key={perm._id} className={getColSpan(idx)}>
                          <ModuleCard
                            name={perm.permissionName}
                            permissions={permissions[perm._id]}
                            onToggle={(action) => toggle(perm._id, action)}
                            onToggleAll={() => toggleModule(perm._id, perm.permissionName)}
                          />
                        </div>
                      ))}
                      {fallbackModules.map((m, fi) => {
                        const idx = groupPerms.length + fi;
                        return (
                          <div key={m} className={`rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-3 ${getColSpan(idx)}`}>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2.5">{m}</p>
                            <div className="grid grid-cols-2 gap-1.5 mb-2">
                              {actionsForModule(m).map((a) => {
                                const AIcon = ACTION_CONFIG[a].icon;
                                const cfg = ACTION_CONFIG[a];
                                return (
                                  <div key={a} className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 border text-xs ${cfg.border} ${cfg.color}`}>
                                    <AIcon className="size-3" />
                                    <span className="capitalize">{a}</span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-black bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400">
                              <FaListUl className="size-3" /> Not in DB
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Additional Options ── */}
        <ComponentCard title="Additional Options">
          <div className="flex flex-wrap gap-3 px-1">
            {OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setOptions((prev) => prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt])}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-150 active:scale-95
                  ${options.includes(opt)
                    ? "bg-accent-500 text-white border-transparent shadow-sm shadow-accent-500/30"
                    : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-accent-400"}`}
              >
                {options.includes(opt) && <FaCheckSquare className="size-3.5" />}
                {opt}
              </button>
            ))}
          </div>
        </ComponentCard>



        {/* ── Submit ── */}
        <div className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-end">
          {hasDraft && (
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:mr-auto">
              Draft saved {savedAt ? new Date(savedAt).toLocaleTimeString() : ""}
            </span>
          )}
          <MobileActionBar>
            <Button
              onClick={handleDestroyDraft}
              disabled={!hasDraft || isSubmitting}
                className="px-6 py-2.5 !bg-error-50 hover:!bg-error-100 !text-error-600 dark:!bg-error-500/15 dark:!text-error-400 font-bold rounded-xl border-none shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-sm"
            >
              Destroy Draft
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedUser}
                className="px-10 py-2.5 !bg-accent-500 hover:!bg-accent-600 !text-white font-bold rounded-xl border-none shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-sm"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : "Save Permissions"}
            </Button>
          </MobileActionBar>
        </div>
      </div>
    </>
  );
};

export default CreateUserPermission;
