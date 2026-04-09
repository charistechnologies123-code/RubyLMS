import Link from "next/link";
import Logo from "@/components/Logo";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(107,0,255,0.14),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(255,30,30,0.12),_transparent_26%),linear-gradient(180deg,_#fff8fc_0%,_#faf7ff_100%)] px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 rounded-[30px] border border-white/70 bg-white/80 px-5 py-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <Logo size={42} />
          <nav className="flex flex-wrap gap-3">
            <Link
              href="/courses"
              className="rounded-2xl border border-[#e7dcff] px-4 py-2 text-sm font-semibold text-[#6b00ff]"
            >
              Explore Courses
            </Link>
            <Link
              href="/login"
              className="rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] px-4 py-2 text-sm font-semibold text-white"
            >
              Sign In
            </Link>
          </nav>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[40px] bg-[#150520] px-6 py-10 text-white shadow-[0_30px_110px_rgba(44,8,84,0.26)] sm:px-10">
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.28em] text-[#f1e2ff]">
              Ruby LMS 1.0
            </div>
            <h1 className="mt-6 max-w-3xl font-heading text-4xl leading-tight sm:text-5xl lg:text-6xl">
              A purposeful learning workspace for Charis Technologies.
            </h1>
            <p className="mt-5 max-w-2xl text-base text-slate-200 sm:text-lg">
              Build momentum across administration, teaching, and learning with a
              clean interface for courses, lessons, assignments, quizzes,
              announcements, Q&amp;A, notifications, and audit-ready activity.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-2xl bg-blue px-5 py-3 font-semibold text-[#140a2d] shadow-sm transition-colors hover:bg-white/90"
              >
                Launch workspace
              </Link>
              <Link
                href="/courses"
                className="rounded-2xl border border-white/20 px-5 py-3 font-semibold text-white"
              >
                Preview catalog
              </Link>
            </div>
          </div>

          <div className="grid gap-5">
            {[
              {
                title: "Admin control",
                copy: "Manage people, enrollments, course publishing, status changes, and audit visibility.",
              },
              {
                title: "Instructor delivery",
                copy: "Create courses, release lessons, post assignments, publish quizzes, and answer student questions.",
              },
              {
                title: "Student progress",
                copy: "Follow learning paths, submit work, track quiz attempts, and stay updated from one dashboard.",
              },
            ].map((item) => (
              <article key={item.title} className="panel rounded-[28px] p-6">
                <h2 className="font-heading text-2xl text-slate-950">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.copy}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
