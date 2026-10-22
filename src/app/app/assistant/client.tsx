"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, SendHorizontal, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { shrinkImage } from "@/lib/shrink-image";
import { BrandIcon } from "@/components/brand";
import { Button, Card, FormError, Input, PageHeader, Textarea } from "@/components/ui";
import { useT } from "@/components/i18n";
import { applyDraft, askAssistant, uploadAssistantImage, type Draft, type DraftChange } from "./actions";

type Img = { id: string; url: string };
type Turn = { role: "user" | "assistant"; text: string; images?: Img[] };
type Box = { x: number; y: number; w: number; h: number };

const SUGGESTIONS = [
  "Attach a menu poster and I'll add every item",
  "Add Teh O Ais RM2.50 to the Minuman category",
  "Raise the price of Set B by 50 sen",
  "Mark Roti Telur sold out today",
];

const OP_LABEL = { add: "New", update: "Update", remove: "Remove" } as const;
const OP_TONE = { add: "bg-pandan-soft text-pandan-dark", update: "bg-teh-soft text-teh", remove: "bg-chili-soft text-chili" } as const;

export function Assistant({ categories, left: initialLeft, limit }: { categories: string[]; left: number; limit: number }) {
  const t = useT();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [attached, setAttached] = useState<Img[]>([]);
  const [uploading, setUploading] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [left, setLeft] = useState(initialLeft);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [cropping, setCropping] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [saving, startSave] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Images the assistant can see: every image sent in this conversation, most recent 8.
  const convoImages = [...turns.flatMap((t) => t.images ?? []), ...attached].slice(-8);
  const imageUrl = (id: string) => convoImages.find((i) => i.id === id)?.url ?? `/img/${id}`;

  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollIntoView, which React would treat as a cleanup.
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, busy]);

  async function attach(files: FileList | null) {
    if (!files?.length) return;
    setError(undefined);
    for (const file of Array.from(files).slice(0, 6)) {
      setUploading((n) => n + 1);
      try {
        const small = await shrinkImage(file, 1600);
        const f = new FormData();
        f.set("image", small);
        const r = await uploadAssistantImage(f);
        if ("error" in r && r.error) setError(r.error);
        else if (r.ok) setAttached((a) => [...a, { id: r.id, url: r.url }]);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function send(message = text) {
    if (busy || uploading) return;
    if (!message.trim() && !attached.length) return;
    const userTurn: Turn = { role: "user", text: message.trim(), images: attached };
    const history = turns.map((t) => ({ role: t.role, text: t.text }));
    const imageIds = [...turns.flatMap((t) => t.images ?? []), ...attached].slice(-8).map((i) => i.id);
    setTurns((t) => [...t, userTurn]);
    setText("");
    setAttached([]);
    setError(undefined);
    setSaved(undefined);
    start(async () => {
      try {
        const r = await askAssistant({ history, message: message.trim(), imageIds, draft });
        if ("error" in r && r.error) {
          setError(r.error);
          return;
        }
        if (r.ok) {
          setTurns((t) => [...t, { role: "assistant", text: r.reply }]);
          setDraft(r.draft.changes.length ? r.draft : null);
          setLeft(r.left);
        }
      } catch {
        setError(t("Couldn't reach the server. Check your connection and try again."));
      }
    });
  }

  const update = (key: string, patch: Partial<DraftChange>) =>
    setDraft((d) => d && { ...d, changes: d.changes.map((c) => (c.key === key ? { ...c, ...patch } : c)) });
  const discard = (key: string) =>
    setDraft((d) => {
      if (!d) return d;
      const changes = d.changes.filter((c) => c.key !== key);
      return changes.length ? { ...d, changes } : null;
    });

  function save() {
    if (!draft) return;
    setError(undefined);
    startSave(async () => {
      try {
        const r = await applyDraft(draft);
        if ("error" in r && r.error) setError(r.error);
        else if (r.ok) {
          setSaved(r.message);
          setDraft(null);
          setTurns((ts) => [...ts, { role: "assistant", text: `${r.message} ${t("You can check it on the Menu page.")}` }]);
        }
      } catch {
        setError(t("Couldn't reach the server. Your draft is still here, try saving again."));
      }
    });
  }

  const cropTarget = draft?.changes.find((c) => c.key === cropping);
  const categoryOptions = [...new Set([...categories, ...(draft?.newCategories ?? [])])];

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t("AI Menu")}
        sub={t("Send a poster or a menu list. The AI makes a draft, you check it, then add it to the menu.")}
        actions={
          <span className="rounded-md border-2 border-edge bg-surface px-3 py-2 text-sm font-semibold">
            {t("Left today:")} <span className="num">{left}</span>/{limit}
          </span>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ------------------------------------------------ chat */}
        <Card className="flex min-h-[560px] flex-col overflow-hidden lg:sticky lg:top-6 lg:h-[calc(100dvh-9rem)]">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {turns.length === 0 ? (
              <div className="space-y-4 py-6 text-center">
                <BrandIcon className="mx-auto size-14" />
                <div>
                  <p className="font-display text-2xl">{t("What do you want to change on the menu?")}</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
                    {t("Attach a menu poster or food photos, or type a list. Nothing goes on the menu until you press save.")}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={s}
                      onClick={() => (i === 0 ? fileRef.current?.click() : setText(t(s)))}
                      className="rounded-full border-2 border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink-soft hover:border-edge hover:text-ink"
                    >
                      {t(s)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {turns.map((turn, i) => (
              <div key={i} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] space-y-2 rounded-xl px-3.5 py-2.5 text-sm",
                    turn.role === "user" ? "bg-cta text-on-cta" : "border-2 border-edge bg-paper",
                  )}
                >
                  {turn.images?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {turn.images.map((img) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={img.id} src={img.url} alt={t("Attached image")} className="h-24 rounded-md object-cover" />
                      ))}
                    </div>
                  ) : null}
                  {turn.text ? <p className="whitespace-pre-wrap">{turn.text}</p> : null}
                </div>
              </div>
            ))}
            {busy ? (
              <div className="flex items-center gap-2 text-sm text-ink-soft" role="status">
                <Loader2 className="size-4 animate-spin" aria-hidden />{" "}
                {convoImages.length ? t("Reading the images… this can take up to a minute.") : t("Reading… this can take up to a minute.")}
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="space-y-2 border-t-2 border-edge bg-surface p-3">
            {attached.length || uploading ? (
              <div className="flex flex-wrap gap-2">
                {attached.map((img) => (
                  <span key={img.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={t("Attachment")} className="size-14 rounded-md border-2 border-edge object-cover" />
                    <button
                      onClick={() => setAttached((a) => a.filter((x) => x.id !== img.id))}
                      className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-ink text-on-ink"
                      aria-label={t("Remove attachment")}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {uploading ? (
                  <span className="grid size-14 place-items-center rounded-md border-2 border-dashed border-line" aria-label={t("Uploading")}>
                    <Loader2 className="size-5 animate-spin text-mute" />
                  </span>
                ) : null}
              </div>
            ) : null}
            <FormError message={error} />
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                aria-label={t("Attach image")}
                onChange={(e) => attach(e.target.files)}
              />
              <Button type="button" variant="secondary" size="lg" className="px-3" onClick={() => fileRef.current?.click()} aria-label={t("Attach a poster or photo")}>
                <ImagePlus className="size-5" />
              </Button>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={t("E.g. add everything on this poster to the menu")}
                className="min-h-12 flex-1 resize-none py-3"
                aria-label={t("Message to the AI")}
              />
              <Button size="lg" className="px-4" disabled={busy || !!uploading || (!text.trim() && !attached.length)} aria-label={t("Send")}>
                <SendHorizontal className="size-5" />
              </Button>
            </form>
          </div>
        </Card>

        {/* ------------------------------------------------ draft */}
        <section className="space-y-4" aria-label={t("Draft changes")}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl">{t("Draft")} {draft ? <span className="text-mute">({draft.changes.length})</span> : null}</h2>
            {draft ? (
              <Button size="lg" onClick={save} disabled={saving}>
                {saving ? t("Saving…") : t("Add to menu")}
              </Button>
            ) : null}
          </div>
          {saved ? (
            <p className="rounded-md border-l-4 border-pandan bg-pandan-soft px-3 py-2 text-sm font-semibold text-pandan-dark">
              {saved}{" "}
              <Link href="/app/menu" className="underline">
                {t("Open Menu")}
              </Link>
            </p>
          ) : null}
          {!draft ? (
            <div className="rounded-xl border-2 border-dashed border-line px-6 py-12 text-center text-sm text-ink-soft">
              {t("Your draft will show here once the AI has read your request.")}
            </div>
          ) : (
            <>
              {draft.newCategories.length ? (
                <p className="text-sm text-ink-soft">
                  {t("New categories:")} <b className="text-ink">{draft.newCategories.join(", ")}</b>
                </p>
              ) : null}
              <datalist id="ai-categories">
                {categoryOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {draft.changes.map((c) => (
                <DraftCard
                  key={c.key}
                  c={c}
                  imageUrl={c.photo ? imageUrl(c.photo.imageId) : null}
                  onChange={(p) => update(c.key, p)}
                  onDiscard={() => discard(c.key)}
                  onCrop={() => setCropping(c.key)}
                />
              ))}
              <Button size="lg" className="w-full" onClick={save} disabled={saving}>
                {saving
                  ? t("Saving…")
                  : t(draft.changes.length === 1 ? "Add {n} change to the menu" : "Add {n} changes to the menu", { n: draft.changes.length })}
              </Button>
            </>
          )}
        </section>
      </div>

      {cropTarget?.photo ? (
        <CropEditor
          src={imageUrl(cropTarget.photo.imageId)}
          box={cropTarget.photo.box}
          title={cropTarget.name}
          onClose={() => setCropping(null)}
          onSave={(box) => {
            update(cropTarget.key, { photo: { ...cropTarget.photo!, box } });
            setCropping(null);
          }}
          onRemove={() => {
            update(cropTarget.key, { photo: null });
            setCropping(null);
          }}
        />
      ) : null}
    </div>
  );
}

/** Natural pixel size of an image, so crops keep the photo's real proportions. */
function useImageSize(src: string) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src]);
  return size;
}

/** Shows just the boxed part of the poster (box in 0-1000 of the image), without stretching it. */
function CropPreview({ src, box, className }: { src: string; box: Box; className?: string }) {
  const t = useT();
  const size = useImageSize(src);
  const w = Math.max(box.w, 10);
  const h = Math.max(box.h, 10);
  const ratio = size ? (w * size.w) / (h * size.h) : 1;
  return (
    <span role="img" aria-label={t("Photo cropped from the poster")} className={cn("grid shrink-0 place-items-center overflow-hidden rounded-lg border-2 border-edge bg-paper", className)}>
      {size ? (
        <svg
          viewBox={`${box.x} ${box.y} ${w} ${h}`}
          preserveAspectRatio="none"
          className="max-h-full max-w-full"
          style={{ aspectRatio: String(ratio), width: ratio >= 1 ? "100%" : "auto", height: ratio >= 1 ? "auto" : "100%" }}
        >
          <image href={src} x="0" y="0" width="1000" height="1000" preserveAspectRatio="none" />
        </svg>
      ) : null}
    </span>
  );
}

function DraftCard({
  c,
  imageUrl,
  onChange,
  onDiscard,
  onCrop,
}: {
  c: DraftChange;
  imageUrl: string | null;
  onChange: (p: Partial<DraftChange>) => void;
  onDiscard: () => void;
  onCrop: () => void;
}) {
  const t = useT();
  const removing = c.op === "remove";
  return (
    <Card className={cn("p-4", removing && "opacity-80")}>
      <div className="flex gap-4">
        <div className="shrink-0">
          {imageUrl && c.photo ? (
            <button onClick={onCrop} className="group relative block" aria-label={t("Change photo crop for {name}", { name: c.name })}>
              <CropPreview src={imageUrl} box={c.photo.box} className="size-24" />
              <span className="absolute inset-x-0 bottom-0 rounded-b-lg bg-ink/80 py-0.5 text-center text-[11px] font-semibold text-on-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                {t("Change crop")}
              </span>
            </button>
          ) : (
            <span className="grid size-24 place-items-center rounded-lg border-2 border-dashed border-line text-center text-[11px] text-mute">
              {t("No photo")}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <span className={cn("rounded-sm px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider", OP_TONE[c.op])}>{t(OP_LABEL[c.op])}</span>
            <button onClick={onDiscard} className="rounded-sm p-1 text-mute hover:text-chili" aria-label={t("Discard {name}", { name: c.name })}>
              <Trash2 className="size-4" />
            </button>
          </div>
          {removing ? (
            <p className="font-bold">
              {c.name} <span className="font-normal text-ink-soft">{t("will be removed from the menu")}</span>
            </p>
          ) : (
            <>
              <Input value={c.name} onChange={(e) => onChange({ name: e.target.value })} aria-label={t("Item name")} className="font-semibold" />
              <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
                <label className="relative block">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mute">RM</span>
                  <Input
                    value={c.price}
                    onChange={(e) => onChange({ price: e.target.value })}
                    inputMode="decimal"
                    placeholder={c.op === "update" ? t("same") : "0.00"}
                    aria-label={t("Price")}
                    className={cn("num pl-10", c.op === "add" && !c.price && "border-chili")}
                  />
                </label>
                <Input
                  value={c.category}
                  onChange={(e) => onChange({ category: e.target.value })}
                  list="ai-categories"
                  placeholder={c.op === "update" ? t("same category") : t("Category")}
                  aria-label={t("Category")}
                />
              </div>
              <Textarea
                value={c.description}
                onChange={(e) => onChange({ description: e.target.value })}
                rows={2}
                placeholder={c.op === "update" ? t("same description") : t("Description (optional)")}
                aria-label={t("Description")}
                className="min-h-0"
              />
              {c.groups?.length ? (
                <ul className="space-y-1 text-sm">
                  {c.groups.map((g, gi) => (
                    <li key={gi} className="flex items-start justify-between gap-2 rounded-md bg-paper px-2.5 py-1.5">
                      <span>
                        <b>{g.name}</b>
                        <span className="text-mute">
                          {" "}
                          · {g.required ? t("required") : t("optional")}, {t("pick {n}", { n: g.maxSelect })}
                        </span>
                        <span className="block text-ink-soft">
                          {g.options.map((o) => (o.price ? `${o.name} (+RM${o.price})` : o.name)).join(", ")}
                        </span>
                      </span>
                      <button
                        onClick={() => onChange({ groups: c.groups!.filter((_, i) => i !== gi) })}
                        className="text-mute hover:text-chili"
                        aria-label={t("Remove choice {name}", { name: g.name })}
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {c.op === "update" && c.available !== null ? (
                <p className="text-sm font-semibold">{c.available ? t("Will be marked available again") : t("Will be marked sold out")}</p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Full poster with a box you drag to move and pull by the corner to resize. Coordinates 0-1000. */
function CropEditor({
  src,
  box: initial,
  title,
  onSave,
  onClose,
  onRemove,
}: {
  src: string;
  box: Box;
  title: string;
  onSave: (b: Box) => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [box, setBox] = useState<Box>(initial);
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | "resize"; sx: number; sy: number; start: Box } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onDown(e: React.PointerEvent, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: box };
  }
  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    const el = area.current;
    if (!d || !el) return;
    const r = el.getBoundingClientRect();
    const dx = ((e.clientX - d.sx) / r.width) * 1000;
    const dy = ((e.clientY - d.sy) / r.height) * 1000;
    const s = d.start;
    if (d.mode === "move") {
      setBox({ ...s, x: Math.round(Math.min(1000 - s.w, Math.max(0, s.x + dx))), y: Math.round(Math.min(1000 - s.h, Math.max(0, s.y + dy))) });
    } else {
      setBox({ ...s, w: Math.round(Math.min(1000 - s.x, Math.max(40, s.w + dx))), h: Math.round(Math.min(1000 - s.y, Math.max(40, s.h + dy))) });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal aria-label={t("Crop photo for {name}", { name: title })}>
      <button className="absolute inset-0 bg-black/60" onClick={onClose} aria-label={t("Close")} />
      <div className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-xl border-2 border-edge bg-surface">
        <div className="flex items-center justify-between border-b-2 border-edge px-5 py-3">
          <div>
            <h2 className="font-display text-xl">{t("Crop photo: {name}", { name: title })}</h2>
            <p className="text-sm text-ink-soft">{t("Drag the box to move it. Pull the bottom-right corner to resize.")}</p>
          </div>
          <button onClick={onClose} className="rounded-sm p-1 text-ink-soft hover:bg-paper" aria-label={t("Close")}>
            <X className="size-5" />
          </button>
        </div>
        <div className="flex flex-1 items-start justify-center gap-5 overflow-auto p-4 max-sm:flex-col max-sm:items-center">
          <div ref={area} className="relative w-full max-w-md touch-none select-none" onPointerMove={onMove} onPointerUp={() => (drag.current = null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={t("Poster")} className="block w-full rounded-md" draggable={false} />
            <div
              className="absolute cursor-move border-[3px] border-tag shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]"
              style={{ left: `${box.x / 10}%`, top: `${box.y / 10}%`, width: `${box.w / 10}%`, height: `${box.h / 10}%` }}
              onPointerDown={(e) => onDown(e, "move")}
            >
              <span
                className="absolute -bottom-2.5 -right-2.5 size-5 cursor-nwse-resize rounded-sm border-2 border-white bg-tag"
                onPointerDown={(e) => onDown(e, "resize")}
                aria-hidden
              />
            </div>
          </div>
          <div className="shrink-0 space-y-2 text-center">
            <p className="text-sm font-semibold">{t("Preview")}</p>
            <CropPreview src={src} box={box} className="size-36" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t-2 border-edge px-5 py-3">
          <Button onClick={() => onSave(box)}>{t("Use this crop")}</Button>
          <Button variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button variant="ghost" className="ml-auto text-chili" onClick={onRemove}>
            {t("Use no photo")}
          </Button>
        </div>
      </div>
    </div>
  );
}
