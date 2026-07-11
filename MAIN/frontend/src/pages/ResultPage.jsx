import { BarChart3, Bath, Bell, BedDouble, Building2, ChevronLeft, ChevronRight, Edit3, Gauge, Home, Image, Landmark, LocateFixed, Mail, MapPin, Phone, PieChart, RotateCcw, Ruler, SlidersHorizontal, TrendingUp, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AreaPicker from "../components/AreaPicker";
import Message from "../components/Message";
import Navbar from "../components/Navbar";
import { apiGet, apiPost } from "../services/api";

const resultFormFromPrediction = (prediction) => ({
  size: prediction?.size || "",
  bhk: prediction?.bhk || "",
  bathroom: prediction?.bathroom || "",
  city: prediction?.city || "",
  area: prediction?.area || "",
  area_type: prediction?.area_type || "Super Area",
  furnishing: prediction?.furnishing || "Furnished"
});

const formatCurrency = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const predictionConfidenceRate = (rent) => {
  const amount = Number(String(rent ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  // Typical rent ranges are more familiar to the training data than price extremes.
  const rangeDistance = Math.abs(Math.log(amount / 30000));
  return Math.max(72, Math.min(91, Math.round(91 - rangeDistance * 9)));
};

const maxValue = (items) => Math.max(...items.map((item) => Number(item.value) || 0), 1);

const propertyMapQuery = (property) =>
  property.latitude && property.longitude
    ? `${property.latitude},${property.longitude}`
    : [property.area, property.city, "India"].filter(Boolean).join(", ");

const mapPreviewSrc = (property) =>
  property.latitude && property.longitude
    ? `https://maps.google.com/maps?hl=en&t=k&z=17&q=${encodeURIComponent(`${property.latitude},${property.longitude}`)}&output=embed`
    : "";

function PropertyImageCarousel({ images = [], title, onZoom }) {
  const [index, setIndex] = useState(0);
  if (!images.length) {
    return (
      <div className="mb-4 grid h-36 place-items-center rounded-lg bg-slate-100 text-slate-400">
        <Image size={26} />
      </div>
    );
  }

  const normalizedIndex = index % images.length;
  const activeImage = images[normalizedIndex];

  return (
    <div className="market-slide-card relative mb-4 overflow-hidden rounded-lg">
      <button className="block w-full" onClick={() => onZoom(activeImage)} type="button">
        <img alt={title} className="h-36 w-full cursor-zoom-in object-cover" src={activeImage} />
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

function InsightMetric({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-extrabold text-brand-navy dark:text-white">{value}</div>
    </div>
  );
}

function BarInsightChart({ items, valuePrefix = "Rs", showCount = false }) {
  const highest = maxValue(items);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const width = `${Math.max(8, ((Number(item.value) || 0) / highest) * 100)}%`;
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold text-slate-500 dark:text-slate-400">
              <span className="truncate">{item.label}</span>
              <span className={item.active ? "text-brand-red dark:text-red-300" : ""}>
                {showCount ? `${item.value} homes` : `${valuePrefix} ${Number(item.value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={`h-full rounded-full ${item.active ? "bg-brand-red" : "bg-brand-blue"}`}
                style={{ width }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChartPanel({ title, subtitle, icon: Icon, children }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-extrabold text-brand-navy dark:text-white">
            <Icon className="text-brand-red" size={18} /> {title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </article>
  );
}

export default function ResultPage({ darkMode, onOpenSidebar, onToggleTheme, session, navigate, logout, prediction, setPrediction }) {
  const [alertForm, setAlertForm] = useState({
    area: prediction?.area || "",
    budget: "",
    email: ""
  });
  const [cities, setCities] = useState([]);
  const [editForm, setEditForm] = useState(() => resultFormFromPrediction(prediction));
  const [editing, setEditing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("success");
  const [editMessage, setEditMessage] = useState("");
  const [editTone, setEditTone] = useState("error");
  const [zoomImage, setZoomImage] = useState("");
  const [insightsRefreshKey, setInsightsRefreshKey] = useState("");
  const listings = prediction?.listings || [];
  const marketInsights = prediction?.market_insights || {};
  const insightSummary = marketInsights.summary || {};
  const confidenceRate = predictionConfidenceRate(prediction?.rent);

  useEffect(() => {
    if (!prediction) return;
    setEditForm(resultFormFromPrediction(prediction));
    setAlertForm((current) => ({ ...current, area: prediction.area || "" }));
    setEditMessage("");
  }, [prediction]);

  useEffect(() => {
    apiGet("/api/cities").then((data) => setCities(data.cities || []));
  }, []);

  useEffect(() => {
    if (!prediction || marketInsights.rent_comparison?.length > 0) return;

    const predictionKey = [
      prediction.size,
      prediction.bhk,
      prediction.bathroom,
      prediction.city,
      prediction.area,
      prediction.area_type,
      prediction.furnishing
    ].join("|");

    if (insightsRefreshKey === predictionKey) return;
    setInsightsRefreshKey(predictionKey);

    apiPost("/api/predict", resultFormFromPrediction(prediction))
      .then((result) => setPrediction(result))
      .catch(() => {});
  }, [prediction, marketInsights.rent_comparison?.length, insightsRefreshKey, setPrediction]);

  const mapData = useMemo(() => {
    const query = [prediction?.area, prediction?.city, "India"].filter(Boolean).join(", ");
    if (!query) return { link: "", src: "" };

    const encodedQuery = encodeURIComponent(query);
    return {
      link: `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`,
      src: `https://maps.google.com/maps?hl=en&t=k&z=14&q=${encodedQuery}&output=embed`
    };
  }, [prediction?.area, prediction?.city]);

  const submitAlert = async (event) => {
    event.preventDefault();
    setMessage("");

    try {
      const data = await apiPost("/api/alerts", alertForm);
      setTone("success");
      setMessage(data.message);
    } catch (error) {
      setTone("error");
      setMessage(error.message);
    }
  };

  const updateEditField = (field, value) => {
    setEditForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "city" ? { area: "" } : {})
    }));
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    setEditMessage("");
    setUpdating(true);

    try {
      const result = await apiPost("/api/predict", editForm);
      setPrediction(result);
      setEditing(false);
      setEditTone("success");
      setEditMessage("Prediction updated with your edited details.");
    } catch (error) {
      setEditTone("error");
      setEditMessage(error.message);
    } finally {
      setUpdating(false);
    }
  };

  if (!prediction) {
    return (
      <div className="page-shell">
        <Navbar darkMode={darkMode} onOpenSidebar={onOpenSidebar} onToggleTheme={onToggleTheme} session={session} navigate={navigate} logout={logout} />
        <main className="mx-auto max-w-2xl px-4 py-12">
          <section className="panel animate-rise p-6 text-center">
            <Home className="mx-auto mb-3 animate-soft-float text-brand-red" size={36} />
            <h1 className="text-2xl font-extrabold">No prediction yet</h1>
            <p className="mt-2 text-sm text-slate-500">Start with the rent prediction form.</p>
            <button className="primary-button mt-5" onClick={() => navigate("/")} type="button">
              Go to Predictor
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <Navbar darkMode={darkMode} onOpenSidebar={onOpenSidebar} onToggleTheme={onToggleTheme} session={session} navigate={navigate} logout={logout} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.2fr_0.9fr]">
          <section className="panel animate-rise p-6 text-center">
            <div className="mx-auto grid size-16 animate-pulse-ring place-items-center rounded-lg bg-red-50">
              <Home className="text-brand-red" size={34} />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold">Predicted Room Rent</h1>
            <p className="mt-2 text-sm text-slate-500">Estimated Rent</p>
            <div className="my-6 text-4xl font-extrabold text-brand-blue sm:text-5xl">Rs {prediction.rent}</div>
            <div className="mb-5 rounded-lg bg-slate-50 p-4 text-left dark:bg-slate-950">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-extrabold text-brand-navy dark:text-white">
                  <Gauge className="text-brand-red" size={18} /> Estimated confidence
                </span>
                <span className="text-lg font-extrabold text-brand-red">{confidenceRate}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-full rounded-full bg-brand-red transition-all duration-500" style={{ width: `${confidenceRate}%` }} />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                This estimated rate adjusts with the predicted rent range.
              </p>
            </div>
            <div className="mb-5 rounded-lg bg-slate-50 p-4 text-left text-sm text-slate-600">
              <div className="flex items-center gap-2 font-bold text-brand-navy">
                <MapPin size={17} /> {prediction.area}
              </div>
              <div className="mt-1 pl-6">{prediction.city}</div>
            </div>
            <button className="secondary-button mb-3 w-full" onClick={() => setEditing((current) => !current)} type="button">
              <Edit3 size={18} /> {editing ? "Close Edit Details" : "Edit Details"}
            </button>
            <button className="primary-button w-full" onClick={() => navigate("/")} type="button">
              <RotateCcw size={18} /> Predict Again
            </button>
          </section>

          <section className="panel animate-rise animate-delay-100 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-extrabold">Map View</h2>
                <p className="text-sm text-slate-500">{prediction.area}, {prediction.city}</p>
              </div>
              <MapPin className="text-brand-red" size={24} />
            </div>
            {mapData.src ? (
              <div className="relative">
                <iframe
                  className="h-[420px] w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={mapData.src}
                  title="Google map for predicted area"
                />
                <div className="pointer-events-none absolute left-4 top-4 max-w-[calc(100%-2rem)] rounded-lg border border-red-200 bg-white/95 px-3 py-2 text-sm font-extrabold text-brand-navy shadow-soft">
                  <span className="mr-2 inline-block size-2 rounded-full bg-brand-red" />
                  Marked area: {prediction.area}
                </div>
                <a
                  className="absolute bottom-4 right-4 rounded-lg bg-white px-3 py-2 text-sm font-extrabold text-brand-navy shadow-soft ring-1 ring-slate-200 transition hover:text-brand-red"
                  href={mapData.link}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open marked area
                </a>
              </div>
            ) : (
              <div className="grid h-[420px] place-items-center p-6 text-center text-sm text-slate-500">
                Google Maps location is loading for {prediction.area}, {prediction.city}.
              </div>
            )}
          </section>

          <section className="panel animate-rise animate-delay-200 p-6">
            <h2 className="mb-5 flex items-center gap-2 text-xl font-extrabold">
              <Bell size={22} /> Set Rent Alert
            </h2>
            <p className="mb-5 text-sm leading-6 text-slate-500">
              Get notified for homes in this area under your selected budget.
            </p>
            <form className="space-y-4" onSubmit={submitAlert}>
              <Message tone={tone}>{message}</Message>
              <div>
                <label>Area</label>
                <input required value={alertForm.area} onChange={(event) => setAlertForm({ ...alertForm, area: event.target.value })} />
              </div>
              <div>
                <label>Max Rent</label>
                <input required type="number" value={alertForm.budget} onChange={(event) => setAlertForm({ ...alertForm, budget: event.target.value })} />
              </div>
              <div>
                <label>Email</label>
                <input required type="email" value={alertForm.email} onChange={(event) => setAlertForm({ ...alertForm, email: event.target.value })} />
              </div>
              <button className="primary-button w-full" type="submit">Set Alert</button>
            </form>
          </section>
        </div>

        <section className="panel mt-6 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-5 dark:border-slate-800 dark:bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-extrabold">
                <BarChart3 size={22} /> Prediction Market Charts
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Charts use the main CSV dataset for {insightSummary.scope || prediction.area}, compared with your predicted rent.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700">
              {insightSummary.records || 0} area records
            </span>
          </div>

          <div className="grid gap-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <InsightMetric label="Area average" value={formatCurrency(insightSummary.area_average)} />
            <InsightMetric label="Area median" value={formatCurrency(insightSummary.area_median)} />
            <InsightMetric label="Per sqft avg" value={`${formatCurrency(insightSummary.rent_per_sqft)} / sqft`} />
            <InsightMetric label="Affordability" value={insightSummary.prediction_band || "N/A"} />
          </div>

          <div className="grid gap-4 p-4 pt-0 md:grid-cols-2 xl:grid-cols-4">
            <ChartPanel
              icon={BarChart3}
              title="Rent Comparison"
              subtitle="Predicted rent against selected area and city averages."
            >
              <BarInsightChart items={marketInsights.rent_comparison || []} />
            </ChartPanel>

            <ChartPanel
              icon={PieChart}
              title="Affordability Bands"
              subtitle="City records split into affordable, moderate and premium groups."
            >
              <BarInsightChart items={marketInsights.affordability || []} showCount valuePrefix="" />
            </ChartPanel>

            <ChartPanel
              icon={TrendingUp}
              title="BHK Trend"
              subtitle="Average rent by BHK, using the selected area when enough records exist."
            >
              <BarInsightChart items={marketInsights.bhk_trend || []} />
            </ChartPanel>

            <ChartPanel
              icon={Wallet}
              title="Furnishing Impact"
              subtitle="Average rent by furnishing status in the matching market."
            >
              <BarInsightChart items={marketInsights.furnishing || []} />
            </ChartPanel>
          </div>

          {(marketInsights.area_samples || []).length > 0 && (
            <div className="border-t border-slate-200 p-4 dark:border-slate-800">
              <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                High-rent localities in {prediction.city}
              </h3>
              <div className="grid gap-3 md:grid-cols-5">
                {marketInsights.area_samples.map((item) => (
                  <div
                    className={`rounded-lg border p-3 ${
                      item.active
                        ? "border-red-200 bg-red-50 text-brand-red dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200"
                        : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                    }`}
                    key={item.label}
                  >
                    <div className="truncate text-xs font-bold text-slate-500 dark:text-slate-400">{item.label}</div>
                    <div className="mt-1 text-lg font-extrabold">{formatCurrency(item.value)}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.count} records</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="panel mt-6 overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-extrabold">
                <SlidersHorizontal size={22} /> Customize Prediction Details
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Edit the property inputs and update the result without starting over.
              </p>
            </div>
            <button className="secondary-button" onClick={() => setEditing((current) => !current)} type="button">
              <Edit3 size={17} /> {editing ? "Hide" : "Edit"}
            </button>
          </div>
          {editMessage && (
            <div className="px-4 pt-4 sm:px-6">
              <Message tone={editTone}>{editMessage}</Message>
            </div>
          )}

          {editing ? (
            <form className="space-y-5 p-4 sm:p-6" onSubmit={submitEdit}>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label>Size (sqft)</label>
                  <input type="number" min="100" required value={editForm.size} onChange={(event) => updateEditField("size", event.target.value)} />
                </div>
                <div>
                  <label>BHK</label>
                  <select required value={editForm.bhk} onChange={(event) => updateEditField("bhk", event.target.value)}>
                    <option value="">Select BHK</option>
                    {[1, 2, 3, 4, 5, 6].map((item) => (
                      <option key={item} value={item}>{item} BHK</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Bathrooms</label>
                  <select required value={editForm.bathroom} onChange={(event) => updateEditField("bathroom", event.target.value)}>
                    <option value="">Select</option>
                    {[1, 2, 3, 4, 5].map((item) => (
                      <option key={item} value={item}>{item} Bathroom{item > 1 ? "s" : ""}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
                <div>
                  <label>City</label>
                  <select required value={editForm.city} onChange={(event) => updateEditField("city", event.target.value)}>
                    <option value="">Select City</option>
                    {cities.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Search Area / Locality</label>
                  <AreaPicker city={editForm.city} value={editForm.area} onChange={(value) => updateEditField("area", value)} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label>Area Type</label>
                  <select value={editForm.area_type} onChange={(event) => updateEditField("area_type", event.target.value)}>
                    <option value="Super Area">Super Area</option>
                    <option value="Carpet Area">Carpet Area</option>
                    <option value="Built Area">Built Area</option>
                  </select>
                </div>
                <div>
                  <label>Furnishing Status</label>
                  <select value={editForm.furnishing} onChange={(event) => updateEditField("furnishing", event.target.value)}>
                    <option value="Furnished">Furnished</option>
                    <option value="Semi-Furnished">Semi-Furnished</option>
                    <option value="Unfurnished">Unfurnished</option>
                  </select>
                </div>
              </div>

              <button className="primary-button w-full" disabled={updating} type="submit">
                {updating ? "Updating..." : "Update Prediction"}
              </button>
            </form>
          ) : (
            <div className="grid gap-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3"><span className="font-bold text-slate-500">Size</span><div className="mt-1 font-extrabold">{prediction.size} sqft</div></div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="font-bold text-slate-500">Rooms</span><div className="mt-1 font-extrabold">{prediction.bhk} BHK, {prediction.bathroom} Bath</div></div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="font-bold text-slate-500">Area Type</span><div className="mt-1 font-extrabold">{prediction.area_type}</div></div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="font-bold text-slate-500">Furnishing</span><div className="mt-1 font-extrabold">{prediction.furnishing}</div></div>
            </div>
          )}
        </section>

        <section className="panel mt-6 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-brand-navy px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-extrabold">
                <Building2 size={22} /> Matching Houses
              </h2>
              <p className="mt-1 text-sm text-white/70">
                Listings are sorted near Rs {prediction.rent}, including a little lower and higher rent.
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold">
              {listings.length} found
            </span>
          </div>

          {listings.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No matching listings were found for this prediction yet.
            </div>
          ) : (
            <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
              {listings.map((listing) => {
                const pinQuery = propertyMapQuery(listing);
                const pinLink = listing.map_url || (pinQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pinQuery)}` : "");
                return (
                <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft" key={listing.id}>
                  {listing.source === "owner" ? (
                    <PropertyImageCarousel images={listing.image_urls || []} onZoom={setZoomImage} title={listing.house_name || listing.area} />
                  ) : null}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-brand-navy">{listing.house_name || listing.area}</h3>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                        <MapPin size={15} /> {listing.city}
                      </p>
                      {listing.house_name && (
                        <p className="mt-1 text-sm text-slate-500">{listing.area}</p>
                      )}
                      {listing.nearest_landmark && (
                        <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                          <Landmark size={15} /> Near {listing.nearest_landmark}
                        </p>
                      )}
                      {listing.source === "owner" && pinLink && (
                        <a className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand-red" href={pinLink} rel="noreferrer" target="_blank">
                          <LocateFixed size={15} /> View location pin
                        </a>
                      )}
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${
                      listing.source === "owner"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {listing.source === "owner" ? "Owner" : "Dataset"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-bold text-slate-500">
                        <Wallet size={16} /> Rent
                      </span>
                      <span className="text-xl font-extrabold text-brand-blue">Rs {listing.rent}</span>
                    </div>
                    <div className="mt-2 text-xs font-bold text-slate-500">
                      {listing.difference > 0 ? "Higher by" : listing.difference < 0 ? "Lower by" : "Same as prediction"}{" "}
                      Rs {Math.abs(Number(listing.difference || 0))}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
                    <p className="flex items-center gap-2"><Ruler size={15} /> {listing.size} sqft</p>
                    <p className="flex items-center gap-2"><BedDouble size={15} /> {listing.bhk} BHK</p>
                    <p className="flex items-center gap-2"><Bath size={15} /> {listing.bathroom} Bath</p>
                    <p>{listing.furnishing}</p>
                  </div>

                  {listing.source === "owner" ? (
                    <div className="mt-4 space-y-2 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
                      <p className="font-extrabold">{listing.contact_name || listing.owner}</p>
                      <p className="flex items-center gap-2 break-all"><Mail size={15} /> {listing.contact_email}</p>
                      <p className="flex items-center gap-2"><Phone size={15} /> {listing.contact_number}</p>
                    </div>
                  ) : (
                    <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                      Dataset example from historical rent records. Signup as owner to publish contact details.
                    </p>
                  )}

                  {listing.source === "owner" && mapPreviewSrc(listing) && (
                    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                      <iframe
                        className="h-40 w-full border-0"
                        loading="lazy"
                        src={mapPreviewSrc(listing)}
                        title={`${listing.house_name || "Owner property"} map pin`}
                      />
                    </div>
                  )}
                </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
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
