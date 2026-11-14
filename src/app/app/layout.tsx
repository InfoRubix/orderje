import Link from "next/link";
import { LogOut, MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/(auth)/actions";
import { Nav } from "@/components/nav";
import { Logo } from "@/components/brand";
import { I18nProvider } from "@/components/i18n";
import { OfflineSync } from "@/components/offline-sync";
import { makeT } from "@/lib/i18n";
import { helpMessage, whatsappLink } from "@/lib/support";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, tenant } = await requireUser();
  const t = makeT(tenant.language);
  const help = whatsappLink(helpMessage(tenant, user));
  return (
    <I18nProvider lang={tenant.language}>
      <div className="flex min-h-dvh flex-col md:flex-row">
        <aside className="no-print hidden w-60 shrink-0 flex-col border-r-4 border-tag bg-rail p-4 text-cream md:flex md:sticky md:top-0 md:h-dvh md:overflow-y-auto">
          <Link href="/app" className="px-3 pb-2" aria-label="OrderTerus">
            <Logo tone="cream" className="w-40" />
          </Link>
          <p className="truncate px-3 pb-5 text-sm text-white/60">{tenant.name}</p>
          <Nav role={user.role} variant="rail" />
          <a
            href={help}
            target="_blank"
            rel="noreferrer"
            className="mt-6 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white"
          >
            <MessageCircle className="size-4.5" aria-hidden />
            {t("Help on WhatsApp")}
          </a>
          <div className="mt-auto border-t border-white/10 px-3 pt-4 text-sm">
            <p className="font-medium">{user.name}</p>
            <p className="capitalize text-white/50">{t(user.role)}</p>
            <form action={logout}>
              <button className="mt-3 inline-flex items-center gap-2 text-white/70 hover:text-white">
                <LogOut className="size-4" aria-hidden /> {t("Log out")}
              </button>
            </form>
          </div>
        </aside>
        <header className="no-print flex items-center justify-between border-b-4 border-tag bg-rail px-4 py-3 text-cream md:hidden">
          <div>
            <Logo tone="cream" className="w-32" />
            <p className="text-xs text-white/60">{tenant.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <a href={help} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-white/80">
              <MessageCircle className="size-4" aria-hidden /> {t("Help")}
            </a>
            <form action={logout}>
              <button className="inline-flex items-center gap-1.5 text-sm text-white/80" aria-label={t("Log out")}>
                <LogOut className="size-4" aria-hidden /> {t("Log out")}
              </button>
            </form>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 pb-24 md:p-8">
          {user.role === "kitchen" ? null : <OfflineSync tenantId={tenant.id} />}
          {children}
        </main>
        <div className="fixed inset-x-0 bottom-0 z-30 md:hidden">
          <Nav role={user.role} variant="bar" />
        </div>
      </div>
    </I18nProvider>
  );
}
