import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { StaffForm, StaffRow } from "./client";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const { user, tenant } = await requireUser(["owner"]);
  const list = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active })
    .from(users)
    .where(eq(users.tenantId, tenant.id))
    .orderBy(asc(users.name));
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Staff"
        sub="Cashiers see the counter, orders and kitchen. Kitchen staff only see the kitchen screen."
      />
      <Card className="mb-6 p-5">
        <h2 className="mb-3 font-display text-lg font-bold">Add staff login</h2>
        <StaffForm />
      </Card>
      <Card className="divide-y divide-line">
        {list.map((u) => (
          <StaffRow key={u.id} u={u} isMe={u.id === user.id} />
        ))}
      </Card>
    </div>
  );
}
