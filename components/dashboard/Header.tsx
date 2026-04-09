"use client";

import { useEffect, useState } from "react";
import { Bell, LogOut, Menu } from "lucide-react";
import { useRouter } from "next/router";
import type { SessionUser } from "@/lib/auth";
import Logo from "../Logo";

type Props = {
  setMobileOpen: (val: boolean) => void;
  collapsed: boolean;
  session: SessionUser;
};

export default function Header({ setMobileOpen, collapsed, session }: Props) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState(session.avatarUrl ?? null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadHeaderData() {
      const [profileResponse, notificationsResponse] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/notifications"),
      ]);

      if (!active) {
        return;
      }

      if (profileResponse.ok) {
        const profileResult = (await profileResponse.json().catch(() => null)) as
          | { user?: { avatarUrl?: string | null } }
          | null;

        if (profileResult?.user) {
          setAvatarUrl(profileResult.user.avatarUrl ?? null);
        }
      }

      if (notificationsResponse.ok) {
        const notificationsResult = (await notificationsResponse.json().catch(() => null)) as
          | { unreadCount?: number }
          | null;

        setUnreadCount(notificationsResult?.unreadCount ?? 0);
      }
    }

    void loadHeaderData();

    return () => {
      active = false;
    };
  }, [router.asPath, session.avatarUrl]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/60 bg-white/90 px-4 shadow-sm backdrop-blur transition-all md:px-6 ${
        collapsed ? "md:pl-28" : "md:pl-[19rem]"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e7dcff] bg-[#f6f0ff] text-[#6b00ff] md:hidden"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>
        <Logo size={34} />
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={() => router.push("/notifications")}
          className={`relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border text-[#6b00ff] ${
            unreadCount
              ? "border-[#d9c2ff] bg-[#f4edff]"
              : "border-[#f0e9ff] bg-[#faf7ff]"
          }`}
          aria-label={
            unreadCount
              ? `View notifications, ${unreadCount} unread`
              : "View notifications"
          }
        >
          <Bell size={18} />
          {unreadCount ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#ff1e1e] px-1.5 text-[10px] font-bold leading-none text-white shadow-sm">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>
        <div className="hidden text-right md:block">
          <p className="font-heading text-sm text-slate-950">{session.fullName}</p>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{session.role}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#6b00ff,#ff1e1e)] font-heading text-sm text-white shadow-lg">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={`${session.fullName} avatar`} className="h-full w-full object-cover" />
          ) : (
            session.fullName
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")
          )}
        </div>
        <button
          onClick={handleLogout}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#ffe1e1] bg-[#fff4f4] text-[#ff1e1e]"
          aria-label="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
