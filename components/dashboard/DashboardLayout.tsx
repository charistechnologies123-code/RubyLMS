"use client";

import { useState } from "react";
import type { SessionUser } from "@/lib/auth";
import type { Role } from "@/lib/navigation";
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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(107,0,255,0.16),_transparent_36%),linear-gradient(180deg,_#faf7ff_0%,_#fff8f8_100%)] text-slate-900">
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
  );
}
