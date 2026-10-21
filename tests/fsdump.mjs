// Prints every document in the Firestore emulator as JSON: { "<path>": { _id, ...fields } }.
// Timestamps become ISO strings. Used by tests/e2e.py to check what the app wrote.
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("FIRESTORE_EMULATOR_HOST is not set; refusing to read a real database.");
  process.exit(1);
}
initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "demo-orderje" });
const db = getFirestore();

const plain = (v) =>
  v instanceof Timestamp
    ? v.toDate().toISOString()
    : v instanceof Uint8Array
      ? `<${v.length} bytes>`
    : Array.isArray(v)
      ? v.map(plain)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]))
        : v;

const out = {};
async function walk(cols) {
  for (const c of cols) {
    for (const d of (await c.get()).docs) {
      out[d.ref.path] = { _id: d.id, ...plain(d.data()) };
      await walk(await d.ref.listCollections());
    }
  }
}
await walk(await db.listCollections());
process.stdout.write(JSON.stringify(out));
