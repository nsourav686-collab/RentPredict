export default function UserAvatar({ className = "", image, name, size = "md" }) {
  const initials = (name || "User")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const sizeClass = size === "lg" ? "size-20 text-2xl" : size === "sm" ? "size-9 text-xs" : "size-11 text-sm";

  if (image) {
    return <img alt={`${name || "User"} profile`} className={`${sizeClass} shrink-0 rounded-2xl object-cover ring-2 ring-white/25 ${className}`} src={image} />;
  }

  return (
    <span className={`${sizeClass} grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-red-400 via-brand-red to-rose-800 font-extrabold text-white shadow-red ring-2 ring-white/20 ${className}`}>
      {initials}
    </span>
  );
}
