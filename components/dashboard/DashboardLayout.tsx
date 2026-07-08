"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import type { SessionUser } from "@/lib/auth";
import type { Role } from "@/lib/navigation";
import ConfirmDialogProvider from "@/components/ui/ConfirmDialogProvider";
import Header from "./Header";
import Sidebar from "./Sidebar";

type DashboardLayoutProps = {
  children: React.ReactNode;
  role: Role;
  session: SessionUser;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
};

export default function DashboardLayout({
  children,
  role,
  session,
  title,
  description,
  actions,
}: DashboardLayoutProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    const handleStart = () => setRouteLoading(true);
    const handleDone = () => setRouteLoading(false);

    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleDone);
    router.events.on("routeChangeError", handleDone);

    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleDone);
      router.events.off("routeChangeError", handleDone);
    };
  }, [router.events]);

  return (
    <ConfirmDialogProvider>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(107,0,255,0.16),_transparent_36%),linear-gradient(180deg,_#faf7ff_0%,_#fff8f8_100%)] text-slate-900">
        {routeLoading && !router.pathname.startsWith("/chat") ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-md">
            <div className="flex flex-col items-center gap-5 rounded-[28px] border border-[#e8ddff] bg-white px-8 py-7 shadow-[0_20px_80px_rgba(74,15,144,0.16)]">
              <img
                src="/logo.svg"
                alt="Ruby LMS"
                className="h-20 w-auto drop-shadow-[0_10px_24px_rgba(107,0,255,0.12)]"
              />
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 animate-bounce rounded-full bg-[#6b00ff]/80 [animation-delay:-0.2s]" />
                <span className="h-3 w-3 animate-bounce rounded-full bg-[#8c3cff]/80 [animation-delay:-0.1s]" />
                <span className="h-3 w-3 animate-bounce rounded-full bg-[#ff6b6b]/80" />
              </div>
            </div>
          </div>
        ) : null}
        <Sidebar
          role={role}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />
        <Header
          collapsed={collapsed}
          session={session}
          setMobileOpen={setMobileOpen}
        />
        <main
          className={`min-h-screen px-4 pb-12 pt-20 transition-all md:px-8 ${
            collapsed ? "md:ml-24" : "md:ml-72"
          }`}
        >
          {(title || description || actions) && (
            <section className="mb-6 flex flex-col gap-4 rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_60px_rgba(74,15,144,0.08)] backdrop-blur md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                {title && <p className="font-heading text-3xl text-slate-950">{title}</p>}
                {description && (
                  <p className="max-w-2xl text-sm text-slate-600 md:text-base">{description}</p>
                )}
              </div>
              {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
            </section>
          )}
          {children}
        </main>
      </div>
    </ConfirmDialogProvider>
  );
}
