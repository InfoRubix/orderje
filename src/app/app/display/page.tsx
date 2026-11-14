import { requireUser } from "@/lib/auth";
import { CallingBoard } from "./board";

export const metadata = { title: "Calling screen" };

export default async function DisplayPage() {
  const { tenant } = await requireUser(["owner", "cashier", "kitchen"]);
  return <CallingBoard shop={tenant.name} />;
}
