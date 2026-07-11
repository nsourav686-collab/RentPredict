import { Chrome, LogIn } from "lucide-react";
import { useState } from "react";
import AuthShell from "../components/AuthShell";
import Message from "../components/Message";
import { apiPost } from "../services/api";

export default function LoginPage({ setSession, navigate }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");

    try {
      const data = await apiPost("/api/login", form);
      setSession(data.user);
      navigate(data.user.role === "admin" ? "/admin" : data.user.role === "owner" ? "/owner" : "/");
    } catch (error) {
      setMessage(error.message || "Login failed. Please check that the Flask server is running.");
    }
  };

  return (
    <AuthShell
      title="Things you can do"
      items={[
        "Post your property for free",
        "Get AI-based rent price prediction",
        "Access verified property listings",
        "Showcase property for rent or sale",
        "Receive queries via phone and email",
        "Track property views and responses",
        "Add detailed property info and photos",
        "Smart search with filters",
        "Owner dashboard access",
        "Secure login and account management"
      ]}
    >
      <section className="panel p-5 sm:p-6">
        <div className="mx-auto mb-4 grid size-14 animate-pulse-ring place-items-center rounded-lg bg-red-50 text-brand-red">
          <LogIn size={26} />
        </div>
        <h2 className="text-center text-3xl font-extrabold">Rent Prediction</h2>
        <p className="mt-2 text-center text-sm text-slate-500">Login to access your account</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <Message>{message}</Message>
          <div className="animate-rise animate-delay-100">
            <label>Username</label>
            <input required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </div>
          <div className="animate-rise animate-delay-200">
            <label>Password</label>
            <input required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </div>
          <button className="primary-button animate-rise animate-delay-300 w-full" type="submit"><LogIn size={18} /> Login</button>
        </form>
        <a className="secondary-button mt-3 w-full" href="/google-login"><Chrome size={18} /> Continue with Google</a>
        <button className="mt-5 w-full text-sm font-bold text-brand-blue" onClick={() => navigate("/signup")} type="button">
          Create Account
        </button>
      </section>
    </AuthShell>
  );
}
