import "server-only";
import { randomUUID } from "crypto";
import { getStorage } from "firebase-admin/storage";
import { firebaseApp } from "@/db";
import { OrderError } from "./orders";

/**
 * Logos and menu photos in Cloud Storage. The browser shrinks images before upload, so files
 * are small. Each file gets a Firebase download token, so its URL works for anyone who has it
 * while storage.rules still blocks listing and every other client access.
 */

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 1_500_000;

function bucket() {
  return getStorage(firebaseApp()).bucket();
}

function downloadUrl(bucketName: string, path: string, tokenValue: string) {
  const emu = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const host = emu ? `http://${emu.replace(/^https?:\/\//, "")}` : "https://firebasestorage.googleapis.com";
  return `${host}/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${tokenValue}`;
}

/** Checks the declared type and the file's magic bytes; returns the bytes or throws a friendly error. */
async function readImage(file: File) {
  if (!TYPES[file.type]) throw new OrderError("Use a JPG, PNG or WebP image.");
  if (file.size > MAX_BYTES) throw new OrderError("That image is too big. Try a smaller photo.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes.subarray(0, 4).toString("hex") === "89504e47";
  const webp = bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (!jpg && !png && !webp) throw new OrderError("That file isn't a readable image.");
  return bytes;
}

export async function putImage(tenantId: string, folder: "logo" | "items", file: File) {
  const bytes = await readImage(file);
  const b = bucket();
  const path = `tenants/${tenantId}/${folder}/${randomUUID()}.${TYPES[file.type]}`;
  const tokenValue = randomUUID();
  await b.file(path).save(bytes, {
    resumable: false,
    contentType: file.type,
    metadata: {
      cacheControl: "public, max-age=31536000, immutable",
      metadata: { firebaseStorageDownloadTokens: tokenValue },
    },
  });
  return { path, url: downloadUrl(b.name, path, tokenValue) };
}

/** Best effort: a leftover file costs almost nothing, a failed save would lose the owner's edit. */
export async function deleteImage(path: string | null | undefined) {
  if (!path) return;
  try {
    await bucket().file(path).delete({ ignoreNotFound: true });
  } catch (e) {
    console.error("Could not delete", path, e);
  }
}

/** Removes every file a kedai uploaded under a folder, e.g. when the whole menu is cleared. */
export async function deleteImages(paths: (string | null | undefined)[]) {
  await Promise.all(paths.map((p) => deleteImage(p)));
}
