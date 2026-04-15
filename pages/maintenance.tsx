import type { GetServerSidePropsContext } from "next";

export async function getServerSideProps(_ctx: GetServerSidePropsContext) {
  if (process.env.MAINTENANCE_MODE !== "true") {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
}

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(107,0,255,0.16),_transparent_36%),linear-gradient(180deg,_#faf7ff_0%,_#fff8f8_100%)] px-6 py-12 text-slate-900">
      <div className="mx-auto flex min-h-[80vh] max-w-3xl items-center justify-center">
        <section className="w-full rounded-[36px] border border-white/70 bg-white/90 p-8 shadow-[0_24px_80px_rgba(74,15,144,0.12)] backdrop-blur md:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6b00ff]">
            RubyLMS Maintenance
          </p>
          <h1 className="mt-4 font-heading text-4xl text-slate-950 md:text-5xl">
            We are carrying out scheduled maintenance.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
            RubyLMS is temporarily unavailable while we improve the platform. Please check back shortly.
          </p>
          <div className="mt-8 rounded-[28px] border border-[#efe6ff] bg-[#faf7ff] p-5">
            <p className="text-sm font-semibold text-slate-950">What this means</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Learners, instructors, and regular users will be redirected here while maintenance mode is enabled.
              Administrators can still access the platform through the configured admin bypass.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
