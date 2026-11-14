import "server-only";

/**
 * Rubix's WhatsApp for kedai owners who need help or want an add-on. Set SUPPORT_WHATSAPP
 * (any format, e.g. 011-5551 5937 or 601155515937) to change it; Malaysian numbers starting
 * with 0 get the 60 country code.
 */
export function supportNumber() {
  const digits = (process.env.SUPPORT_WHATSAPP || "601155515937").replace(/\D/g, "");
  return digits.startsWith("0") ? `6${digits}` : digits;
}

/** wa.me link that opens WhatsApp with the message already typed. */
export function whatsappLink(text: string) {
  return `https://wa.me/${supportNumber()}?text=${encodeURIComponent(text)}`;
}

/** The opening line for a kedai asking Rubix for help, so support knows which account it is. */
export function helpMessage(shop: { name: string; slug: string }, user?: { name: string }) {
  return `Hi Rubix, ${user ? `saya ${user.name} dari ` : ""}${shop.name} (OrderTerus: ${shop.slug}). Saya perlukan bantuan: `;
}
