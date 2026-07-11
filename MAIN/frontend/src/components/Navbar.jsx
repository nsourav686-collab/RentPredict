import { Home, Info, LogIn, Menu, MessageSquare, UserPlus } from "lucide-react";
import UserAvatar from "./UserAvatar";

export default function Navbar({ navigate, onOpenSidebar, session }) {
  const scrollToSection = (id) => {
    navigate("/");
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  return (
    <nav className="sticky top-0 z-30 border-b border-white/10 bg-brand-navy/95 px-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-brand-navy/85 sm:px-8">
      <div className="mx-auto flex min-h-[64px] max-w-7xl items-center justify-between gap-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {session.isAuthenticated && (
            <button aria-label="Open dashboard menu" className="menu-button" onClick={onOpenSidebar} type="button"><Menu size={21} /></button>
          )}
          <button className="group inline-flex min-w-0 shrink items-center gap-2 text-lg font-extrabold text-white transition hover:scale-[1.02] sm:text-xl" onClick={() => navigate("/")} type="button">
            <img alt="" className="size-8 shrink-0 rounded-md object-contain shadow-sm" src="/android-chrome-192x192.png" />
            <span className="truncate">Rent<span className="text-brand-red transition group-hover:text-red-300">Predict</span></span>
          </button>
          {[
            ["Home", Home, () => scrollToSection("home")],
            ["About", Info, () => scrollToSection("about")],
            ["Feedback", MessageSquare, () => scrollToSection("feedback")]
          ].map(([label, Icon, action]) => (
            <button className="hidden min-h-9 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-white/75 transition hover:bg-white/10 hover:text-white lg:inline-flex" key={label} onClick={action} type="button"><Icon size={15} /><span>{label}</span></button>
          ))}
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          {session.isAuthenticated ? (
            <button aria-label="Open your dashboard menu" className="flex min-w-0 items-center gap-2 rounded-xl px-1 py-1 text-left transition hover:bg-white/10 sm:px-2" onClick={onOpenSidebar} type="button">
              <span className="hidden max-w-44 truncate text-sm text-white/70 md:inline">Welcome, <strong className="text-white">{session.username}</strong></span>
              <UserAvatar className="rounded-xl" image={session.profile_image} name={session.username} size="sm" />
            </button>
          ) : (
            <>
              <button className="secondary-button min-h-9 px-3 py-2" onClick={() => navigate("/login")} type="button"><LogIn size={16} /> <span className="hidden sm:inline">Login</span></button>
              <button className="primary-button min-h-9 px-3 py-2" onClick={() => navigate("/signup")} type="button"><UserPlus size={16} /> <span className="hidden sm:inline">Signup</span></button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
