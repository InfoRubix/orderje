import { NextResponse } from "next/server";
import { settleOnlinePayment } from "@/lib/orders";

/** ToyyibPay server-to-server callback (form POST). Status is re-verified against the API. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const billCode = String(form?.get("billcode") ?? "");
  if (billCode && String(form?.get("status") ?? "") === "1") await settleOnlinePayment(billCode);
  return new NextResponse("OK");
}
