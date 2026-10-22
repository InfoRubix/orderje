import { listUsers } from "@/lib/repo";
import { requireUser } from "@/lib/auth";
import { makeT } from "@/lib/i18n";
import { Card, PageHeader } from "@/components/ui";
import { StaffForm, StaffRow } from "./client";

export const metadata = { title: "Staff" };

export default async function StaffPage() {
  const { user, tenant } = await requireUser(["owner"]);
  const t = makeT(tenant.language);
  const list = (await listUsers(tenant.id)).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active }));
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={t("Staff")}
        sub={t("Cashiers see the counter, orders and kitchen. Kitchen staff only see the kitchen screen.")}
      />
      <Card className="mb-6 p-5">
        <h2 className="mb-3 font-display text-lg font-bold">{t("Add staff login")}</h2>
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
