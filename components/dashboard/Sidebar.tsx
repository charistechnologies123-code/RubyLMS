"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { navigation, Role } from "@/lib/navigation";

type Props = {
  role: Role;
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (val: boolean) => void;
};

export default function Sidebar({
  role,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}: Props) {
  const router = useRouter();
  const navItems = navigation[role];

  return (
    <>
      {mobileOpen && (
        <button
          className="fixed inset-0 z-40 bg-slate-950/35 md:hidden"
          aria-label="Close navigation overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full flex-col overflow-y-auto border-r border-white/70 bg-[#12031f] px-3 py-4 text-white shadow-[0_20px_80px_rgba(0,0,0,0.35)] transition-all duration-300 ${
          collapsed ? "w-24" : "w-72"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className={`mb-8 flex items-center ${collapsed ? "justify-center" : "justify-end"}`}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white md:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <div className="mb-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
          <p className="font-heading text-lg text-white">{collapsed ? "RL" : "Ruby LMS 1.0"}</p>
          {!collapsed && (
            <p className="mt-2 text-sm text-slate-300">
              Learning management for admins, instructors, and students.
            </p>
          )}
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto pb-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              router.pathname === item.href || router.pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition ${
                  isActive
                    ? "bg-[linear-gradient(135deg,#6b00ff,#8c3cff)] text-white shadow-lg"
                    : "text-slate-200 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
