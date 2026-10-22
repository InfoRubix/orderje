import { applicationDefault, cert, getApps, initializeApp, type App, type AppOptions } from "firebase-admin/app";
import {
  getFirestore,
  Timestamp,
  type DocumentSnapshot,
  type Firestore,
  type QuerySnapshot,
} from "firebase-admin/firestore";

/**
 * Server-side Firestore (Admin SDK). The browser never talks to Firestore directly:
 * firestore.rules denies all client access and every read/write goes through server code.
 *
 * Credentials, in order:
 *  - FIRESTORE_EMULATOR_HOST set: local emulator, no credentials needed.
 *  - FIREBASE_SERVICE_ACCOUNT: service-account JSON (raw or base64). This is how Vercel connects.
 *  - Otherwise Application Default Credentials (gcloud auth application-default login, or Google Cloud hosting).
 */
function appOptions(): AppOptions {
  let projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  let opts: AppOptions;
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    projectId ||= "demo-orderje";
    opts = { projectId };
  } else {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
    if (sa) {
      const json = JSON.parse(sa.startsWith("{") ? sa : Buffer.from(sa, "base64").toString("utf8"));
      projectId ||= json.project_id;
      opts = { credential: cert(json), projectId };
    } else opts = { credential: applicationDefault(), projectId };
  }
  return opts;
}

export function firebaseApp(): App {
  return getApps()[0] ?? initializeApp(appOptions());
}

const globalForDb = globalThis as unknown as { firestore?: Firestore };

export function fs(): Firestore {
  if (globalForDb.firestore) return globalForDb.firestore;
  const store = getFirestore(firebaseApp());
  // REST instead of gRPC: much faster cold starts on serverless (Vercel functions).
  // The emulator only works over gRPC without credentials, so keep gRPC there.
  store.settings({ ignoreUndefinedProperties: true, preferRest: !process.env.FIRESTORE_EMULATOR_HOST });
  globalForDb.firestore = store;
  return store;
}

export type TenantSub = "categories" | "menuItems" | "tables" | "customers" | "orders" | "payments" | "reconciliations" | "aiUsage";

export const col = {
  tenants: () => fs().collection("tenants"),
  users: () => fs().collection("users"),
  slugs: () => fs().collection("slugs"),
  emails: () => fs().collection("emails"),
  orderTokens: () => fs().collection("orderTokens"),
  /** Logos and menu photos (bytes), served by /img/{id}. */
  images: () => fs().collection("images"),
  /** A collection that belongs to one kedai, e.g. tenants/{id}/orders. */
  of: (tenantId: string, name: TenantSub) => fs().collection("tenants").doc(tenantId).collection(name),
};

/** Firestore Timestamps back to JS Dates, recursively. */
function revive(v: unknown): unknown {
  if (v instanceof Timestamp) return v.toDate();
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype)
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)]));
  return v;
}

export function read<T>(snap: DocumentSnapshot): T | undefined {
  if (!snap.exists) return undefined;
  return { ...(revive(snap.data()) as object), id: snap.id } as T;
}

export function readAll<T>(qs: QuerySnapshot): T[] {
  return qs.docs.map((d) => read<T>(d)!);
}

/** Drops `id` so it isn't duplicated inside the document body. */
export function body<T extends { id?: string }>(row: T): Omit<T, "id"> {
  const { id: _id, ...rest } = row;
  void _id;
  return rest;
}

export function isAlreadyExists(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === 6;
}
