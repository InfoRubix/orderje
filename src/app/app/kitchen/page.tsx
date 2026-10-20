import { requireUser } from "@/lib/auth";
import { KitchenBoard } from "./board";

export const metadata = { title: "Kitchen" };

export default async function KitchenPage() {
  const { user } = await requireUser(["owner", "cashier", "kitchen"]);
  return <KitchenBoard canCancel={user.role !== "kitchen"} />;
}
