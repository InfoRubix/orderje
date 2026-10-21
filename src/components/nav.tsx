"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChefHat,
  ClipboardList,
  Contact,
  Palette,
  QrCode,
  Scale,
  Settings,
  Store,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import type { Role } from "@/db/schema";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/app", label: "Dashboard", icon: BarChart3, roles: ["owner"] },
  { href: "/app/pos", label: "Counter", icon: Store, roles: ["owner", "cashier"] },
  { href: "/app/kitchen", label: "Kitchen", icon: ChefHat, roles: ["owner", "cashier", "kitchen"] },
  { href: "/app/orders", label: "Orders", icon: ClipboardList, roles: ["owner", "cashier"] },
  { href: "/app/recon", label: "Recon", icon: Scale, roles: ["owner", "cashier"] },
  { href: "/app/brand", label: "Brand & profile", icon: Palette, roles: ["owner"] },
  { href: "/app/menu", label: "Menu", icon: UtensilsCrossed, roles: ["owner"] },
  { href: "/app/tables", label: "Tables & QR", icon: QrCode, roles: ["owner"] },
  { href: "/app/customers", label: "Customers", icon: Contact, roles: ["owner", "cashier"] },
  { href: "/app/staff", label: "Staff", icon: Users, roles: ["owner"] },
  { href: "/app/settings", label: "Settings", icon: Settings, roles: ["owner"] },
] as const;

export function Nav({ role, variant }: { role: Role; variant: "rail" | "bar" }) {
  const path = usePathname();
  const items = ITEMS.filter((i) => (i.roles as readonly Role[]).includes(role));
  const active = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

  if (variant === "bar") {
    return (
      <nav className="no-print flex gap-1 overflow-x-auto border-t border-line bg-surface px-2 py-1.5 md:hidden">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-w-16 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] font-medium",
              active(href) ? "bg-pandan-soft text-pandan-dark" : "text-ink-soft",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="space-y-0.5">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
            active(href) ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
          )}
        >
          <Icon className="size-4.5" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
