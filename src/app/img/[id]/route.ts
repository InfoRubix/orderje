import { col } from "@/db";

/** Serves a logo or menu photo. Ids are random and images never change, so cache for a year. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const snap = await col.images().doc(id).get();
  const data = snap.get("data") as Uint8Array | undefined;
  if (!data) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  return new Response(Buffer.from(data), {
    headers: {
      "Content-Type": String(snap.get("contentType") ?? "image/jpeg"),
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
