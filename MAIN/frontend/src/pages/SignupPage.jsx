import { UserPlus } from "lucide-react";
import { useState } from "react";
import AuthShell from "../components/AuthShell";
import Message from "../components/Message";
import { apiPost } from "../services/api";

export default function SignupPage({ navigate }) {
  const [form, setForm] = useState({
    username: "",
    email: "",
    contact_number: "",
    password: "",
    confirm_password: "",
    role: ""
  });
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("error");

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");

    try {
      const data = await apiPost("/api/signup", form);
      setTone("success");
      setMessage(data.message);
      setTimeout(() => navigate("/login"), 700);
    } catch (error) {
      setTone("error");
      setMessage(error.message || "Signup failed. Please check that the Flask server is running.");
    }
  };

  return (
    <AuthShell
      title="Join Our Platform"
      items={[
        "Search rental properties",
        "Post property as owner",
        "AI-based rent prediction",
        "Smart filters and verified listings",
        "Secure dashboard access",
        "Easy property management",
        "Real-time query notifications"
      ]}
    >
      <section className="panel p-5 sm:p-6">
        <div className="mx-auto mb-4 grid size-14 animate-pulse-ring place-items-center rounded-lg bg-red-50 text-brand-red">
          <UserPlus size={26} />
        </div>
        <h2 className="text-center text-3xl font-extrabold">Create Account</h2>
        <p className="mt-2 text-center text-sm text-slate-500">Signup to continue</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <Message tone={tone}>{message}</Message>
          <div className="animate-rise animate-delay-100">
            <label>Username</label>
            <input required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="animate-rise animate-delay-200">
              <label>Email</label>
              <input
                required={form.role === "owner"}
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </div>
            <div className="animate-rise animate-delay-200">
              <label>Contact Number</label>
              <input
                required={form.role === "owner"}
                value={form.contact_number}
                onChange={(event) => setForm({ ...form, contact_number: event.target.value })}
              />
            </div>
          </div>
          <div className="animate-rise animate-delay-300">
            <label>Password</label>
            <input required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </div>
          <div className="animate-rise animate-delay-400">
            <label>Confirm Password</label>
            <input required type="password" value={form.confirm_password} onChange={(event) => setForm({ ...form, confirm_password: event.target.value })} />
          </div>
          <div className="animate-rise animate-delay-500">
            <label>Select Role</label>
            <select required value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option value="">Choose Role</option>
              <option value="user">For Rent</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          <button className="primary-button animate-rise animate-delay-500 w-full" type="submit"><UserPlus size={18} /> Create Account</button>
        </form>
        <button className="mt-5 w-full text-sm font-bold text-brand-blue" onClick={() => navigate("/login")} type="button">
          Login Here
        </button>
      </section>
    </AuthShell>
  );
}
