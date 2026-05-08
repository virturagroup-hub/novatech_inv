import {
  LayoutGrid,
  Package,
  Inbox,
  Layers,
  FileText,
  Menu,
  X,
  QrCode,
  Users,
  UserPlus,
  LogOut,
  User,
} from "lucide-react";
import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";

export default function Navigation() {
  const { data: user, loading: userLoading } = useUser();
  const [userRole, setUserRole] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "/";

  // Detect if user is on mobile web
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch current user's role
  useEffect(() => {
    const fetchProfile = async () => {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setUserRole(data.user?.role);
      }
    };
    if (user) {
      fetchProfile();
    }
  }, [user]);

  // Define nav items with role requirements and platform visibility
  const navItems = [
    {
      href: "/",
      label: "Dashboard",
      icon: <LayoutGrid size={18} />,
      roles: ["technician", "elevated", "admin"],
      showOnMobile: true,
      showOnDesktop: true,
    },
    {
      href: "/inventory",
      label: "Inventory",
      icon: <Package size={18} />,
      roles: ["technician", "elevated", "admin"],
      showOnMobile: true,
      showOnDesktop: true,
    },
    {
      href: "/scanner",
      label: "QR Scanner",
      icon: <QrCode size={18} />,
      roles: ["technician", "elevated", "admin"],
      showOnMobile: true,
      showOnDesktop: false, // Scanner is primarily for mobile
    },
    {
      href: "/bins",
      label: "Bins",
      icon: <Inbox size={18} />,
      roles: ["elevated", "admin"],
      showOnMobile: false,
      showOnDesktop: true,
    },
    {
      href: "/models",
      label: "Master Models",
      icon: <Layers size={18} />,
      roles: ["elevated", "admin"],
      showOnMobile: false,
      showOnDesktop: true,
    },
    {
      href: "/reports",
      label: "Reports",
      icon: <FileText size={18} />,
      roles: ["elevated", "admin"],
      showOnMobile: false,
      showOnDesktop: true,
    },
    {
      href: "/admin/users",
      label: "User Management",
      icon: <Users size={18} />,
      roles: ["admin"],
      showOnMobile: false,
      showOnDesktop: true,
    },
    {
      href: "/account/create-user",
      label: "Create User",
      icon: <UserPlus size={18} />,
      roles: ["elevated", "admin"],
      showOnMobile: false,
      showOnDesktop: true,
    },
    {
      href: "/profile",
      label: "My Profile",
      icon: <User size={18} />,
      roles: ["technician", "elevated", "admin"],
      showOnMobile: false,
      showOnDesktop: true,
    },
  ];

  // Filter nav items based on user role and platform
  const visibleNavItems = navItems.filter((item) => {
    const hasRole = userRole && item.roles.includes(userRole);
    const visibleOnPlatform = isMobile ? item.showOnMobile : item.showOnDesktop;
    return hasRole && visibleOnPlatform;
  });

  // Items for mobile hamburger menu (show all regardless of showOnMobile)
  const mobileMenuItems = navItems.filter(
    (item) => userRole && item.roles.includes(userRole),
  );

  if (userLoading || !user || !userRole) {
    return null;
  }

  return (
    <>
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4 md:gap-8">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 text-gray-600 hover:text-gray-900"
              >
                <Menu size={24} />
              </button>

              <h1 className="text-lg md:text-xl font-bold text-gray-900">
                Parts Inventory
              </h1>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center gap-2">
                {visibleNavItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              <div className="hidden md:block text-sm text-gray-600">
                <span className="font-semibold">{user.name || user.email}</span>
                <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium capitalize">
                  {userRole}
                </span>
              </div>
              <a
                href="/account/logout"
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut size={16} />
                <span className="hidden md:inline">Sign Out</span>
              </a>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Tab Bar (visible only on mobile) */}
        {isMobile && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-40">
            <div className="flex items-center justify-around px-2 py-2">
              {visibleNavItems.slice(0, 4).map((item) => {
                const isActive = pathname === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      isActive ? "text-blue-600" : "text-gray-600"
                    }`}
                  >
                    {item.icon}
                    <span className="text-[10px]">
                      {item.label.split(" ")[0]}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          ></div>

          {/* Slide-in Menu */}
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {user.name || user.email}
                </h2>
                <p className="text-xs text-gray-500 capitalize mt-1">
                  {userRole} Account
                </p>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 p-4 space-y-2 overflow-y-auto">
              {mobileMenuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </div>

            {/* Sign Out Button */}
            <div className="p-4 border-t border-gray-200">
              <a
                href="/account/logout"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors"
              >
                <LogOut size={16} />
                Sign Out
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
