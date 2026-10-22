import { requireUser } from "@/lib/auth";
import { aiEnabled, quotaLeft, AI_DAILY_LIMIT } from "@/lib/ai";
import { listCategories } from "@/lib/repo";
import { Empty, PageHeader } from "@/components/ui";
import { Assistant } from "./client";

export const metadata = { title: "AI Menu" };
// Reading a poster can take a while; give the server action room before Vercel cuts it off.
export const maxDuration = 120;

export default async function AssistantPage() {
  const { tenant } = await requireUser(["owner"]);
  if (!aiEnabled()) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="AI Menu" />
        <Empty title="AI belum disediakan">Minta Rubix tetapkan OPENAI_API_KEY untuk akaun ini.</Empty>
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
