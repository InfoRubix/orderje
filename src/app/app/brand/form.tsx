"use client";

import { useActionState, useEffect, useState } from "react";
import { BRAND_PRESETS, brandStyle } from "@/lib/brand";
import { rm } from "@/lib/money";
import { shrinkImage } from "@/lib/shrink-image";
import { cn } from "@/lib/utils";
import { Button, Card, Field, FormError, Input } from "@/components/ui";
import { ItemThumb, ShopLogo } from "@/components/thumb";
import { keep } from "@/lib/keep-form";
import { saveBrand } from "../actions";

type Brand = {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  receiptFooter: string;
  brandColor: string;
  logoUrl: string | null;
};
type Sample = { id: string; name: string; price: number; imageUrl: string | null };

export function BrandForm({ t, sample }: { t: Brand; sample: Sample[] }) {
  const [b, setB] = useState(t);
  const [logo, setLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(t.logoUrl);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoErr, setLogoErr] = useState<string>();
  const [state, action, pending] = useActionState(saveBrand, undefined);
  const set = (k: keyof Brand) => (e: React.ChangeEvent<HTMLInputElement>) => setB((x) => ({ ...x, [k]: e.target.value }));

  useEffect(
    () => () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    setLogoErr(undefined);
    try {
      const small = await shrinkImage(file, 512);
      setLogo(small);
      setPreview(URL.createObjectURL(small));
      setRemoveLogo(false);
    } catch (e) {
      setLogoErr((e as Error).message);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form
        onSubmit={keep((f) => {
          if (logo) f.set("logo", logo);
          if (removeLogo) f.set("removeLogo", "on");
          action(f);
        })}
        className="space-y-5"
      >
        <Card className="space-y-4 p-5">
          <h2 className="font-display text-lg font-bold">Logo</h2>
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid size-28 place-items-center overflow-hidden rounded-xl border-2 border-edge bg-paper">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Current logo" className="size-full object-contain" />
              ) : (
                <span className="text-sm text-mute">No logo</span>
              )}
            </div>
            <div className="space-y-2">
              <label className="inline-flex h-10 cursor-pointer items-center rounded-md border-2 border-edge bg-surface px-4 text-sm font-semibold hover:bg-paper">
                Upload logo
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label="Upload logo"
                  onChange={(e) => pickLogo(e.target.files?.[0])}
                />
              </label>
              {preview ? (
                <button
                  type="button"
                  className="block text-sm font-semibold text-chili hover:underline"
                  onClick={() => {
                    setLogo(null);
                    setPreview(null);
                    setRemoveLogo(true);
                  }}
                >
                  Remove logo
                </button>
              ) : null}
              <p className="text-xs text-mute">Square works best. We shrink it automatically.</p>
            </div>
          </div>
          <FormError message={logoErr} />
        </Card>

        <Card className="grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="font-display text-lg font-bold sm:col-span-2">Kedai details</h2>
          <Field label="Kedai name" className="sm:col-span-2">
            <Input name="name" value={b.name} onChange={set("name")} maxLength={60} required />
          </Field>
          <Field label="Short description" hint="Shown under your name at the top of the menu" className="sm:col-span-2">
            <Input name="tagline" value={b.tagline} onChange={set("tagline")} maxLength={80} placeholder="e.g. Mamak 24 jam sejak 1998" />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Input name="address" value={b.address} onChange={set("address")} maxLength={160} />
          </Field>
          <Field label="Phone">
            <Input name="phone" value={b.phone} onChange={set("phone")} maxLength={32} inputMode="tel" />
          </Field>
          <Field label="Receipt message" hint="Printed at the bottom of every receipt">
            <Input
              name="receiptFooter"
              value={b.receiptFooter}
              onChange={set("receiptFooter")}
              maxLength={120}
              placeholder="Terima kasih, datang lagi!"
            />
          </Field>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="font-display text-lg font-bold">Brand colour</h2>
          <p className="-mt-2 text-sm text-ink-soft">Used for the menu header, buttons and prices customers see.</p>
          <input type="hidden" name="brandColor" value={b.brandColor} />
          <div className="flex flex-wrap items-center gap-2.5">
            {BRAND_PRESETS.map(([name, hex]) => (
              <button
                key={hex}
                type="button"
                title={name}
                aria-label={name}
                aria-pressed={b.brandColor.toLowerCase() === hex}
                onClick={() => setB((x) => ({ ...x, brandColor: hex }))}
                className={cn(
                  "size-9 rounded-full ring-offset-2 ring-offset-surface",
                  b.brandColor.toLowerCase() === hex ? "ring-2 ring-ink" : "ring-1 ring-line",
                )}
                style={{ background: hex }}
              />
            ))}
            <label className="ml-1 flex items-center gap-2 text-sm text-ink-soft">
              Custom
              <input
                type="color"
                value={b.brandColor}
                onChange={(e) => setB((x) => ({ ...x, brandColor: e.target.value }))}
                className="size-9 cursor-pointer rounded border border-line bg-surface"
                aria-label="Custom brand colour"
              />
            </label>
          </div>
        </Card>

        <div className="sticky bottom-20 flex flex-wrap items-center gap-3 rounded-xl border-2 border-edge bg-surface p-3 md:bottom-4">
          <Button size="lg" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {state?.message ? <span className="text-sm font-semibold text-pandan-dark">{state.message}</span> : null}
          <FormError message={state?.error} />
        </div>
      </form>

      <aside className="space-y-2 lg:sticky lg:top-6">
        <p className="text-sm font-semibold text-ink-soft">Live preview</p>
        <div className="brand overflow-hidden rounded-[28px] border-[6px] border-[#24211d] bg-paper" style={brandStyle(b.brandColor)}>
          <div className="border-b-4 border-edge bg-pandan px-5 pb-5 pt-5 text-on-brand">
            <p className="text-sm opacity-80">You&apos;re at Meja 3</p>
            <div className="mt-1.5 flex items-center gap-3">
              <ShopLogo name={b.name || "?"} src={preview} className="size-12" />
              <p className="min-w-0 font-display text-3xl">{b.name || "Your kedai"}</p>
            </div>
            {b.tagline ? <p className="mt-2 text-sm opacity-90">{b.tagline}</p> : null}
          </div>
          <div className="space-y-3 p-3">
            {sample.length ? (
              <ul className="divide-y-2 divide-line overflow-hidden rounded-xl border-2 border-edge bg-surface">
                {sample.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                    <ItemThumb name={i.name} src={i.imageUrl} className="size-12" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{i.name}</p>
                      <p className="num tag mt-0.5 text-xs">{rm(i.price)}</p>
                    </div>
                    <span className="grid size-7 place-items-center rounded-sm border-2 border-edge font-bold">+</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-line p-4 text-sm text-mute">Add menu items to see them here.</p>
            )}
            <div className="grid h-11 place-items-center rounded-xl bg-cta text-sm font-bold text-on-cta">
              Send order to kitchen
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
