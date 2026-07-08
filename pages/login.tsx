"use client";

import Image from "next/image";
import Link from "next/link";
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
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.2fr_minmax(0,0.8fr)]">
        <section className="rounded-[36px] border border-white/70 bg-[#16051f] px-6 py-10 text-white shadow-[0_30px_100px_rgba(47,7,89,0.26)] sm:px-8 md:px-10">
          <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.26em] text-[#f4e8ff]">
            Charis Technologies
          </div>
          <h1 className="mt-6 font-heading text-4xl leading-tight sm:text-5xl">
            Ruby LMS that feels focused, modern, and ready for real classrooms.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-200 sm:text-lg">
            Manage courses, track progress, publish assignments, run quizzes, and
            keep students engaged with announcements, notifications, and Q&amp;A.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="font-heading text-2xl text-[#caa7ff]">3</p>
              <p className="mt-2 text-sm text-slate-200">Role-based experiences</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="font-heading text-2xl text-[#ff9e9e]">MVP</p>
              <p className="mt-2 text-sm text-slate-200">Courses, lessons, quizzes, grading</p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="font-heading text-2xl text-white">100%</p>
              <p className="mt-2 text-sm text-slate-200">Responsive dashboard shell</p>
            </div>
          </div>
        </section>

        <section className="panel rounded-[36px] p-6 sm:p-8 lg:justify-self-end lg:max-w-[520px]">
          <div className="flex justify-center">
            <Image src="/logo.svg" alt="Ruby LMS logo" width={220} height={147} style={{ height: "auto" }} priority />
          </div>
          <div className="mt-6 text-center">
            <h2 className="font-heading text-3xl text-slate-950">Sign in to continue</h2>
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
                placeholder={role === "STUDENT" ? "Enter email or student ID" : "Enter email"}
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
            Need the course catalog first?{" "}
            <Link href="/courses" className="font-semibold text-[#6b00ff] hover:underline">
              Browse courses
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
