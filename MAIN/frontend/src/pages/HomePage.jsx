import {
  ArrowRight,
  BarChart3,
  Bath,
  BedDouble,
  Building2,
  ChevronLeft,
  ChevronRight,
  Home,
  Image,
  Info,
  Landmark,
  LocateFixed,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Ruler,
  SlidersHorizontal,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
  Zap
} from "lucide-react";
import { useEffect, useState } from "react";
import AreaPicker from "../components/AreaPicker";
import Navbar from "../components/Navbar";
import Message from "../components/Message";
import { apiGet, apiPost } from "../services/api";

const initialForm = {
  size: "",
  bhk: "",
  bathroom: "",
  city: "",
  area: "",
  area_type: "Super Area",
  furnishing: "Furnished"
};

const propertyMapQuery = (property) =>
  property.latitude && property.longitude
    ? `${property.latitude},${property.longitude}`
    : [property.address, property.city, "India"].filter(Boolean).join(", ");

const mapPreviewSrc = (property) =>
  property.latitude && property.longitude
    ? `https://maps.google.com/maps?hl=en&t=k&z=17&q=${encodeURIComponent(`${property.latitude},${property.longitude}`)}&output=embed`
    : "";

function PropertyImageCarousel({ images = [], title, onZoom }) {
  const [index, setIndex] = useState(0);
  if (!images.length) {
    return (
      <div className="mb-4 grid h-40 place-items-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
        <Image size={28} />
      </div>
    );
  }

  const normalizedIndex = index % images.length;
  const activeImage = images[normalizedIndex];

  return (
    <div className="market-slide-card relative mb-4 overflow-hidden rounded-lg">
      <button className="block w-full" onClick={() => onZoom(activeImage)} type="button">
        <img alt={title} className="h-40 w-full cursor-zoom-in object-cover" src={activeImage} />
      </button>
      {images.length > 1 && (
        <>
          <button className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-navy shadow-soft" onClick={() => setIndex((current) => (current - 1 + images.length) % images.length)} type="button">
            <ChevronLeft size={18} />
          </button>
          <button className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-navy shadow-soft" onClick={() => setIndex((current) => (current + 1) % images.length)} type="button">
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {images.map((image, dotIndex) => (
              <button
                aria-label={`Show property image ${dotIndex + 1}`}
                className={`h-2 rounded-full transition-all ${dotIndex === normalizedIndex ? "w-7 bg-brand-red" : "w-2 bg-white/80"}`}
                key={`${image.slice(0, 24)}-${dotIndex}`}
                onClick={() => setIndex(dotIndex)}
                type="button"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const marketItems = [
  {
    city: "Bangalore",
    image: "/static/images/market/bangalore-vidhana-soudha.png",
    category: "Premium",
    areas: ["Whitefield", "Indiranagar", "Koramangala"],
    signal: "High demand",
    rent: "₹32K - ₹55K",
    title: "High-demand tech corridors",
    text: "Strong demand around Whitefield, Indiranagar and Koramangala for furnished 2 BHK homes."
  },
  {
    city: "Mumbai",
    image: "/static/images/market/mumbai-gateway-of-india.png",
    category: "Luxury",
    areas: ["Bandra", "Andheri", "Powai"],
    signal: "Prime market",
    rent: "₹52K - ₹95K",
    title: "Compact homes with high value",
    text: "Premium rents near business districts make area and furnishing choices very important."
  },
  {
    city: "Delhi",
    image: "/static/images/market/delhi-red-fort.png",
    category: "Family",
    areas: ["Dwarka", "Saket", "Rohini"],
    signal: "Metro access",
    rent: "₹24K - ₹48K",
    title: "Balanced family rentals",
    text: "Locality, metro access and bathroom count have a strong effect on expected rent."
  },
  {
    city: "Chennai",
    image: "/static/images/market/chennai-ripon-building.png",
    category: "Budget",
    areas: ["Velachery", "Anna Nagar", "Tambaram"],
    signal: "Value zones",
    rent: "₹16K - ₹35K",
    title: "Value-focused neighborhoods",
    text: "Good fit for users comparing carpet area, furnishing and practical commute options."
  },
  {
    city: "Hyderabad",
    image: "/static/images/market/hyderabad-charminar.png",
    category: "Premium",
    areas: ["Gachibowli", "Madhapur", "Kondapur"],
    signal: "IT corridor",
    rent: "₹22K - ₹46K",
    title: "Fast-moving growth zones",
    text: "IT corridor demand makes size per room and locality selection useful prediction signals."
  },
  {
    city: "Kolkata",
    image: "/static/images/market/kolkata-victoria-memorial.png",
    category: "Budget",
    areas: ["Salt Lake", "New Town", "Garia"],
    signal: "Affordable",
    rent: "₹12K - ₹28K",
    title: "Affordable urban options",
    text: "Users can compare area type and furnishing status before committing to visits."
  }
];

export default function HomePage({ darkMode, onOpenSidebar, onToggleTheme, session, navigate, logout, setPrediction }) {
  const [cities, setCities] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [marketCity, setMarketCity] = useState("All");
  const [marketArea, setMarketArea] = useState("");
  const [marketCategory, setMarketCategory] = useState("All");
  const [marketSlideIndex, setMarketSlideIndex] = useState(0);
  const [marketTimerReset, setMarketTimerReset] = useState(0);
  const [ownerListings, setOwnerListings] = useState([]);
  const [zoomImage, setZoomImage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGet("/api/cities").then((data) => setCities(data.cities || []));
    apiGet("/api/properties").then((data) => setOwnerListings(data.properties || [])).catch(() => setOwnerListings([]));
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "city" ? { area: "" } : {})
    }));
  };

  const submitPrediction = async (event) => {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      const result = await apiPost("/api/predict", form);
      setPrediction(result);
      navigate("/result");
    } catch (error) {
      setMessage(error.message);
      if (error.message.includes("login")) navigate("/login");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeedback = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get("name") || "friend";
    window.alert(`Thank you, ${name}! Your feedback has been noted for the next version.`);
    event.currentTarget.reset();
  };

  const filteredMarketItems = marketItems.filter((item) => {
    const areaQuery = marketArea.trim().toLowerCase();
    const matchesCity = marketCity === "All" || item.city === marketCity;
    const matchesArea =
      !areaQuery ||
      `${item.areas.join(" ")} ${item.title} ${item.text}`.toLowerCase().includes(areaQuery);
    const matchesCategory = marketCategory === "All" || item.category === marketCategory;
    return matchesCity && matchesArea && matchesCategory;
  });

  const availableMarketAreas = [
    ...new Set(
      marketItems
        .filter((item) => marketCity === "All" || item.city === marketCity)
        .flatMap((item) => item.areas)
    )
  ];
  const hasMarketFilters = marketCity !== "All" || marketArea.trim() || marketCategory !== "All";
  const normalizedMarketSlideIndex = filteredMarketItems.length ? marketSlideIndex % filteredMarketItems.length : 0;
  const activeMarketItem = filteredMarketItems[normalizedMarketSlideIndex];

  useEffect(() => {
    setMarketSlideIndex(0);
  }, [marketCity, marketArea, marketCategory]);

  useEffect(() => {
    if (filteredMarketItems.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setMarketSlideIndex((current) => (current + 1) % filteredMarketItems.length);
    }, 10000);

    return () => window.clearInterval(timer);
  }, [filteredMarketItems.length, marketTimerReset]);

  const moveMarketSlide = (direction) => {
    if (filteredMarketItems.length === 0) return;
    setMarketSlideIndex((current) => {
      const next = current + direction;
      return (next + filteredMarketItems.length) % filteredMarketItems.length;
    });
    setMarketTimerReset((current) => current + 1);
  };

  const chooseMarketSlide = (index) => {
    setMarketSlideIndex(index);
    setMarketTimerReset((current) => current + 1);
  };

  return (
    <div className={`page-shell ${darkMode ? "dark" : ""}`}>
      <div className="min-h-screen">
        <div className="min-w-0">
      <Navbar
        darkMode={darkMode}
        session={session}
        navigate={navigate}
        logout={logout}
        onOpenSidebar={onOpenSidebar}
        onToggleTheme={onToggleTheme}
      />

      <header id="home" className="hero-visual relative overflow-hidden px-4 pb-24 pt-12 text-center text-white sm:pb-28 sm:pt-16">
        <div className="mesh-overlay" />
        <div className="relative mx-auto max-w-5xl">
          <div className="mb-4 inline-flex animate-rise items-center gap-2 rounded-full border border-red-300/30 bg-red-500/15 px-4 py-1 text-xs font-bold uppercase tracking-wider text-red-100 backdrop-blur">
            <Sparkles size={15} /> AI-Powered Rent Prediction
          </div>
          <h1 className="animate-rise animate-delay-100 text-balance text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
            Find the right rent before you decide
          </h1>
          <p className="mx-auto mt-4 max-w-2xl animate-rise animate-delay-200 text-base leading-7 text-white/75">
            Get accurate rent estimates for Indian cities using the existing machine learning model and dataset.
          </p>
          <div className="welcome-marquee mt-8" aria-label="Welcome to RentPredict">
            <div className="welcome-marquee__track">
              <span>Explore properties, predict accurate rental prices, and make confident decisions with AI-powered insights.</span>
              <span aria-hidden="true">Explore properties, predict accurate rental prices, and make confident decisions with AI-powered insights.</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-14 max-w-6xl px-4 pb-12">
        <section className="grid gap-4 pb-8 sm:grid-cols-3">
          {[
            ["Accuracy Signal", "87%", "Model performance summary", BarChart3],
            ["Cities Covered", "6", "Major rental markets", MapPin],
            ["Result Speed", "Instant", "Fast prediction flow", Zap]
          ].map(([title, value, text, Icon], index) => (
            <article
              className="premium-card animate-card-pop"
              key={title}
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-red-50 text-brand-red dark:bg-red-950/40 dark:text-red-200">
                  <Icon size={19} />
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  Live
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400">{title}</h3>
              <div className="mt-1 text-2xl font-extrabold">{value}</div>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p>
            </article>
          ))}
        </section>

        <section id="predict" className="panel animate-rise overflow-hidden">
          <div className="flex flex-col gap-3 bg-brand-red px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-white/15">
                <Search size={22} />
              </span>
              <div>
                <h2 className="text-lg font-bold">Predict Your Rent</h2>
                <p className="text-sm text-white/75">Fill the property details to run the AI model.</p>
              </div>
            </div>
          </div>

          <form className="space-y-5 p-4 sm:p-6" onSubmit={submitPrediction}>
            <Message>{message}</Message>

            <div className="form-section animate-rise animate-delay-100">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-600">
                <Building2 size={18} /> Property Details
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label>Size (sqft)</label>
                  <input type="number" min="100" required value={form.size} onChange={(event) => updateField("size", event.target.value)} />
                </div>
                <div>
                  <label>BHK</label>
                  <select required value={form.bhk} onChange={(event) => updateField("bhk", event.target.value)}>
                    <option value="">Select BHK</option>
                    {[1, 2, 3, 4, 5, 6].map((item) => (
                      <option key={item} value={item}>{item} BHK</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Bathrooms</label>
                  <select required value={form.bathroom} onChange={(event) => updateField("bathroom", event.target.value)}>
                    <option value="">Select</option>
                    {[1, 2, 3, 4, 5].map((item) => (
                      <option key={item} value={item}>{item} Bathroom{item > 1 ? "s" : ""}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="form-section animate-rise animate-delay-200">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-600">
                <MapPin size={18} /> Location
              </h3>
              <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
                <div>
                  <label>City</label>
                  <select required value={form.city} onChange={(event) => updateField("city", event.target.value)}>
                    <option value="">Select City</option>
                    {cities.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Search Area / Locality</label>
                  <AreaPicker city={form.city} value={form.area} onChange={(value) => updateField("area", value)} />
                </div>
              </div>
            </div>

            <div className="form-section animate-rise animate-delay-300">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-600">
                <Sparkles size={18} /> Preferences
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label>Area Type</label>
                  <select value={form.area_type} onChange={(event) => updateField("area_type", event.target.value)}>
                    <option value="Super Area">Super Area</option>
                    <option value="Carpet Area">Carpet Area</option>
                    <option value="Built Area">Built Area</option>
                  </select>
                </div>
                <div>
                  <label>Furnishing Status</label>
                  <select value={form.furnishing} onChange={(event) => updateField("furnishing", event.target.value)}>
                    <option value="Furnished">Furnished</option>
                    <option value="Semi-Furnished">Semi-Furnished</option>
                    <option value="Unfurnished">Unfurnished</option>
                  </select>
                </div>
              </div>
            </div>

            <button className="primary-button animate-rise animate-delay-400 w-full" disabled={submitting} type="submit">
              {submitting ? "Predicting..." : "Get Rent Prediction"} <ArrowRight size={18} />
            </button>
          </form>

        </section>

        <section className="mt-8">
          <div className="mb-5 text-center">
            <h2 className="text-2xl font-extrabold sm:text-3xl">Quick Links</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Jump straight to the main areas of the website and understand what RentPredict offers.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Home", "Start a rent estimate with property details.", Home, "home"],
              ["Live Owner Listings", "Browse available owner-posted homes.", Building2, "owner-listings"],
              ["Feedback", "Share comments and improvement ideas.", MessageSquare, "feedback"]
            ].map(([title, text, Icon, target]) => (
              <button
                className="panel flex min-h-32 items-start gap-3 p-5 text-left"
                key={title}
                onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth" })}
                type="button"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-red-50 text-brand-red dark:bg-red-950/40 dark:text-red-200">
                  <Icon size={19} />
                </span>
                <span>
                  <span className="block font-extrabold">{title}</span>
                  <span className="mt-1 block text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section id="owner-listings" className="mt-8 overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-lift dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-3 bg-brand-navy px-5 py-6 text-white sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-red-100">
                <Building2 size={14} /> Live Owner Listings
              </div>
              <h2 className="text-3xl font-extrabold">Owner Added Properties</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-white/70">
                Active houses shared by owners with location, landmark, rent and contact details.
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold">
              {ownerListings.length} Active
            </span>
          </div>

          {ownerListings.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              No owner properties are active yet.
            </div>
          ) : (
            <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-3">
              {ownerListings.map((property) => {
                const pinQuery = propertyMapQuery(property);
                const pinLink = property.map_url || (pinQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pinQuery)}` : "");
                return (
                <article className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift dark:border-slate-800 dark:bg-slate-900" key={property.id}>
                  <PropertyImageCarousel images={property.image_urls || []} onZoom={setZoomImage} title={property.house_name || property.address} />

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-extrabold text-brand-navy dark:text-white">{property.house_name || "Owner Property"}</h3>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                        <MapPin size={15} /> {property.address}, {property.city}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                        <Landmark size={15} /> Near {property.nearest_landmark || "landmark not added"}
                      </p>
                      {pinLink && (
                        <a className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand-red dark:text-red-300" href={pinLink} rel="noreferrer" target="_blank">
                          <LocateFixed size={15} /> View location pin
                        </a>
                      )}
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Active
                    </span>
                  </div>

                  <div className="mt-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400">
                        <Wallet size={16} /> Rent
                      </span>
                      <span className="text-xl font-extrabold text-brand-blue dark:text-red-200">Rs {property.rent}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <p className="flex items-center gap-2"><Ruler size={15} /> {property.size || "-"} sqft</p>
                    <p className="flex items-center gap-2"><BedDouble size={15} /> {property.bhk || "-"} BHK</p>
                    <p className="flex items-center gap-2"><Bath size={15} /> {property.bathroom || "-"} Bath</p>
                    <p>{property.furnishing || "Furnishing"}</p>
                  </div>

                  <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    <p className="font-extrabold text-brand-navy dark:text-white">{property.contact_name || property.owner}</p>
                    <p className="flex items-center gap-2 break-all"><Mail size={15} /> {property.contact_email}</p>
                    <p className="flex items-center gap-2"><Phone size={15} /> {property.contact_number}</p>
                  </div>

                  {mapPreviewSrc(property) && (
                    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                      <iframe
                        className="h-44 w-full border-0"
                        loading="lazy"
                        src={mapPreviewSrc(property)}
                        title={`${property.house_name || "Property"} map pin`}
                      />
                    </div>
                  )}
                </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-4">
          {[
            ["Smart Estimate", "Uses trained data points and property features to calculate expected monthly rent.", Sparkles],
            ["Locality Search", "City-based locality filtering helps users select the correct area faster.", MapPin],
            ["Owner Friendly", "Owner and admin paths stay available from the navigation after login.", Building2],
            ["Clear Workflow", "The page now guides users from prediction to understanding and feedback.", ShieldCheck]
          ].map(([title, text, Icon]) => (
            <article className="panel p-5" key={title}>
              <span className="mb-4 grid size-10 place-items-center rounded-lg bg-red-50 text-brand-red dark:bg-red-950/40 dark:text-red-200">
                <Icon size={19} />
              </span>
              <h3 className="font-extrabold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p>
            </article>
          ))}
        </section>

        <section id="market" className="mt-8 animate-rise overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-lift dark:border-slate-800 dark:bg-slate-950">
          <div className="bg-brand-navy px-5 py-7 text-white sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-red-100">
                  <SlidersHorizontal size={14} /> Market Search
                </div>
                <h2 className="text-3xl font-extrabold sm:text-4xl">Market Insights</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
                  Select a city, narrow by locality, and compare rental bands for the most relevant neighborhoods.
                </p>
              </div>
              <div className="grid max-w-sm grid-cols-2 gap-3 rounded-lg border border-white/10 bg-white/10 p-3 backdrop-blur">
                <div>
                  <div className="text-2xl font-extrabold">{filteredMarketItems.length}</div>
                  <div className="text-xs font-semibold text-white/55">Matching Cards</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold">{marketCity === "All" ? "6" : "1"}</div>
                  <div className="text-xs font-semibold text-white/55">Cities Selected</div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr_180px]">
              <div>
                <label>Filter City</label>
                <select value={marketCity} onChange={(event) => setMarketCity(event.target.value)}>
                  <option value="All">All Cities</option>
                  {marketItems.map((item) => (
                    <option key={item.city} value={item.city}>{item.city}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Area / Locality</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    className="pl-10"
                    onChange={(event) => setMarketArea(event.target.value)}
                    placeholder="Try Whitefield, Powai, Garia..."
                    value={marketArea}
                  />
                </div>
              </div>
              <div>
                <label>Category</label>
                <select value={marketCategory} onChange={(event) => setMarketCategory(event.target.value)}>
                  {["All", "Premium", "Luxury", "Family", "Budget"].map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {["All", ...marketItems.map((item) => item.city)].map((city) => (
                  <button
                    className={`rounded-full border px-3 py-1.5 text-xs font-extrabold transition duration-300 ${
                      marketCity === city
                        ? "border-brand-red bg-brand-red text-white shadow-red"
                        : "border-slate-200 bg-white text-slate-600 hover:border-brand-red hover:text-brand-red dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                    }`}
                    key={city}
                    onClick={() => setMarketCity(city)}
                    type="button"
                  >
                    {city === "All" ? "All Cities" : city}
                  </button>
                ))}
              </div>
              {hasMarketFilters && (
                <button
                  className="secondary-button min-h-9 px-4 py-2"
                  onClick={() => {
                    setMarketCity("All");
                    setMarketArea("");
                    setMarketCategory("All");
                  }}
                  type="button"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Suggested Areas
              </span>
              {availableMarketAreas.map((area) => (
                <button
                  className={`rounded-full px-2.5 py-1 text-xs font-bold transition duration-300 ${
                    marketArea === area
                      ? "bg-brand-navy text-white dark:bg-white dark:text-brand-navy"
                      : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-brand-red dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700"
                  }`}
                  key={area}
                  onClick={() => setMarketArea(area)}
                  type="button"
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 dark:bg-slate-950 sm:p-6">
            {activeMarketItem ? (
              <div className="relative mx-auto max-w-3xl px-12 sm:px-14">
                <div className="mb-4 text-center">
                  <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Market Card {normalizedMarketSlideIndex + 1} of {filteredMarketItems.length}
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-10 flex items-center justify-between">
                  <button
                    aria-label="Previous market insight"
                    className="pointer-events-auto grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-brand-navy shadow-soft transition hover:-translate-y-0.5 hover:border-brand-red hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    disabled={filteredMarketItems.length <= 1}
                    onClick={() => moveMarketSlide(-1)}
                    type="button"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    aria-label="Next market insight"
                    className="pointer-events-auto grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-brand-navy shadow-soft transition hover:-translate-y-0.5 hover:border-brand-red hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    disabled={filteredMarketItems.length <= 1}
                    onClick={() => moveMarketSlide(1)}
                    type="button"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                <article
                  className="market-slide-card group relative cursor-pointer overflow-hidden rounded-lg border border-slate-200/80 bg-white p-5 shadow-soft transition duration-300 hover:-translate-y-1.5 hover:border-red-200 hover:shadow-[0_24px_70px_rgba(13,27,62,0.18)] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-red-900/80"
                  key={`${activeMarketItem.city}-${activeMarketItem.category}-${marketSlideIndex}`}
                  onClick={() => navigate(`/market/${encodeURIComponent(activeMarketItem.city)}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/market/${encodeURIComponent(activeMarketItem.city)}`);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <img
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-[0.13] transition duration-500 group-hover:scale-105 group-hover:opacity-[0.18] dark:opacity-[0.11]"
                    draggable="false"
                    src={activeMarketItem.image}
                  />
                  <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-white/45 via-white/10 to-white/40 dark:from-slate-900/55 dark:via-slate-900/15 dark:to-slate-900/50" />
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-red via-brand-blue to-emerald-400" />
                  <div className="relative z-10 mb-5 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-red-50 text-brand-red transition group-hover:scale-105 dark:bg-red-950/40 dark:text-red-200">
                        <MapPin size={20} />
                      </span>
                      <div>
                        <h3 className="text-xl font-extrabold text-brand-navy dark:text-white">{activeMarketItem.city}</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{activeMarketItem.title}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {activeMarketItem.category}
                    </span>
                  </div>

                  <div className="relative z-10 rounded-lg bg-slate-50/90 p-4 backdrop-blur-[1px] dark:bg-slate-950/85">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Rent Range
                      </span>
                      <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-extrabold text-green-700 dark:bg-green-950/40 dark:text-green-300">
                        {activeMarketItem.signal}
                      </span>
                    </div>
                    <div className="mt-2 text-3xl font-extrabold text-brand-navy dark:text-white">{activeMarketItem.rent}</div>
                  </div>

                  <div className="relative z-10 mt-4 flex flex-wrap gap-2">
                    {activeMarketItem.areas.map((area) => (
                      <button
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 transition hover:bg-brand-red hover:text-white dark:bg-slate-800 dark:text-slate-300"
                        key={area}
                        onClick={(event) => {
                          event.stopPropagation();
                          setMarketArea(area);
                        }}
                        type="button"
                      >
                        {area}
                      </button>
                    ))}
                  </div>

                  <p className="relative z-10 mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">{activeMarketItem.text}</p>
                  <button
                    className="relative z-10 mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-brand-red transition hover:gap-3 dark:text-red-300"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/market/${encodeURIComponent(activeMarketItem.city)}`);
                    }}
                    type="button"
                  >
                    View full city insights <ArrowRight size={16} />
                  </button>
                </article>

                <div className="mt-4 flex justify-center gap-2">
                  {filteredMarketItems.map((item, index) => (
                    <button
                      aria-label={`Show ${item.city} market insight`}
                      className={`h-2.5 rounded-full transition-all ${
                        index === normalizedMarketSlideIndex
                          ? "w-8 bg-brand-red"
                          : "w-2.5 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600"
                      }`}
                      key={`${item.city}-${item.category}-dot`}
                      onClick={() => chooseMarketSlide(index)}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {filteredMarketItems.length === 0 && (
            <div className="bg-white p-6 dark:bg-slate-950">
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900">
                <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-red-50 text-brand-red dark:bg-red-950/40 dark:text-red-200">
                  <Search size={20} />
                </div>
                <h3 className="text-lg font-extrabold">No matching market cards</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Try a nearby locality, switch the city, or clear filters to browse all available markets.
                </p>
              </div>
            </div>
          )}
        </section>

        <section id="about" className="mt-8 grid gap-4 lg:grid-cols-2">
          <article className="panel p-6">
            <h2 className="text-2xl font-extrabold">About RentPredict</h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              RentPredict helps users estimate a fair rental price before making a decision. It uses property size, BHK, bathrooms, city, locality, area type and furnishing status to create a fast prediction.
            </p>
          </article>
          <article className="panel p-6">
            <h3 className="text-lg font-extrabold">Why This Feels Professional</h3>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              The updated page now has clearer navigation, quick links, prediction tools, market insights, about content and a polished feedback experience.
            </p>
          </article>
        </section>

        <section id="feedback" className="mt-8 overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-lift dark:border-slate-800 dark:bg-slate-950">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <article className="p-5 sm:p-7">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-brand-red dark:bg-red-950/40 dark:text-red-200">
                <MessageSquare size={14} /> Feedback
              </div>
              <h2 className="text-2xl font-extrabold sm:text-3xl">Share Your Experience</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400">
                Tell us what worked well, where the experience can be clearer, and which rental features would make RentPredict more useful.
              </p>

              <form className="mt-6 grid gap-4" onSubmit={handleFeedback}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label>Name</label>
                    <input name="name" placeholder="Your name" required type="text" />
                  </div>
                  <div>
                    <label>Email Address</label>
                    <input name="email" placeholder="name@example.com" required type="email" />
                  </div>
                </div>
                <div>
                  <label>Feedback Message</label>
                  <textarea
                    className="min-h-36 resize-y"
                    name="message"
                    placeholder="Write your suggestions or comments"
                    required
                  />
                </div>
                <button className="primary-button w-full sm:w-fit" type="submit">
                  <Mail size={17} /> Send Feedback
                </button>
              </form>
            </article>

            <aside className="bg-brand-navy p-5 text-white sm:p-7">
              <div className="flex h-full flex-col justify-between gap-6">
                <div>
                  <h3 className="text-xl font-extrabold">Your Feedback Helps Improve RentPredict</h3>
                  <p className="mt-3 text-sm leading-7 text-white/70">
                    Each suggestion is reviewed to make the prediction flow easier, clearer and more useful for real rental decisions.
                  </p>
                </div>
                <div className="grid gap-3">
                  {[
                    ["Response Focus", "Accuracy, usability and missing rental details"],
                    ["Current Status", "Messages are acknowledged instantly on this page"],
                    ["Next Upgrade", "Database-backed feedback storage for admin review"]
                  ].map(([title, text]) => (
                    <div className="rounded-lg border border-white/10 bg-white/10 p-4" key={title}>
                      <div className="text-sm font-extrabold">{title}</div>
                      <p className="mt-1 text-xs leading-5 text-white/60">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Enter Details", "Property size, BHK, bathroom, city and locality."],
            ["AI Predicts", "The existing trained model calculates expected rent."],
            ["Get Result", "See rent, map context and create a rent alert."]
          ].map(([title, text], index) => (
            <article className="panel animate-rise p-5" key={title} style={{ animationDelay: `${index * 90}ms` }}>
              <div className="mb-3 grid size-9 place-items-center rounded-lg bg-red-50 text-sm font-extrabold text-brand-red">
                {index + 1}
              </div>
              <h3 className="font-extrabold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p>
            </article>
          ))}
        </section>
      </main>
        </div>
      </div>
      {zoomImage && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setZoomImage("")}>
          <button className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white text-brand-navy" type="button">
            <X size={20} />
          </button>
          <img alt="Zoomed property" className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-lift" src={zoomImage} />
        </div>
      )}
    </div>
  );
}
