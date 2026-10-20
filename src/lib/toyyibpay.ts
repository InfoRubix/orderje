import "server-only";
import type { Tenant } from "@/db/schema";

/**
 * ToyyibPay (FPX) integration. Each kedai uses its own ToyyibPay account, so money
 * settles straight to the owner's bank, never through Rubix.
 * Docs: https://toyyibpay.com/apireference/
 */
function base(t: Pick<Tenant, "toyyibpaySandbox">) {
  return t.toyyibpaySandbox ? "https://dev.toyyibpay.com" : "https://toyyibpay.com";
}

export function toyyibpayReady(t: Tenant) {
  return Boolean(t.toyyibpaySecret && t.toyyibpayCategory);
}

export async function createBill(
  t: Tenant,
  args: {
    amountSen: number;
    billName: string;
    description: string;
    externalRef: string;
    returnUrl: string;
    callbackUrl: string;
    payorName?: string | null;
    payorPhone?: string | null;
  },
) {
  const body = new URLSearchParams({
    userSecretKey: t.toyyibpaySecret ?? "",
    categoryCode: t.toyyibpayCategory ?? "",
    billName: args.billName.slice(0, 30),
    billDescription: args.description.slice(0, 100),
    billPriceSetting: "1",
    billPayorInfo: "0",
    billAmount: String(args.amountSen),
    billReturnUrl: args.returnUrl,
    billCallbackUrl: args.callbackUrl,
    billExternalReferenceNo: args.externalRef,
    billTo: args.payorName || t.name,
    billEmail: t.email || "noreply@orderje.my",
    billPhone: args.payorPhone || t.phone || "0123456789",
    billPaymentChannel: "0",
    billChargeToCustomer: "",
    billExpiryDays: "1",
  });
  const res = await fetch(`${base(t)}/index.php/api/createBill`, { method: "POST", body, cache: "no-store" });
  const text = await res.text();
  let code: string | undefined;
  try {
    code = JSON.parse(text)?.[0]?.BillCode;
  } catch {
    /* ToyyibPay returns plain text on error */
  }
  if (!code) throw new Error(`ToyyibPay did not create the bill: ${text.slice(0, 200)}`);
  return { billCode: code as string, paymentUrl: `${base(t)}/${code}` };
}

/** Server-side check of a bill: never trust the callback body alone. */
export async function isBillPaid(t: Tenant, billCode: string, expectedSen: number) {
  const body = new URLSearchParams({ billCode, billpaymentStatus: "1" });
  const res = await fetch(`${base(t)}/index.php/api/getBillTransactions`, { method: "POST", body, cache: "no-store" });
  const text = await res.text();
  try {
    const rows = JSON.parse(text) as { billpaymentStatus?: string; billpaymentAmount?: string; billpaymentInvoiceNo?: string }[];
    const hit = Array.isArray(rows)
      ? rows.find((r) => r.billpaymentStatus === "1" && Math.round(Number(r.billpaymentAmount) * 100) === expectedSen)
      : undefined;
    return hit ? { paid: true as const, reference: hit.billpaymentInvoiceNo ?? billCode } : { paid: false as const };
  } catch {
    return { paid: false as const };
  }
}
