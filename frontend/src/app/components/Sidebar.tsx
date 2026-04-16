import { Link, useLocation } from "react-router";
import { Map, Users, Calendar, ClipboardList, Settings, HelpCircle } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";

export function Sidebar() {
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navItems = [
    { path: "/", label: "Calendar", icon: Calendar },
    { path: "/guides", label: "Guide Database", icon: Users },
    { path: "/tours", label: "Tours & Bookings", icon: ClipboardList },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#F3796A] rounded-lg flex items-center justify-center">
            <Map className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">GuideFlow</span>
        </div>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                active
                  ? "text-white bg-[#F3796A]"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <ImageWithFallback
            alt="Admin"
            className="w-10 h-10 rounded-full border-2 border-slate-700 object-cover"
            src="https://images.unsplash.com/photo-1659100939687-a7c10b4d5841?w=100&h=100&fit=crop"
          />
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate">Alex Thompson</p>
            <p className="text-xs text-slate-400 truncate">System Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
