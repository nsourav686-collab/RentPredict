export default function Message({ children, tone = "error" }) {
  if (!children) return null;

  const styles =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${styles}`}>
      {children}
    </div>
  );
}
