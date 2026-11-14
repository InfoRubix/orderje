import { CheckCircle2, MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { makeT } from "@/lib/i18n";
import { ADDONS, FREE_FEATURES } from "@/lib/plans";
import { whatsappLink } from "@/lib/support";
import { cn } from "@/lib/utils";
import { Badge, buttonVariants, Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Plan" };

export default async function PlanPage() {
  const { tenant } = await requireUser(["owner"]);
  const t = makeT(tenant.language);
  const on = new Set(tenant.addons ?? []);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={t("Plan")} sub={t("What your kedai gets, and the extras you can add.")} />

      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">{t("Free")}</h2>
          <Badge tone="green">{t("Your plan")}</Badge>
        </div>
        <p className="mt-1 text-ink-soft">{t("No time limit and no card needed. Use it as long as you like.")}</p>
        <ul className="mt-4 space-y-2">
          {FREE_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-pandan" aria-hidden />
              <span>{t(f)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">{t("Add-ons")}</h2>
        <p className="text-sm text-ink-soft">{t("Paid extras, switched on by Rubix. WhatsApp us for the price.")}</p>
        {ADDONS.map((a) => {
          const active = on.has(a.key);
          const ask = active
            ? `Hi Rubix, ${tenant.name} (OrderTerus: ${tenant.slug}). Soalan tentang add-on ${a.name}: `
            : a.ready
              ? `Hi Rubix, ${tenant.name} (OrderTerus: ${tenant.slug}) berminat dengan add-on ${a.name}. Berapa harganya?`
              : `Hi Rubix, ${tenant.name} (OrderTerus: ${tenant.slug}) berminat dengan add-on ${a.name}. Beritahu saya bila ia sedia.`;
          return (
            <Card key={a.key} className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{t(a.name)}</h3>
                  {active ? <Badge tone="green">{t("Active")}</Badge> : a.ready ? null : <Badge tone="amber">{t("Coming soon")}</Badge>}
                </div>
                <p className="mt-1 text-sm text-ink-soft">{t(a.description)}</p>
              </div>
              <a
                href={whatsappLink(ask)}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: active ? "ghost" : "secondary" }))}
              >
                <MessageCircle className="size-4" aria-hidden />
                {active ? t("Ask Rubix") : a.ready ? t("Ask for the price") : t("Tell me when it's ready")}
              </a>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
