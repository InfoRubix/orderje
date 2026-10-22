/**
 * Bahasa Melayu dictionary, split by area so each part of the app keeps its own phrases.
 * Keys are the exact English strings used in the code (including {placeholders}).
 *
 * House style: everyday Malaysian Malay as spoken in a kedai, not stiff textbook Malay.
 * Glossary: Order → Pesanan, Counter → Kaunter, Kitchen → Dapur, Dashboard → Papan pemuka,
 * Recon → Rekon, Settings → Tetapan, Staff → Staf, Customers → Pelanggan, Tables → Meja,
 * Paid → Dibayar, Unpaid → Belum bayar, Cash → Tunai, Change → Baki, Sold out → Habis,
 * Dine-in → Makan sini, Takeaway → Bungkus, Delivery → Penghantaran, Member → Ahli,
 * Corporate → Korporat, Walk-in → Walk-in, Service charge → Caj perkhidmatan,
 * Rounding → Pembundaran, Subtotal → Jumlah kecil, Total → Jumlah, Receipt → Resit.
 */
import common from "./common";
import staff from "./staff";
import setup from "./setup";
import customer from "./customer";
import errors from "./errors";

export const MS: Record<string, string> = { ...common, ...staff, ...setup, ...customer, ...errors };
