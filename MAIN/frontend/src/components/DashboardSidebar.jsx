import {
  BarChart3,
  CircleHelp,
  Home,
  Info,
  LogOut,
  MessageSquare,
  Moon,
  Search,
  Settings2,
  Sun,
  UserRoundPen,
  X
} from "lucide-react";
import UserAvatar from "./UserAvatar";

const navigationLinks = [
  ["Dashboard", Home, "home"],
  ["Predict Rent", Search, "predict"],
  ["Market Insights", BarChart3, "market"],
  ["About RentPredict", Info, "about"],
  ["Feedback", MessageSquare, "feedback"]
];

const roleLabel = (role) => (role ? `${role[0].toUpperCase()}${role.slice(1)} account` : "Member account");

export default function DashboardSidebar({ darkMode, logout, navigate, onClose, onToggleTheme, open, session, scrollToSection }) {
  const navigateTo = (target) => {
    scrollToSection(target);
  };

  const profileAction = () => {
    onClose();
    navigate("/profile");
  };

  const goToWorkspace = () => {
    onClose();
    navigate(session.role === "owner" ? "/owner" : "/admin");
  };

  return (
    <>
      <button
        aria-label="Close dashboard menu"
        className={`sidebar-backdrop ${open ? "is-open" : ""}`}
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        type="button"
      />
      <aside aria-hidden={!open} className={`dashboard-sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-reveal flex items-center justify-between gap-3" style={{ transitionDelay: "40ms" }}>
          <button className="flex min-w-0 items-center gap-3 text-left" onClick={() => navigateTo("home")} type="button">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand-red shadow-red">
              <img alt="" className="size-8 rounded-lg object-contain" src="/android-chrome-192x192.png" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-extrabold">RentPredict</span>
              <span className="block truncate text-xs font-semibold uppercase tracking-wide text-white/45">Your smart rental space</span>
            </span>
          </button>
          <button aria-label="Close dashboard menu" className="grid size-10 place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/15" onClick={onClose} type="button">
            <X size={19} />
          </button>
        </div>

        <button className="sidebar-user-card sidebar-reveal mt-7" onClick={profileAction} style={{ transitionDelay: "100ms" }} type="button">
          <UserAvatar image={session.profile_image} name={session.username} size="lg" />
          <span className="min-w-0 text-left">
            <span className="block truncate text-base font-extrabold">Welcome, {session.username || "User"}</span>
            <span className="mt-0.5 block text-sm text-white/55">{roleLabel(session.role)}</span>
            <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-red-200"><UserRoundPen size={14} /> Edit profile</span>
          </span>
        </button>

        <div className="sidebar-reveal mt-7" style={{ transitionDelay: "150ms" }}>
          <p className="px-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/35">Workspace</p>
          <nav className="mt-2 grid gap-1" aria-label="Dashboard navigation">
            {navigationLinks.map(([label, Icon, target], index) => (
              <button className={`dashboard-link ${index === 0 ? "active" : ""}`} key={label} onClick={() => navigateTo(target)} type="button">
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
            {(session.role === "owner" || session.role === "admin") && (
              <button className="dashboard-link" onClick={goToWorkspace} type="button">
                <Settings2 size={18} />
                <span>{session.role === "owner" ? "Owner workspace" : "Admin workspace"}</span>
              </button>
            )}
          </nav>
        </div>

        <div className="mt-auto space-y-3 pt-8">
          <button className="sidebar-setting sidebar-reveal" onClick={onToggleTheme} style={{ transitionDelay: "220ms" }} type="button">
            <span className="flex items-center gap-3">{darkMode ? <Moon size={18} /> : <Sun size={18} />}<span><span className="block font-extrabold">{darkMode ? "Dark theme" : "Light theme"}</span><span className="block text-xs font-medium text-white/45">Personalize your view</span></span></span>
            <span className="theme-switch" aria-hidden="true"><span className={darkMode ? "translate-x-4" : "translate-x-0"} /></span>
          </button>
          <button className="sidebar-setting sidebar-reveal" onClick={() => navigateTo("feedback")} style={{ transitionDelay: "260ms" }} type="button">
            <span className="flex items-center gap-3"><CircleHelp size={18} /><span><span className="block font-extrabold">Help & support</span><span className="block text-xs font-medium text-white/45">Share feedback with our team</span></span></span>
          </button>
          <button className="sidebar-logout sidebar-reveal" onClick={logout} style={{ transitionDelay: "300ms" }} type="button"><LogOut size={18} /> Sign out</button>
        </div>
      </aside>
    </>
  );
}
