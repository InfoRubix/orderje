import "server-only";
import { randomUUID } from "crypto";
import { col } from "@/db";
import { OrderError } from "./orders";

/**
 * Logos and menu photos, stored in Firestore as images/{id} (bytes + content type) and served by
 * /img/{id} with a year-long cache, so the CDN answers repeat views instead of Firestore.
 * The browser shrinks images before upload; a Firestore document holds up to 1 MiB.
 */

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 900_000;

/** Checks the declared type and the file's magic bytes; returns the bytes or throws a friendly error. */
async function readImage(file: File) {
  if (!TYPES.has(file.type)) throw new OrderError("Use a JPG, PNG or WebP image.");
  if (file.size > MAX_BYTES) throw new OrderError("That image is too big. Try a smaller photo.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes.subarray(0, 4).toString("hex") === "89504e47";
  const webp = bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (!jpg && !png && !webp) throw new OrderError("That file isn't a readable image.");
  return bytes;
}

/** Saves an image and returns its id (kept to delete it later) and the URL to show it. */
export async function putImage(tenantId: string, file: File, kind: "menu" | "ai-source" = "menu") {
  return putImageBytes(tenantId, await readImage(file), file.type, kind);
}

/** Saves already-checked bytes, e.g. a photo cropped out of a menu poster on the server. */
export async function putImageBytes(tenantId: string, data: Buffer, contentType: string, kind: "menu" | "ai-source" = "menu") {
  if (data.length > MAX_BYTES) throw new OrderError("That image is too big. Try a smaller photo.");
  const id = randomUUID();
  await col.images().doc(id).create({ tenantId, contentType, data, kind, createdAt: new Date() });
  return { path: id, url: `/img/${id}` };
}

/** Reads one of this kedai's images back; undefined if it doesn't exist or belongs to another kedai. */
export async function getImage(tenantId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return undefined;
  const snap = await col.images().doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== tenantId) return undefined;
  return { data: Buffer.from(snap.get("data") as Uint8Array), contentType: String(snap.get("contentType")) };
}

/** Best effort: a leftover image costs almost nothing, a failed save would lose the owner's edit. */
export async function deleteImage(id: string | null | undefined) {
  if (!id) return;
  try {
    await col.images().doc(id).delete();
  } catch (e) {
    console.error("Could not delete image", id, e);
  }
}

export async function deleteImages(ids: (string | null | undefined)[]) {
  await Promise.all(ids.map((id) => deleteImage(id)));
}
