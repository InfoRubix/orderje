import { NextResponse } from "next/server";
import { abandonOnlinePayment, settleOnlinePayment } from "@/lib/orders";
import { appUrl } from "@/lib/utils";

/** Customer's browser lands here after the FPX page. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const o = url.searchParams.get("o") ?? "";
  const billCode = url.searchParams.get("billcode") ?? "";
  const status = url.searchParams.get("status_id");
  if (billCode) {
    const r = await settleOnlinePayment(billCode);
    if (!r.ok && status === "3") await abandonOnlinePayment(billCode);
  }
  return NextResponse.redirect(`${appUrl()}/o/${encodeURIComponent(o)}`);
}
