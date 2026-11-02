import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Link, useLocation } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
import { ChevronDownIcon, HorizontaLDots } from "../icons";
import { NavItem, SubmenuType, useSidebarSections } from "./sidebarNav";

// Submenu list whose green selection bar sits on the gray rail and slides to
// the active item instead of jumping.
const RailList = ({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) => {
  const ref = useRef<HTMLUListElement>(null);
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const [animate, setAnimate] = useState(false);

  const measure = useCallback(() => {
    const active = ref.current?.querySelector<HTMLElement>(
      ":scope > li > .menu-dropdown-item-active",
    );
    if (!active) {
      setVisible(false);
      return;
    }
    const top = active.offsetTop;
    const height = active.offsetHeight;
    setBar((prev) =>
      prev?.top === top && prev?.height === height ? prev : { top, height },
    );
    setVisible(true);
  }, []);

  // Re-measure after every render (route or open submenu changed) and while
  // a nested submenu grows or shrinks.
  useLayoutEffect(measure);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(measure);
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [measure]);

  // Place the bar without a transition first, so it does not slide in from the top
  useEffect(() => {
    if (bar && !animate) {
      const timer = setTimeout(() => setAnimate(true), 50);
      return () => clearTimeout(timer);
    }
  }, [bar, animate]);

  return (
    <ul ref={ref} className={`relative ${className}`}>
      <li
        aria-hidden
        className={`pointer-events-none absolute -left-[2px] w-[3px] rounded-full bg-accent-500 dark:bg-accent-400 ${
          animate
            ? "transition-[top,height,opacity] duration-[280ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
            : ""
        }`}
        style={{
          top: bar?.top ?? 0,
          height: bar?.height ?? 0,
          opacity: visible ? 1 : 0,
        }}
      />
      {children}
    </ul>
  );
};

