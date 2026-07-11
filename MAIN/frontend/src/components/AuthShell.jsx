import { Check } from "lucide-react";

export default function AuthShell({ children, title, items }) {
  return (
    <main className="auth-background relative grid min-h-screen place-items-center overflow-hidden px-4 py-8">
      <div className="mesh-overlay" />
      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[0.9fr_1fr]">
        <section className="glass-panel animate-rise p-6 text-white">
          <h1 className="mb-5 text-3xl font-bold text-cyan-300">{title}</h1>
          <ul className="space-y-3 text-sm leading-6 text-white/85">
            {items.map((item, index) => (
              <li
                className="flex animate-rise items-start gap-2"
                key={item}
                style={{ animationDelay: `${120 + index * 80}ms` }}
              >
                <Check className="mt-1 shrink-0 text-cyan-300" size={16} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
        <div className="animate-rise animate-delay-200">{children}</div>
      </div>
    </main>
  );
}
