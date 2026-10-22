import { requireUser } from "@/lib/auth";
import { makeT } from "@/lib/i18n";
import { aiEnabled, quotaLeft, AI_DAILY_LIMIT } from "@/lib/ai";
import { listCategories } from "@/lib/repo";
import { Empty, PageHeader } from "@/components/ui";
import { Assistant } from "./client";

export const metadata = { title: "AI Menu" };
// Reading a poster can take a while; give the server action room before Vercel cuts it off.
export const maxDuration = 120;

export default async function AssistantPage() {
  const { tenant } = await requireUser(["owner"]);
  const t = makeT(tenant.language);
  if (!aiEnabled()) {
    return (
      <div className="max-w-3xl">
        <PageHeader title={t("AI Menu")} />
        <Empty title={t("AI isn't set up yet")}>{t("Ask Rubix to set OPENAI_API_KEY for this account.")}</Empty>
      </div>
    );
  }
  const [cats, left] = await Promise.all([listCategories(tenant.id), quotaLeft(tenant.id)]);
  return (
    <Assistant
      categories={cats.map((c) => c.name)}
      left={left}
      limit={AI_DAILY_LIMIT}
    />
  );
}