// ---------- COMPONENT ----------
const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered } =
    useSidebar();
  const { isSuperAdmin, isLoading } = useAuth();
  const location = useLocation();

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: SubmenuType;
    index: number;
  } | null>(null);

  const [openSubSubMenu, setOpenSubSubMenu] = useState<{
    parentIndex: number;
    subIndex: number;
  } | null>(null);

  const sidebarSections = useSidebarSections();

  // ---------- ACTIVE STATE ----------
  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname],
  );

  // Opens the submenu holding the current page. Re-runs once auth has loaded:
  // until then every item is hidden, so on a reload the first pass finds
  // nothing and would otherwise leave the menu collapsed.
  useEffect(() => {
    if (isLoading) return;
    let submenuMatched = false;

    sidebarSections.forEach(({ type, items }) => {
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem, subIndex) => {
            if (subItem.subSubItems) {
              subItem.subSubItems.forEach((subSubItem) => {
                if (isActive(subSubItem.path)) {
                  setOpenSubmenu({ type, index });
                  setOpenSubSubMenu({ parentIndex: index, subIndex });
                  submenuMatched = true;
                }
              });
            } else if (subItem.path && isActive(subItem.path)) {
              setOpenSubmenu({ type, index });
              submenuMatched = true;
            }
          });
        }
      });
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
      setOpenSubSubMenu(null);
    }
    // sidebarSections is rebuilt every render, so it cannot be a dependency;
    // isLoading/isSuperAdmin cover the moment the visible items settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, isActive, isLoading, isSuperAdmin]);

  const handleSubmenuToggle = (
    index: number,
    menuType: NonNullable<typeof openSubmenu>["type"],
  ) => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        setOpenSubSubMenu(null);
        return null;
      }
      return { type: menuType, index };
    });
  };

  // The Platform Console group stays expanded: an operator moves between its
  // few pages constantly, so it never collapses.
  const ALWAYS_OPEN: SubmenuType[] = ["platformConsole"];
  const isSubmenuOpen = (menuType: SubmenuType, index: number) =>
    ALWAYS_OPEN.includes(menuType) ||
    (openSubmenu?.type === menuType && openSubmenu?.index === index);

  const renderMenuItems = (
    items: NavItem[],
    menuType: NonNullable<typeof openSubmenu>["type"],
  ) => (
    <ul className="flex flex-col gap-[5px]">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => {
                if (!ALWAYS_OPEN.includes(menuType)) handleSubmenuToggle(index, menuType);
              }}
              className={`menu-item group ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={`menu-item-icon-size ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="truncate">{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && !ALWAYS_OPEN.includes(menuType) && (
                <ChevronDownIcon
                  className={`ml-auto size-4 shrink-0 transition-transform duration-200 ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-accent-500 dark:text-accent-400"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                } ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "lg:justify-start"
                }`}
              >
                <span
                  className={`menu-item-icon-size ${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="truncate">{nav.name}</span>
                )}
              </Link>
            )
          )}

          {/* ---------- SUBMENU ---------- */}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                isSubmenuOpen(menuType, index)
                  ? "max-h-[1200px] mt-1"
                  : "max-h-0"
              }`}
            >
              <RailList className="ml-[19px] space-y-[6px] border-l border-gray-200 pl-2 dark:border-gray-800">
                {nav.subItems.map((subItem, subIndex) => {
                  const isSubSubOpen =
                    openSubSubMenu?.parentIndex === index &&
                    openSubSubMenu?.subIndex === subIndex;

                  return (
                    <li key={subItem.name}>
                      {subItem.subSubItems ? (
                        <>
                          <button
                            onClick={() =>
                              requestAnimationFrame(() =>
                                setOpenSubSubMenu((prev) =>
                                  prev?.parentIndex === index &&
                                  prev?.subIndex === subIndex
                                    ? null
                                    : { parentIndex: index, subIndex },
                                ),
                              )
                            }
                            className={`menu-dropdown-item w-full text-left ${
                              isSubSubOpen
                                ? "menu-dropdown-item-active"
                                : "menu-dropdown-item-inactive"
                            }`}
                          >
                            <span className="flex items-center justify-between w-full">
                              {subItem.name}
                              <ChevronDownIcon
                                className={`size-3.5 shrink-0 transition-transform duration-200 ${
                                  isSubSubOpen
                                    ? "rotate-180 text-accent-500 dark:text-accent-400"
                                    : "text-gray-400 dark:text-gray-500"
                                }`}
                              />
                            </span>
                          </button>

                          {/* ---------- SUB-SUBMENU ---------- */}
                          <div
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${
                              isSubSubOpen ? "max-h-[600px] mt-1" : "max-h-0"
                            }`}
                          >
                            <RailList className="mt-[6px] ml-2.5 space-y-[6px] border-l border-gray-200 pb-1 pl-2 dark:border-gray-800">
                              {subItem.subSubItems.map((subSubItem) => (
                                <li key={subSubItem.name}>
                                  <Link
                                    to={subSubItem.path}
                                    className={`menu-dropdown-item block ${
                                      isActive(subSubItem.path)
                                        ? "menu-dropdown-item-active"
                                        : "menu-dropdown-item-inactive"
                                    }`}
                                  >
                                    <span className="flex items-center justify-between w-full">
                                      {subSubItem.name}
                                      <span className="flex items-center gap-1">
                                        {subSubItem.new && (
                                          <span
                                            className={`${
                                              isActive(subSubItem.path)
                                                ? "menu-dropdown-badge-active"
                                                : "menu-dropdown-badge-inactive"
                                            } menu-dropdown-badge`}
                                          >
                                            new
                                          </span>
                                        )}
                                        {subSubItem.pro && (
                                          <span
                                            className={`${
                                              isActive(subSubItem.path)
                                                ? "menu-dropdown-badge-active"
                                                : "menu-dropdown-badge-inactive"
                                            } menu-dropdown-badge`}
                                          >
                                            pro
                                          </span>
                                        )}
                                      </span>
                                    </span>
                                  </Link>
                                </li>
                              ))}
                            </RailList>
                          </div>
                        </>
                      ) : (
                        subItem.path && (
                          <Link
                            to={subItem.path}
                            className={`menu-dropdown-item ${
                              isActive(subItem.path)
                                ? "menu-dropdown-item-active"
                                : "menu-dropdown-item-inactive"
                            }`}
                          >
                            <span className="truncate">{subItem.name}</span>
                          </Link>
                        )
                      )}
                    </li>
                  );
                })}
              </RailList>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  // ---------- RENDER ----------
  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-2.5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[232px]"
            : isHovered
              ? "w-[232px]"
              : "w-[72px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
    >
      {/* ---------- LOGO ---------- */}
      <div
        // py-4 centres the 32px logo on the header's 40px search box
        className={`py-4 flex items-center ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-between"
        }`}
      >
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-500 p-1.5 shadow-sm">
            <img src="/images/logo/shopping-cart.png" alt="Ecompos Master" width={20} height={20} className="size-5" />
          </span>
          {(isExpanded || isHovered || isMobileOpen) && (
            <span className="font-bold text-gray-900 dark:text-white text-base tracking-tight uppercase whitespace-nowrap">
              Ecompos Master
            </span>
          )}
        </Link>
      </div>

      {/* ---------- SIDEBAR NAV ---------- */}
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6 pb-10">
          <div className="flex flex-col gap-3.5">
            {sidebarSections
              .filter((section) => section.items.length > 0)
              .map((section) => (
                <div key={section.type}>
                  <h2
                    className={`sidebar-section-title flex ${
                      !isExpanded && !isHovered
                        ? "lg:justify-center"
                        : "justify-start"
                    }`}
                  >
                    {isExpanded || isHovered || isMobileOpen ? (
                      section.label
                    ) : (
                      <HorizontaLDots className="size-6" />
                    )}
                  </h2>
                  {renderMenuItems(section.items, section.type)}
                </div>
              ))}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
