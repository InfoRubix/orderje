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
export async function putImage(tenantId: string, file: File) {
  const data = await readImage(file);
  const id = randomUUID();
  await col.images().doc(id).create({ tenantId, contentType: file.type, data, createdAt: new Date() });
  return { path: id, url: `/img/${id}` };
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
