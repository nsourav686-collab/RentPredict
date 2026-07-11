import { Camera, CheckCircle2, Mail, Phone, Save, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Message from "../components/Message";
import Navbar from "../components/Navbar";
import UserAvatar from "../components/UserAvatar";
import { apiGet, apiPut } from "../services/api";

const blankProfile = {
  username: "",
  email: "",
  contact_number: "",
  profile_image: ""
};

function resizeProfileImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = reject;
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const maximumSize = 360;
        const scale = Math.min(1, maximumSize / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage({ darkMode, logout, navigate, onOpenSidebar, onToggleTheme, session, setSession }) {
  const [profile, setProfile] = useState(blankProfile);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("success");
  const [saving, setSaving] = useState(false);
  const imageInput = useRef(null);

  useEffect(() => {
    apiGet("/api/profile")
      .then((data) => setProfile({ ...blankProfile, ...data.user }))
      .catch((error) => {
        setTone("error");
        setMessage(error.message);
      });
  }, []);

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setTone("error");
      setMessage("Please choose an image file for your profile photo.");
      return;
    }

    try {
      const profileImage = await resizeProfileImage(file);
      setProfile((current) => ({ ...current, profile_image: profileImage }));
      setTone("success");
      setMessage("Profile photo ready to save.");
    } catch {
      setTone("error");
      setMessage("We could not read that image. Please try another file.");
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setMessage("");
    setSaving(true);

    try {
      const data = await apiPut("/api/profile", profile);
      setProfile({ ...blankProfile, ...data.user });
      setSession(data.user);
      setTone("success");
      setMessage(data.message || "Your profile has been updated.");
    } catch (error) {
      setTone("error");
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`page-shell ${darkMode ? "dark" : ""}`}>
      <Navbar
        darkMode={darkMode}
        logout={logout}
        navigate={navigate}
        onOpenSidebar={onOpenSidebar}
        onToggleTheme={onToggleTheme}
        session={session}
      />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-16">
        <section className="overflow-hidden rounded-3xl bg-brand-navy p-6 text-white shadow-lift sm:p-9">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-red-200">Account centre</p>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold sm:text-4xl">Edit your profile</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">Keep your contact details and profile photo up to date for a more personal RentPredict experience.</p>
            </div>
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-100">
              <CheckCircle2 size={15} /> Signed in as {session.role || "user"}
            </div>
          </div>
        </section>

        <form className="premium-card mt-6 p-5 sm:p-8" onSubmit={saveProfile}>
          <div className="flex flex-col gap-5 border-b border-slate-200 pb-7 dark:border-slate-800 sm:flex-row sm:items-center">
            <div className="relative w-fit">
              <UserAvatar image={profile.profile_image} name={profile.username} size="lg" />
              <button aria-label="Change profile photo" className="absolute -bottom-2 -right-2 grid size-9 place-items-center rounded-xl bg-brand-red text-white shadow-red transition hover:scale-105" onClick={() => imageInput.current?.click()} type="button">
                <Camera size={16} />
              </button>
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-brand-navy dark:text-white">Profile photo</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Add a clear photo that appears in your dashboard menu. Images are resized automatically.</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button className="secondary-button min-h-9 px-3 py-2" onClick={() => imageInput.current?.click()} type="button"><Camera size={15} /> Upload photo</button>
                {profile.profile_image && <button className="text-sm font-bold text-red-600 transition hover:text-red-700 dark:text-red-300" onClick={() => setProfile((current) => ({ ...current, profile_image: "" }))} type="button">Remove</button>}
              </div>
              <input accept="image/*" className="hidden" onChange={handleImageChange} ref={imageInput} type="file" />
            </div>
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-username">Username</label>
              <div className="relative mt-2"><UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input id="profile-username" maxLength="40" onChange={(event) => setProfile((current) => ({ ...current, username: event.target.value }))} required value={profile.username} /></div>
            </div>
            <div>
              <label htmlFor="profile-email">Email address</label>
              <div className="relative mt-2"><Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input id="profile-email" onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} type="email" value={profile.email} /></div>
            </div>
            <div>
              <label htmlFor="profile-phone">Contact number</label>
              <div className="relative mt-2"><Phone className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input id="profile-phone" maxLength="20" onChange={(event) => setProfile((current) => ({ ...current, contact_number: event.target.value }))} type="tel" value={profile.contact_number} /></div>
            </div>
          </div>

          <Message message={message} tone={tone} />
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button className="secondary-button" onClick={() => navigate("/")} type="button">Cancel</button>
            <button className="primary-button" disabled={saving} type="submit"><Save size={17} /> {saving ? "Saving profile..." : "Save changes"}</button>
          </div>
        </form>
      </main>
    </div>
  );
}
