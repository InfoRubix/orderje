/**
 * OrderTerus pricing: everything a kedai needs to take and settle orders is free, with no time
 * limit. Extras are paid add-ons that Rubix switches on per kedai (Rubix admin); prices are
 * discussed on WhatsApp, so none are shown in the app.
 */
export const FREE_FEATURES = [
  "QR menu for every table, plus a takeaway QR",
  "Kitchen screen and calling screen",
  "Counter: pay now, bills, cash and DuitNow QR",
  "Keeps taking counter orders when the internet drops",
  "Member, staff and corporate pricing",
  "Dashboard and end-of-day recon",
  "Unlimited orders, staff logins and tables",
] as const;

export type AddonKey = "supplier_invoices" | "petty_cash";

export const ADDONS: { key: AddonKey; name: string; description: string; ready: boolean }[] = [
  {
    key: "supplier_invoices",
    name: "Supplier invoices",
    description: "Record invoices from your suppliers, what you owe each one and when it's paid.",
    ready: false,
  },
  {
    key: "petty_cash",
    name: "Petty cash",
    description: "Track the kedai's petty cash: daily spending, receipts and the balance in the box.",
    ready: false,
  },
];

export const isAddonKey = (v: unknown): v is AddonKey => ADDONS.some((a) => a.key === v);
