import { Link, useLocation } from "react-router";
import { Calendar, ClipboardList, Users } from "lucide-react";

export function TopNavigation() {
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path === "/guides" && (location.pathname === "/guides" || location.pathname.startsWith("/guides"))) return true;
    if (path === "/bookings" && location.pathname.startsWith("/bookings")) return true;
    return false;
  };

  const navItems = [
    { path: "/", label: "Calendar", icon: Calendar },
    { path: "/bookings", label: "Bookings", icon: ClipboardList },
    { path: "/guides", label: "Guides", icon: Users },
  ];

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="px-8 flex items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-6 py-4 font-semibold text-sm transition-colors relative ${
                active
                  ? "text-[#1D3663]"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
              {active && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1D3663]"></div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
