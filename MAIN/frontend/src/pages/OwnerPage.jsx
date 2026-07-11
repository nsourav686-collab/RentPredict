import {
  Bath,
  BedDouble,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  Image,
  Landmark,
  LocateFixed,
  Mail,
  MapPin,
  Phone,
  Plus,
  Ruler,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Wallet,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AreaPicker from "../components/AreaPicker";
import Message from "../components/Message";
import Navbar from "../components/Navbar";
import { apiGet, apiPatch, apiPost, apiPut } from "../services/api";

const emptyForm = {
  city: "",
  address: "",
  house_name: "",
  nearest_landmark: "",
  image_urls: [],
  area_type: "Super Area",
  furnishing: "Furnished",
  size: "",
  bhk: "",
  bathroom: "",
  rent: "",
  contact_name: "",
  contact_email: "",
  contact_number: "",
  latitude: "",
  longitude: "",
  map_url: "",
  status: "active"
};

const formatRent = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const mapTileSize = 256;
const mapZoom = 14;
const cityCenters = {
  Bangalore: { latitude: 12.9716, longitude: 77.5946 },
  Mumbai: { latitude: 19.076, longitude: 72.8777 },
  Delhi: { latitude: 28.6139, longitude: 77.209 },
  Chennai: { latitude: 13.0827, longitude: 80.2707 },
  Hyderabad: { latitude: 17.385, longitude: 78.4867 },
  Kolkata: { latitude: 22.5726, longitude: 88.3639 }
};

const predictionReady = (form) =>
  form.city && form.address && form.size && form.bhk && form.bathroom && form.area_type && form.furnishing;

const ownerPredictionPayload = (form) => ({
  city: form.city,
  area: form.address,
  size: form.size,
  bhk: form.bhk,
  bathroom: form.bathroom,
  area_type: form.area_type,
  furnishing: form.furnishing
});

const extractPinCoordinates = (value) => {
  const text = (value || "").trim();
  const atMatch = text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  const queryMatch = text.match(/[?&](?:q|query)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  const plainMatch = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  const match = atMatch || queryMatch || plainMatch;
  return match ? { latitude: match[1], longitude: match[2] } : null;
};

const propertyMapQuery = (property) =>
  property.latitude && property.longitude
    ? `${property.latitude},${property.longitude}`
    : [property.address, property.city, "India"].filter(Boolean).join(", ");

const mapPreviewSrc = (query) =>
  query ? `https://maps.google.com/maps?hl=en&t=k&z=17&q=${encodeURIComponent(query)}&output=embed` : "";

const googlePinUrl = (latitude, longitude) =>
  latitude && longitude ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}` : "";

const mapCenterFor = (city, latitude, longitude) => {
  if (latitude && longitude) return { latitude: Number(latitude), longitude: Number(longitude) };
  return cityCenters[city] || cityCenters.Kolkata;
};

const latLonToWorld = (latitude, longitude, zoom = mapZoom) => {
  const scale = 2 ** zoom;
  const sinLatitude = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale * mapTileSize,
    y: (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * scale * mapTileSize
  };
};

const worldToLatLon = (x, y, zoom = mapZoom) => {
  const scale = 2 ** zoom;
  const longitude = (x / (scale * mapTileSize)) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / (scale * mapTileSize);
  const latitude = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { latitude, longitude };
};

function ImageCarousel({ images = [], title, onZoom, dark = false }) {
  const [index, setIndex] = useState(0);
  if (!images.length) {
    return (
      <div className={`mb-4 grid h-40 place-items-center rounded-lg ${dark ? "bg-white/10 text-white/55" : "bg-slate-100 text-slate-400 dark:bg-slate-800"}`}>
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
          <button
            aria-label="Previous property image"
            className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-navy shadow-soft"
            onClick={() => setIndex((current) => (current - 1 + images.length) % images.length)}
            type="button"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label="Next property image"
            className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-brand-navy shadow-soft"
            onClick={() => setIndex((current) => (current + 1) % images.length)}
            type="button"
          >
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

function PinDropMap({ centerHint, city, latitude, longitude, onDrop }) {
  const center = latitude && longitude
    ? mapCenterFor(city, latitude, longitude)
    : centerHint || mapCenterFor(city, latitude, longitude);
  const centerWorld = latLonToWorld(center.latitude, center.longitude);
  const centerTileX = Math.floor(centerWorld.x / mapTileSize);
  const centerTileY = Math.floor(centerWorld.y / mapTileSize);
  const scale = 2 ** mapZoom;
  const tiles = [];

  for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
    for (let xOffset = -2; xOffset <= 2; xOffset += 1) {
      const x = centerTileX + xOffset;
      const y = centerTileY + yOffset;
      tiles.push({ x, y });
    }
  }

  const selectedWorld = latitude && longitude ? latLonToWorld(Number(latitude), Number(longitude)) : null;

  const dropPin = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = centerWorld.x + event.clientX - rect.left - rect.width / 2;
    const y = centerWorld.y + event.clientY - rect.top - rect.height / 2;
    const coordinates = worldToLatLon(x, y);
    const nextLatitude = coordinates.latitude.toFixed(6);
    const nextLongitude = coordinates.longitude.toFixed(6);
    onDrop({
      latitude: nextLatitude,
      longitude: nextLongitude,
      map_url: googlePinUrl(nextLatitude, nextLongitude)
    });
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-white/15">
      <button
        aria-label="Drop property pin on map"
        className="relative block h-64 w-full cursor-crosshair overflow-hidden bg-slate-200 text-left"
        onClick={dropPin}
        type="button"
      >
        {tiles.map((tile) => {
          const x = ((tile.x % scale) + scale) % scale;
          const left = tile.x * mapTileSize - centerWorld.x;
          const top = tile.y * mapTileSize - centerWorld.y;
          return (
            <img
              alt=""
              className="absolute max-w-none select-none"
              draggable="false"
              key={`${tile.x}-${tile.y}`}
              src={`https://tile.openstreetmap.org/${mapZoom}/${x}/${tile.y}.png`}
              style={{
                height: mapTileSize,
                left: `calc(50% + ${left}px)`,
                top: `calc(50% + ${top}px)`,
                width: mapTileSize
              }}
            />
          );
        })}
        {selectedWorld && (
          <span
            className="absolute z-10 -translate-x-1/2 -translate-y-full text-brand-red drop-shadow-lg"
            style={{
              left: `calc(50% + ${selectedWorld.x - centerWorld.x}px)`,
              top: `calc(50% + ${selectedWorld.y - centerWorld.y}px)`
            }}
          >
            <MapPin fill="currentColor" size={34} />
          </span>
        )}
      </button>
      <div className="absolute left-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-xs font-extrabold text-brand-navy shadow-soft">
        Click the exact property location to drop the pin
      </div>
    </div>
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function OwnerPage({ darkMode, onOpenSidebar, onToggleTheme, session, navigate, logout }) {
  const [cities, setCities] = useState([]);
  const [properties, setProperties] = useState([]);
  const [owner, setOwner] = useState({ username: "", email: "", contact_number: "" });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [zoomImage, setZoomImage] = useState("");
  const [suggestedRent, setSuggestedRent] = useState(null);
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [mapCenterHint, setMapCenterHint] = useState(null);
  const [tone, setTone] = useState("error");

  const totalRent = useMemo(
    () => properties.reduce((sum, property) => sum + Number(property.rent || 0), 0),
    [properties]
  );

  const activeCount = useMemo(
    () => properties.filter((property) => (property.status || "active") === "active").length,
    [properties]
  );

  const formWithOwner = (ownerData = owner) => ({
    ...emptyForm,
    contact_name: ownerData.username || "",
    contact_email: ownerData.email || "",
    contact_number: ownerData.contact_number || ""
  });

  const loadProperties = () => {
    apiGet("/api/owner/properties")
      .then((data) => {
        const ownerData = data.owner || {};
        setCities(data.cities || []);
        setProperties(data.properties || []);
        setOwner(ownerData);
        setForm((current) => ({
          ...current,
          contact_name: current.contact_name || ownerData.username || "",
          contact_email: current.contact_email || ownerData.email || "",
          contact_number: current.contact_number || ownerData.contact_number || ""
        }));
      })
      .catch((error) => {
        setTone("error");
        setMessage(error.message);
        navigate("/login");
      });
  };

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    if (!form.city && !form.address) {
      setMapCenterHint(null);
      return;
    }

    const query = [form.address, form.city, "India"].filter(Boolean).join(", ");
    const timer = window.setTimeout(() => {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`)
        .then((response) => response.json())
        .then((items) => {
          if (items?.[0]) {
            setMapCenterHint({
              latitude: Number(items[0].lat),
              longitude: Number(items[0].lon)
            });
          } else {
            setMapCenterHint(mapCenterFor(form.city));
          }
        })
        .catch(() => setMapCenterHint(mapCenterFor(form.city)));
    }, 500);

    return () => window.clearTimeout(timer);
  }, [form.city, form.address]);

  useEffect(() => {
    setSuggestedRent(null);
    setSuggestionMessage("");
    if (!predictionReady(form)) return;

    const timer = window.setTimeout(() => {
      setSuggestionMessage("Calculating suggested rent...");
      apiPost("/api/owner/rent-suggestion", ownerPredictionPayload(form))
        .then((data) => {
          setSuggestedRent(data.rent);
          setSuggestionMessage("");
        })
        .catch((error) => {
          setSuggestedRent(null);
          setSuggestionMessage(error.message);
        });
    }, 650);

    return () => window.clearTimeout(timer);
  }, [form.city, form.address, form.size, form.bhk, form.bathroom, form.area_type, form.furnishing]);

  const updateForm = (updates) => {
    setForm((current) => ({ ...current, ...updates }));
  };

  const updateCity = (city) => {
    updateForm({ city, address: "", latitude: "", longitude: "", map_url: "" });
  };

  const updateAddress = (address) => {
    updateForm({ address, latitude: "", longitude: "", map_url: "" });
  };

  const useAreaAsMapPin = () => {
    const center = mapCenterHint || mapCenterFor(form.city, form.latitude, form.longitude);
    const nextLatitude = Number(center.latitude).toFixed(6);
    const nextLongitude = Number(center.longitude).toFixed(6);
    updateForm({ latitude: nextLatitude, longitude: nextLongitude, map_url: googlePinUrl(nextLatitude, nextLongitude) });
  };

  const formMapQuery = propertyMapQuery(form);
  const formMapSrc = mapPreviewSrc(formMapQuery);
  const formMapLink = form.map_url || (form.latitude && form.longitude ? googlePinUrl(form.latitude, form.longitude) : "");

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");

    try {
      if (editingId) {
        const data = await apiPut(`/api/owner/properties/${editingId}`, form);
        setProperties(data.properties || []);
        setTone("success");
        setMessage(data.message || "Property updated and sent to admin for verification.");
        setEditingId(null);
      } else {
        const data = await apiPost("/api/owner/properties", form);
        setTone("success");
        setMessage(data.message || "Property added. It is pending admin verification.");
        loadProperties();
      }
      setForm(formWithOwner());
    } catch (error) {
      setTone("error");
      setMessage(error.message);
    }
  };

  const handleImages = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const images = await Promise.all(files.map(fileToDataUrl));
    setForm((current) => ({
      ...current,
      image_urls: [...current.image_urls, ...images].slice(0, 6)
    }));
    event.target.value = "";
  };

  const editProperty = (property) => {
    setEditingId(property.id);
    setTone("error");
    setMessage("");
      setForm({
      ...emptyForm,
      ...property,
      image_urls: property.image_urls || [],
      latitude: property.latitude || "",
      longitude: property.longitude || "",
      map_url: property.map_url || "",
      status: property.status || "active"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleStatus = async (property) => {
    const nextStatus = (property.status || "active") === "active" ? "deactive" : "active";
    setProperties((current) =>
      current.map((item) => item.id === property.id ? { ...item, status: nextStatus } : item)
    );
    try {
      await apiPatch(`/api/owner/properties/${property.id}/status`, { status: nextStatus });
    } catch (error) {
      setProperties((current) =>
        current.map((item) => item.id === property.id ? { ...item, status: property.status || "active" } : item)
      );
      setTone("error");
      setMessage(error.message);
    }
  };

  return (
    <div className="page-shell auth-background relative overflow-hidden">
      <div className="mesh-overlay" />
      <Navbar darkMode={darkMode} onOpenSidebar={onOpenSidebar} onToggleTheme={onToggleTheme} session={session} navigate={navigate} logout={logout} />
      <main className="relative mx-auto max-w-6xl px-4 py-8 text-white">
        <h1 className="animate-rise text-center text-4xl font-extrabold">Owner Dashboard</h1>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            [properties.length, "Total Properties", Building2],
            [activeCount, "Active Listings", CheckCircle2],
            [`Rs ${totalRent}`, "Total Rent Value", Wallet],
            [cities.length, "Cities Covered", MapPin]
          ].map(([value, label, Icon], index) => (
            <section
              key={label}
              className="glass-panel animate-rise p-5 text-center transition duration-300 hover:-translate-y-1 hover:bg-white/15"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <Icon className="mx-auto mb-3 text-cyan-300" size={24} />
              <div className="text-2xl font-extrabold">{value}</div>
              <div className="mt-1 text-sm text-white/65">{label}</div>
            </section>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="glass-panel animate-rise animate-delay-100 p-5 sm:p-6">
            <h2 className="mb-5 flex items-center gap-2 text-2xl font-extrabold">
              {editingId ? <Edit3 size={24} /> : <Plus size={24} />}
              {editingId ? "Edit Property" : "Add Property"}
            </h2>
            <form className="space-y-4" onSubmit={submit}>
              <Message tone={tone}>{message}</Message>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-white/70">House / Property Name</label>
                  <input required value={form.house_name} onChange={(event) => setForm({ ...form, house_name: event.target.value })} />
                </div>
                <div>
                  <label className="text-white/70">Nearest Landmark</label>
                  <input required value={form.nearest_landmark} onChange={(event) => setForm({ ...form, nearest_landmark: event.target.value })} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-white/70">City</label>
                  <select required value={form.city} onChange={(event) => updateCity(event.target.value)}>
                    <option value="">Select City</option>
                    {cities.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-white/70">Search Area</label>
                  <AreaPicker city={form.city} value={form.address} onChange={updateAddress} />
                </div>
              </div>

              <div className="rounded-lg border border-white/15 bg-white/10 p-4">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 font-extrabold">
                      <LocateFixed size={18} /> Property Pin Location
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-white/60">
                      Click on the map to drop the exact room/property pin. This saved pin is shown to users and admin.
                    </p>
                  </div>
                  <button className="secondary-button min-h-10 px-3 py-2" onClick={useAreaAsMapPin} type="button">
                    <MapPin size={16} /> Center Pin
                  </button>
                </div>
                <PinDropMap
                  centerHint={mapCenterHint}
                  city={form.city}
                  latitude={form.latitude}
                  longitude={form.longitude}
                  onDrop={(coordinates) => updateForm(coordinates)}
                />
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white/75">
                    {form.latitude && form.longitude
                      ? `Saved pin: ${form.latitude}, ${form.longitude}`
                      : "No exact pin saved yet. Click the map before adding the property."}
                  </div>
                  <a
                    className={`secondary-button min-h-10 px-3 py-2 ${!formMapLink ? "pointer-events-none opacity-60" : ""}`}
                    href={formMapLink || "#"}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink size={16} /> Open Pin
                  </a>
                </div>
                {form.latitude && form.longitude && formMapSrc && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-white/15">
                    <iframe className="h-48 w-full border-0" loading="lazy" src={formMapSrc} title="Saved property pin preview" />
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-white/70">Size</label>
                  <input required min="100" type="number" value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} />
                </div>
                <div>
                  <label className="text-white/70">BHK</label>
                  <select required value={form.bhk} onChange={(event) => setForm({ ...form, bhk: event.target.value })}>
                    <option value="">Select</option>
                    {[1, 2, 3, 4, 5, 6].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/70">Bathrooms</label>
                  <select required value={form.bathroom} onChange={(event) => setForm({ ...form, bathroom: event.target.value })}>
                    <option value="">Select</option>
                    {[1, 2, 3, 4, 5].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-white/70">Area Type</label>
                  <select value={form.area_type} onChange={(event) => setForm({ ...form, area_type: event.target.value })}>
                    <option value="Super Area">Super Area</option>
                    <option value="Carpet Area">Carpet Area</option>
                    <option value="Built Area">Built Area</option>
                  </select>
                </div>
                <div>
                  <label className="text-white/70">Furnishing</label>
                  <select value={form.furnishing} onChange={(event) => setForm({ ...form, furnishing: event.target.value })}>
                    <option value="Furnished">Furnished</option>
                    <option value="Semi-Furnished">Semi-Furnished</option>
                    <option value="Unfurnished">Unfurnished</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-white/70">Rent Amount</label>
                  <input required min="1" type="number" value={form.rent} onChange={(event) => setForm({ ...form, rent: event.target.value })} />
                </div>
                <div>
                  <label className="text-white/70">Status</label>
                  <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                    <option value="active">Active</option>
                    <option value="deactive">Deactive</option>
                  </select>
                </div>
              </div>

              {(suggestedRent || suggestionMessage) && (
                <div className="rounded-lg border border-cyan-200/40 bg-cyan-300/10 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 font-extrabold">
                        <Sparkles size={18} /> Suggested Rent Reference
                      </h3>
                      <p className="mt-1 text-sm text-white/70">
                        {suggestedRent ? `${formatRent(suggestedRent)} based on your room details` : suggestionMessage}
                      </p>
                    </div>
                    {suggestedRent && (
                      <button className="secondary-button min-h-10 px-3 py-2" onClick={() => updateForm({ rent: Math.round(Number(suggestedRent)) })} type="button">
                        Use Amount
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-white/70">Property Images</label>
                <input accept="image/*" multiple type="file" onChange={handleImages} />
                {form.image_urls.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {form.image_urls.map((image, index) => (
                      <div className="relative overflow-hidden rounded-lg border border-white/15" key={`${image.slice(0, 30)}-${index}`}>
                        <button className="block w-full" onClick={() => setZoomImage(image)} type="button">
                          <img alt={`Property ${index + 1}`} className="h-20 w-full cursor-zoom-in object-cover" src={image} />
                        </button>
                        <button
                          className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"
                          onClick={() => setForm((current) => ({
                            ...current,
                            image_urls: current.image_urls.filter((_, itemIndex) => itemIndex !== index)
                          }))}
                          type="button"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-white/70">Contact Name</label>
                  <input required value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} />
                </div>
                <div>
                  <label className="text-white/70">Contact Email</label>
                  <input required type="email" value={form.contact_email} onChange={(event) => setForm({ ...form, contact_email: event.target.value })} />
                </div>
                <div>
                  <label className="text-white/70">Contact Number</label>
                  <input required value={form.contact_number} onChange={(event) => setForm({ ...form, contact_number: event.target.value })} />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button className="primary-button flex-1" type="submit">{editingId ? "Save Changes" : "Add Property"}</button>
                {editingId && (
                  <button
                    className="secondary-button flex-1"
                    onClick={() => {
                      setEditingId(null);
                      setForm(formWithOwner());
                    }}
                    type="button"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="glass-panel animate-rise animate-delay-200 p-5 sm:p-6">
            <h2 className="mb-5 flex items-center gap-2 text-2xl font-extrabold">
              <Building2 size={24} /> Your Properties
            </h2>
            <div className="max-h-[780px] space-y-4 overflow-y-auto pr-1">
              {properties.length === 0 && <p className="text-sm text-white/65">No properties added yet.</p>}
              {properties.map((property) => {
                const isActive = (property.status || "active") === "active";
                const pinQuery = propertyMapQuery(property);
                const pinLink = property.map_url || (pinQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pinQuery)}` : "");
                return (
                  <article key={property.id} className="rounded-lg border-l-4 border-cyan-300 bg-white/10 p-4 transition duration-300 hover:translate-x-1 hover:bg-white/15">
                    <ImageCarousel dark images={property.image_urls || []} onZoom={setZoomImage} title={property.house_name || "Property"} />

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold">{property.house_name || "Unnamed Property"}</h3>
                        <p className="mt-1 flex items-center gap-2 text-sm text-white/75">
                          <MapPin size={17} /> {property.address}, {property.city}
                        </p>
                        <p className="mt-1 flex items-center gap-2 text-sm text-white/75">
                          <Landmark size={16} /> Near {property.nearest_landmark || "landmark not added"}
                        </p>
                        {pinLink && (
                          <a className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-cyan-200 hover:text-white" href={pinLink} rel="noreferrer" target="_blank">
                            <LocateFixed size={16} /> View saved pin
                          </a>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                        isActive ? "bg-emerald-500" : "bg-slate-500"
                      }`}>
                        <CheckCircle2 size={13} /> {isActive ? "Active" : "Deactive"}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-white/75 sm:grid-cols-2">
                      <p className="flex items-center gap-2"><Wallet size={16} /> Rent: Rs {property.rent}</p>
                      <p className="flex items-center gap-2"><Ruler size={16} /> {property.size || "-"} sqft</p>
                      <p className="flex items-center gap-2"><BedDouble size={16} /> {property.bhk || "-"} BHK</p>
                      <p className="flex items-center gap-2"><Bath size={16} /> {property.bathroom || "-"} Bath</p>
                      <p className="flex items-center gap-2"><Mail size={16} /> {property.contact_email || owner.email}</p>
                      <p className="flex items-center gap-2"><Phone size={16} /> {property.contact_number || owner.contact_number}</p>
                    </div>

                    {property.latitude && property.longitude && (
                      <div className="mt-4 overflow-hidden rounded-lg border border-white/15">
                        <iframe
                          className="h-44 w-full border-0"
                          loading="lazy"
                          src={mapPreviewSrc(`${property.latitude},${property.longitude}`)}
                          title={`${property.house_name || "Property"} saved map pin`}
                        />
                      </div>
                    )}

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button className="secondary-button min-h-10 py-2" onClick={() => editProperty(property)} type="button">
                        <Edit3 size={16} /> Edit
                      </button>
                      <button className="secondary-button min-h-10 py-2" onClick={() => toggleStatus(property)} type="button">
                        {isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        {isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
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
