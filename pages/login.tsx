"use client";

import { useRouter } from "next/router";
import { useState } from "react";
import toast from "react-hot-toast";

type Role = "STUDENT" | "INSTRUCTOR" | "ADMIN";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("STUDENT");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const identifierLabel =
    role === "STUDENT" ? "Email address or Student ID" : "Email address";
  const identifierPlaceholder =
    role === "STUDENT" ? "Enter email or student ID" : "Enter email";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: identifier,
          password,
          role,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(result.error ?? "Login failed.");
        return;
      }

      const destination =
        result.role === "ADMIN"
          ? "/admin"
          : result.role === "INSTRUCTOR"
            ? "/instructor"
            : "/student";

      await router.push(destination);
      toast.success(`Welcome back, ${result.fullName}.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(107,0,255,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(255,30,30,0.15),_transparent_24%),linear-gradient(180deg,_#fff8fc_0%,_#faf7ff_100%)] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl items-center justify-center">
        <section className="panel w-full rounded-[36px] p-6 sm:p-8">
          <div className="text-center">
            <h1 className="font-heading text-3xl text-slate-950 sm:text-4xl">Sign in to continue</h1>
            <p className="mt-2 text-sm text-slate-600">
              Students use email or student ID. Instructors and admins use email only.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 rounded-[22px] bg-[#f6f0ff] p-2">
            {(["STUDENT", "INSTRUCTOR", "ADMIN"] as Role[]).map((currentRole) => (
              <button
                key={currentRole}
                type="button"
                onClick={() => setRole(currentRole)}
                className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                  role === currentRole
                    ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white shadow-lg"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                {currentRole}
              </button>
            ))}
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">{identifierLabel}</span>
              <input
                type="text"
                required
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 text-slate-950 outline-none focus:border-[#6b00ff] focus:ring-2 focus:ring-[#efe4ff]"
                placeholder={identifierPlaceholder}
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Password</span>
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-[#e8ddff] bg-white px-4 py-3 pr-20 text-slate-950 outline-none focus:border-[#6b00ff] focus:ring-2 focus:ring-[#efe4ff]"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#6b00ff]"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] px-5 py-3.5 font-semibold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Forgot Password? Contact Admins or Instructors.
          </p>
        </section>
      </div>
    </main>
  );
}
