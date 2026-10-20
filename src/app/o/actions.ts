"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { declareQrPayment, OrderError, startOnlinePayment } from "@/lib/orders";

export async function payOnline(token: string): Promise<{ error?: string }> {
  let url: string;
  try {
    url = await startOnlinePayment(token);
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    console.error(e);
    return { error: "Online payment is unavailable right now. Pay at the counter." };
  }
  redirect(url);
}

export async function declareQr(token: string): Promise<{ error?: string }> {
  try {
    await declareQrPayment(token);
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/o/${token}`);
  return {};
}
