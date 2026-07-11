import { ArrowLeft, ArrowRight, BarChart3, Home, Info, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import Navbar from "../components/Navbar";

const cityInsights = [
  {
    city: "Bangalore",
    category: "Premium",
    areas: ["Whitefield", "Indiranagar", "Koramangala"],
    signal: "High demand",
    rent: "₹32K - ₹55K",
    title: "High-demand tech corridors",
    overview: "Bangalore rental demand is strongest around technology corridors, premium office hubs and well-connected neighborhoods. Furnishing, commute time and apartment size have a strong impact on expected rent.",
    highlights: ["IT corridor demand", "Premium furnished homes", "Strong 2 BHK activity"],
    guidance: "Compare locality quality, furnishing and room count before shortlisting homes near office zones."
  },
  {
    city: "Mumbai",
    category: "Luxury",
    areas: ["Bandra", "Andheri", "Powai"],
    signal: "Prime market",
    rent: "₹52K - ₹95K",
    title: "Compact homes with high value",
    overview: "Mumbai rents stay high because space is limited and demand is concentrated near business districts, transit routes and premium residential pockets.",
    highlights: ["Prime business access", "High value per sqft", "Strong transit influence"],
    guidance: "Focus on area efficiency, station access and maintenance quality when comparing listings."
  },
  {
    city: "Delhi",
    category: "Family",
    areas: ["Dwarka", "Saket", "Rohini"],
    signal: "Metro access",
    rent: "₹24K - ₹48K",
    title: "Balanced family rentals",
    overview: "Delhi offers a broad rental spread across family-friendly zones, metro-connected neighborhoods and practical mid-range housing.",
    highlights: ["Metro-connected areas", "Family housing demand", "Balanced rent bands"],
    guidance: "Check metro distance, parking, security and nearby schools before deciding."
  },
  {
    city: "Chennai",
    category: "Budget",
    areas: ["Velachery", "Anna Nagar", "Tambaram"],
    signal: "Value zones",
    rent: "₹16K - ₹35K",
    title: "Value-focused neighborhoods",
    overview: "Chennai has strong value-focused rental options where practical commute, usable area and furnishing status matter more than premium positioning alone.",
    highlights: ["Good value pockets", "Commute-sensitive demand", "Practical family options"],
    guidance: "Compare carpet area, ventilation, water supply and travel time before booking visits."
  },
  {
    city: "Hyderabad",
    category: "Premium",
    areas: ["Gachibowli", "Madhapur", "Kondapur"],
    signal: "IT corridor",
    rent: "₹22K - ₹46K",
    title: "Fast-moving growth zones",
    overview: "Hyderabad rental demand is active around fast-growing IT corridors and modern residential clusters. Larger homes near employment hubs often move quickly.",
    highlights: ["IT corridor growth", "Modern gated communities", "Strong furnished demand"],
    guidance: "Shortlist by office distance, gated community facilities and realistic monthly maintenance."
  },
  {
    city: "Kolkata",
    category: "Budget",
    areas: ["Salt Lake", "New Town", "Garia"],
    signal: "Affordable",
    rent: "₹12K - ₹28K",
    title: "Affordable urban options",
    overview: "Kolkata remains relatively affordable, with strong options across established neighborhoods and developing urban zones.",
    highlights: ["Affordable urban rent", "Growing New Town demand", "Good mid-range options"],
    guidance: "Compare access to transit, market areas and furnishing quality before final negotiation."
  }
];

export default function MarketInsightPage({ darkMode, navigate, onOpenSidebar, onToggleTheme, session, logout, city }) {
  const insight =
    cityInsights.find((item) => item.city.toLowerCase() === decodeURIComponent(city || "").toLowerCase()) ||
    cityInsights[0];

  return (
    <div className={`page-shell ${darkMode ? "dark" : ""}`}>
      <Navbar
        darkMode={darkMode}
        onOpenSidebar={onOpenSidebar}
        session={session}
        navigate={navigate}
        logout={logout}
        onToggleTheme={onToggleTheme}
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <button className="secondary-button mb-6 min-h-10 px-4 py-2" onClick={() => navigate("/")} type="button">
          <ArrowLeft size={17} /> Back Home
        </button>

        <section className="overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-lift dark:border-slate-800 dark:bg-slate-950">
          <div className="bg-brand-navy px-5 py-8 text-white sm:px-7">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-red-100">
              <MapPin size={14} /> {insight.category} Market
            </div>
            <h1 className="text-3xl font-extrabold sm:text-4xl">{insight.city} Market Insights</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">{insight.overview}</p>
          </div>

          <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-3">
            {[
              ["Rent Range", insight.rent, BarChart3],
              ["Market Signal", insight.signal, Sparkles],
              ["Top Areas", insight.areas.join(", "), Home]
            ].map(([title, value, Icon]) => (
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900" key={title}>
                <span className="mb-4 grid size-10 place-items-center rounded-lg bg-red-50 text-brand-red dark:bg-red-950/40 dark:text-red-200">
                  <Icon size={19} />
                </span>
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h2>
                <p className="mt-2 text-xl font-extrabold text-brand-navy dark:text-white">{value}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-4 border-t border-slate-200 p-5 dark:border-slate-800 sm:p-6 lg:grid-cols-[1fr_0.8fr]">
            <article>
              <h2 className="text-2xl font-extrabold text-brand-navy dark:text-white">{insight.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">{insight.guidance}</p>
              <button className="primary-button mt-5" onClick={() => navigate("/")} type="button">
                Start prediction <ArrowRight size={17} />
              </button>
            </article>

            <article className="rounded-lg bg-slate-50 p-5 dark:bg-slate-900">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-extrabold">
                <ShieldCheck size={19} /> Key Highlights
              </h3>
              <div className="grid gap-3">
                {insight.highlights.map((item) => (
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300" key={item}>
                    {item}
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
