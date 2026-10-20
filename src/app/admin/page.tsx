import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, tenants, users } from "@/db/schema";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { fmtDateTime } from "@/lib/time";
import { Badge, Button, PageHeader } from "@/components/ui";

export const metadata = { title: "Rubix admin" };
export const dynamic = "force-dynamic";

async function guard() {
  const s = await getSession();
  if (!s || !isSuperAdmin(s.email)) redirect("/login");
  return s;
}

async function toggleTenant(f: FormData) {
  "use server";
  await guard();
  const id = String(f.get("id"));
  const active = f.get("active") === "true";
  await db.update(tenants).set({ active }).where(eq(tenants.id, id));
  revalidatePath("/admin");
}

export default async function AdminPage() {
  await guard();
  const since = new Date(Date.now() - 30 * 86400000);
  const list = await db
    .select({
      t: tenants,
      orders30: sql<number>`(select count(*) from ${orders} o where o.tenant_id = ${tenants.id} and o.created_at >= ${since})`,
      staff: sql<number>`(select count(*) from ${users} u where u.tenant_id = ${tenants.id})`,
    })
    .from(tenants)
    .orderBy(desc(tenants.createdAt));
  const [{ n }] = await db.select({ n: count() }).from(tenants);

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10">
      <PageHeader title="Kedai on OrderJe" sub={`${n} accounts. Suspending a kedai blocks its logins and QR ordering.`} />
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-line text-left text-ink-soft">
            <tr>
              <th className="px-4 py-2.5 font-medium">Kedai</th>
              <th className="px-4 py-2.5 font-medium">Joined</th>
              <th className="px-4 py-2.5 text-right font-medium">Orders (30d)</th>
              <th className="px-4 py-2.5 text-right font-medium">Logins</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map(({ t, orders30, staff }) => (
              <tr key={t.id}>
                <td className="px-4 py-2.5">
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-ink-soft">
                    /{t.slug} {t.email ? `· ${t.email}` : ""}
                  </p>
                </td>
                <td className="px-4 py-2.5">{fmtDateTime(t.createdAt)}</td>
                <td className="num px-4 py-2.5 text-right">{Number(orders30)}</td>
                <td className="num px-4 py-2.5 text-right">{Number(staff)}</td>
                <td className="px-4 py-2.5">{t.active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Suspended</Badge>}</td>
                <td className="px-4 py-2.5 text-right">
                  <form action={toggleTenant}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="active" value={String(!t.active)} />
                    <Button size="sm" variant={t.active ? "ghost" : "primary"}>
                      {t.active ? "Suspend" : "Reactivate"}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
