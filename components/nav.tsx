"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Trophy,
  ListChecks,
  BarChart3,
  User,
  Shield,
  LogOut,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/matches", label: "Matches", icon: ListChecks },
  { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { href: "/profile", label: "My Bets", icon: User },
];

export function Nav({
  username,
  isAdmin,
}: {
  username: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const items = isAdmin
    ? [...LINKS, { href: "/admin", label: "Admin", icon: Shield }]
    : LINKS;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-base/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/matches" className="flex items-center gap-2">
          <Trophy className="text-neon" size={20} />
          <span className="font-display text-lg font-bold tracking-wide">
            BOLÃO LCM <span className="text-neon">2026</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {items.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition",
                  active ? "bg-panel2 text-neon" : "text-mute hover:text-ink",
                )}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
          <span className="mx-1 hidden text-xs text-mute md:inline">
            @{username}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Log out"
              className="flex items-center rounded-lg px-2 py-1.5 text-mute transition hover:text-danger"
            >
              <LogOut size={16} />
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
