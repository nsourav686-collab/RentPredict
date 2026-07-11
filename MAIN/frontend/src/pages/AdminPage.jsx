import {
  Bath,
  BedDouble,
  BadgeCheck,
  Building2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Crown,
  History,
  Image,
  Landmark,
  LocateFixed,
  Mail,
  MapPin,
  Phone,
  Ruler,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  Wallet,
  X,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Message from "../components/Message";
import Navbar from "../components/Navbar";
import { apiDelete, apiGet, apiPatch } from "../services/api";

const approvalStyles = {
  approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  rejected: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
};

const propertyMapQuery = (property) =>
  property.latitude && property.longitude
    ? `${property.latitude},${property.longitude}`
    : [property.address, property.city, "India"].filter(Boolean).join(", ");

const mapPreviewSrc = (property) =>
  property.latitude && property.longitude
    ? `https://maps.google.com/maps?hl=en&t=k&z=17&q=${encodeURIComponent(`${property.latitude},${property.longitude}`)}&output=embed`
    : "";

function ImageCarousel({ images = [], title, onZoom }) {
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

export default function AdminPage({ darkMode, onOpenSidebar, onToggleTheme, session, navigate, logout }) {
  const [properties, setProperties] = useState([]);
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("success");
  const [zoomImage, setZoomImage] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");

  const stats = useMemo(() => {
    const owners = users.filter((user) => user.role === "owner").length;
    const normalUsers = users.filter((user) => user.role === "user").length;
    const pending = properties.filter((property) => (property.approval_status || "approved") === "pending").length;
    const approved = properties.filter((property) => (property.approval_status || "approved") === "approved").length;

    return { owners, normalUsers, pending, approved };
  }, [properties, users]);

  const filteredUsers = users.filter((user) => userFilter === "all" || user.role === userFilter);
  const filteredProperties = properties.filter((property) => {
    const approval = property.approval_status || "approved";
    if (propertyFilter === "all") return true;
    if (propertyFilter === "active") return (property.status || "active") === "active";
    if (propertyFilter === "deactive") return (property.status || "active") === "deactive";
    return approval === propertyFilter;
  });

  const showError = (error) => {
    setTone("error");
    setMessage(error.message);
    if (error.message.toLowerCase().includes("admin")) navigate("/login");
  };

  const loadAdminData = () => {
    setMessage("");
    Promise.all([apiGet("/api/admin/users"), apiGet("/api/admin/properties")])
      .then(([userData, propertyData]) => {
        setUsers(userData.users || []);
        setProperties(propertyData.properties || []);
      })
      .catch(showError);
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const deleteUser = async (user) => {
    const confirmed = window.confirm(`Delete ${user.username}? Owner properties from this account will also be removed.`);
    if (!confirmed) return;

    const previousUsers = users;
    const previousProperties = properties;
    setUsers((current) => current.filter((item) => item.id !== user.id));
    setProperties((current) => current.filter((item) => item.owner !== user.username));

    try {
      const result = await apiDelete(`/api/admin/users/${user.id}`);
      setTone("success");
      setMessage(result.message);
    } catch (error) {
      setUsers(previousUsers);
      setProperties(previousProperties);
      showError(error);
    }
  };

  const deleteProperty = async (property) => {
    const confirmed = window.confirm(`Delete ${property.house_name || property.address}? This cannot be undone.`);
    if (!confirmed) return;

    const previous = properties;
    setProperties((current) => current.filter((item) => item.id !== property.id));

    try {
      const result = await apiDelete(`/api/admin/properties/${property.id}`);
      setTone("success");
      setMessage(result.message);
    } catch (error) {
      setProperties(previous);
      showError(error);
    }
  };

  const updateApproval = async (property, approvalStatus) => {
    const previous = properties;
    setProperties((current) =>
      current.map((item) =>
        item.id === property.id ? { ...item, approval_status: approvalStatus } : item
      )
    );

    try {
      const result = await apiPatch(`/api/admin/properties/${property.id}/approval`, {
        approval_status: approvalStatus
      });
      setProperties(result.properties || []);
      setTone("success");
      setMessage(result.email_status ? `Property ${approvalStatus}. ${result.email_status}` : `Property ${approvalStatus}.`);
    } catch (error) {
      setProperties(previous);
      showError(error);
    }
  };

  return (
    <div className="page-shell">
      <Navbar darkMode={darkMode} onOpenSidebar={onOpenSidebar} onToggleTheme={onToggleTheme} session={session} navigate={navigate} logout={logout} />
      <main className="mx-auto max-w-7xl px-4 py-10">
        <section className="panel animate-rise overflow-hidden">
          <div className="bg-brand-navy px-5 py-6 text-white sm:px-6">
            <h1 className="flex items-center gap-2 text-3xl font-extrabold">
              <Crown className="text-red-200" size={30} /> Admin Dashboard
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-white/70">
              <ShieldCheck size={16} /> Manage users, owners, property history and owner property approvals.
            </p>
          </div>

          <div className="grid gap-4 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
            {[
              [users.length, "All Accounts", UsersRound],
              [stats.owners, "Owners", UserRound],
              [stats.pending, "Pending Reviews", Clock3],
              [stats.approved, "Approved Properties", BadgeCheck]
            ].map(([value, label, Icon]) => (
              <article className="rounded-lg bg-white p-4 shadow-soft dark:bg-slate-950" key={label}>
                <Icon className="mb-2 text-brand-red" size={22} />
                <div className="text-2xl font-extrabold">{value}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-6">
          <Message tone={tone}>{message}</Message>
        </div>

        <section className="panel mt-6 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-extrabold">
                <UsersRound size={22} /> User And Owner Details
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                View account roles, contact details and owner property counts.
              </p>
            </div>
            <select className="sm:w-48" value={userFilter} onChange={(event) => setUserFilter(event.target.value)}>
              <option value="all">All accounts</option>
              <option value="user">Users only</option>
              <option value="owner">Owners only</option>
              <option value="admin">Admin only</option>
            </select>
          </div>

          <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredUsers.map((user) => (
              <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900" key={user.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-extrabold text-brand-navy dark:text-white">{user.username}</h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{user.role}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${
                    user.role === "admin"
                      ? "bg-red-50 text-red-700"
                      : user.role === "owner"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-slate-100 text-slate-600"
                  }`}>
                    {user.role}
                  </span>
                </div>

                <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                  <p className="flex items-center gap-2 break-all"><Mail size={15} /> {user.email || "No email added"}</p>
                  <p className="flex items-center gap-2"><Phone size={15} /> {user.contact_number || "No phone added"}</p>
                  <p className="flex items-center gap-2"><Building2 size={15} /> {user.property_count || 0} owner properties</p>
                </div>

                {user.role !== "admin" && (
                  <button className="primary-button mt-4 w-full bg-red-700 hover:bg-red-800" onClick={() => deleteUser(user)} type="button">
                    <Trash2 size={16} /> Delete Account
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="panel mt-6 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-extrabold">
                <History size={22} /> Owner Property History And Verification
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Review all historical owner property records, including active, deactive, pending, approved and rejected.
              </p>
            </div>
            <select className="sm:w-56" value={propertyFilter} onChange={(event) => setPropertyFilter(event.target.value)}>
              <option value="all">All property history</option>
              <option value="pending">Pending approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="active">Active</option>
              <option value="deactive">Deactive</option>
            </select>
          </div>

          {filteredProperties.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No matching owner properties found.
            </div>
          ) : (
            <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredProperties.map((property) => {
                const isActive = (property.status || "active") === "active";
                const approval = property.approval_status || "approved";
                const pinQuery = propertyMapQuery(property);
                const pinLink = property.map_url || (pinQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pinQuery)}` : "");
                return (
                  <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900" key={property.id}>
                    <ImageCarousel images={property.image_urls || []} onZoom={setZoomImage} title={property.house_name || property.address} />

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-extrabold text-brand-navy dark:text-white">{property.house_name || "Owner Property"}</h3>
                        <p className="mt-1 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                          <MapPin size={15} /> {property.address}, {property.city}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                          <Landmark size={15} /> Near {property.nearest_landmark || "not added"}
                        </p>
                        {pinLink && (
                          <a className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-brand-red dark:text-red-300" href={pinLink} rel="noreferrer" target="_blank">
                            <LocateFixed size={15} /> View owner pin
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {isActive ? "Active" : "Deactive"}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${approvalStyles[approval] || approvalStyles.approved}`}>
                        {approval}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <p className="flex items-center gap-2"><Wallet size={15} /> Rs {property.rent}</p>
                      <p className="flex items-center gap-2"><Ruler size={15} /> {property.size || "-"} sqft</p>
                      <p className="flex items-center gap-2"><BedDouble size={15} /> {property.bhk || "-"} BHK</p>
                      <p className="flex items-center gap-2"><Bath size={15} /> {property.bathroom || "-"} Bath</p>
                    </div>

                    <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                      <p className="font-extrabold text-brand-navy dark:text-white">Owner: {property.owner}</p>
                      <p className="flex items-center gap-2 break-all"><Mail size={15} /> {property.contact_email}</p>
                      <p className="flex items-center gap-2"><Phone size={15} /> {property.contact_number}</p>
                    </div>

                    {mapPreviewSrc(property) && (
                      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                        <iframe
                          className="h-44 w-full border-0"
                          loading="lazy"
                          src={mapPreviewSrc(property)}
                          title={`${property.house_name || "Owner property"} map pin`}
                        />
                      </div>
                    )}

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button className="secondary-button min-h-10 px-3 py-2 text-xs" onClick={() => updateApproval(property, "approved")} type="button">
                        <CheckCircle2 size={15} /> Approve
                      </button>
                      <button className="secondary-button min-h-10 px-3 py-2 text-xs" onClick={() => updateApproval(property, "rejected")} type="button">
                        <XCircle size={15} /> Reject
                      </button>
                    </div>
                    <button className="primary-button mt-2 w-full bg-red-700 hover:bg-red-800" onClick={() => deleteProperty(property)} type="button">
                      <Trash2 size={16} /> Delete Property
                    </button>
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
