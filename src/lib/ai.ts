import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { col, fs } from "@/db";
import type { Tenant } from "@/db/schema";
import { loadMenu, OrderError } from "./orders";
import { getImage } from "./images";
import { myDate } from "./time";

/**
 * The menu assistant: the owner chats, attaches a poster or food photos, and the model proposes
 * menu changes. It never writes to the menu itself; the owner reviews the draft and applies it.
 * Provider: OpenAI Responses API with structured outputs (model from OPENAI_MODEL).
 */

export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-6.1-sol";
export const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 30);
/** OPENAI_API_KEY=mock returns a canned proposal, for tests and demos without spending tokens. */
const MOCK = process.env.OPENAI_API_KEY === "mock";

export function aiEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

const Box = z.object({
  x: z.number().int().describe("left edge, 0-1000 of image width"),
  y: z.number().int().describe("top edge, 0-1000 of image height"),
  w: z.number().int().describe("width, 0-1000 of image width"),
  h: z.number().int().describe("height, 0-1000 of image height"),
});

const Proposal = z.object({
  reply: z.string().describe("Short message to the owner, in the language they wrote in"),
  new_categories: z.array(z.string()).describe("Categories to create that don't exist yet"),
  changes: z
    .array(
      z.object({
        op: z.enum(["add", "update", "remove"]),
        item_id: z.string().nullable().describe("Existing item id for update/remove, null for add"),
        name: z.string(),
        price: z.number().nullable().describe("Price in RM, e.g. 12.9. null if unreadable or unchanged"),
        description: z.string().nullable(),
        category: z.string().nullable().describe("Category name, existing or from new_categories"),
        available: z.boolean().nullable().describe("false to mark sold out, null to leave as is"),
        addon_groups: z
          .array(
            z.object({
              name: z.string(),
              required: z.boolean(),
              max_select: z.number().int(),
              options: z.array(z.object({ name: z.string(), extra_price: z.number() })),
            }),
          )
          .nullable()
          .describe("Full list of add-on/choice groups; null to leave unchanged"),
        photo: z
          .object({ image: z.number().int().describe("index into the attached images, 0-based"), box: Box })
          .nullable()
          .describe("Where this item's food photo is; null if none"),
      }),
    )
    .describe("The complete pending draft after this message, not just what changed this turn"),
});
export type ProposalT = z.infer<typeof Proposal>;

const SYSTEM = `You help the owner of a Malaysian kedai makan (restaurant) manage their menu in OrderTerus, a QR-ordering and POS system.

What you can do: propose menu changes. The owner reviews every change in a draft and applies it themselves, so never say anything was saved or is live.

Reading posters and photos:
- Extract each dish, set or drink with its exact name as printed, price in RM, and a short description of what comes with it (e.g. "Nasi, ayam goreng, sambal, timun, kobis").
- Only use prices you can actually read. If a price is unclear, set price to null and say which ones in your reply. Never guess a price.
- Choices inside a set become addon_groups: e.g. "Ayam: Original / Crispy" is a required group with max_select 1; "Air percuma: Teh O Ais / Sirap" likewise; paid extras ("Tambah telur +RM1.50") are an optional group with extra_price.
- For each item that has its own food photo on an attached image, give photo.image (0-based index of the attached images) and photo.box in a 0-1000 coordinate space of that image (0,0 top-left; 1000,1000 bottom-right). Box the food photo only, not the price or text. If a separate photo of the dish was attached, use that image with box {x:0,y:0,w:1000,h:1000}.
- Group items into sensible categories (e.g. "Set Ayam Gepuk", "Minuman", "Add-on"). Reuse an existing category when it fits; put genuinely new ones in new_categories.

Editing the existing menu:
- To change an item, use op "update" with its item_id from the current menu, and fill only what changes (null for fields that stay the same, except name which is always the item's name).
- To remove an item use op "remove". Prefer available:false ("sold out") when the owner only means today.

The draft:
- You receive the current pending draft (if any). Return the complete pending draft after this turn: keep earlier changes unless the owner asks to drop or change them.
- If the owner is only chatting or asking a question, answer it and return the draft unchanged.

Reply briefly and plainly, in the owner's language (usually Malay), e.g. "Saya jumpa 6 menu dalam poster. Harga Set C tak jelas, sila semak."`;

export type ChatTurn = { role: "user" | "assistant"; text: string };

/** Counts today's requests for the kedai and refuses once the daily limit is reached. */
async function takeQuota(tenantId: string) {
  const ref = col.of(tenantId, "aiUsage").doc(myDate());
  return fs().runTransaction(async (tx) => {
    const used = Number((await tx.get(ref)).get("count") ?? 0);
    if (used >= AI_DAILY_LIMIT)
      throw new OrderError("Today's AI limit is used up ({n} requests). Try again tomorrow.", { n: AI_DAILY_LIMIT });
    tx.set(ref, { count: used + 1, updatedAt: new Date() }, { merge: true });
    return AI_DAILY_LIMIT - used - 1;
  });
}

export async function quotaLeft(tenantId: string) {
  const snap = await col.of(tenantId, "aiUsage").doc(myDate()).get();
  return Math.max(0, AI_DAILY_LIMIT - Number(snap.get("count") ?? 0));
}

async function menuContext(tenantId: string) {
  const menu = await loadMenu(tenantId, { includeUnavailable: true });
  if (!menu.length) return "The menu is empty.";
  return menu
    .map(
      (c) =>
        `Category "${c.name}":\n` +
        (c.items.length
          ? c.items
              .map(
                (i) =>
                  `- id ${i.id} | ${i.name} | RM ${(i.price / 100).toFixed(2)}${i.available ? "" : " | SOLD OUT"}` +
                  (i.groups.length ? ` | add-ons: ${i.groups.map((g) => `${g.name} [${g.options.map((o) => o.name).join(", ")}]`).join("; ")}` : ""),
              )
              .join("\n")
          : "- (no items)"),
    )
    .join("\n");
}

export async function askMenuAssistant(args: {
  tenant: Tenant;
  history: ChatTurn[];
  message: string;
  imageIds: string[];
  draft: unknown;
}): Promise<{ proposal: ProposalT; left: number }> {
  if (!aiEnabled()) throw new OrderError("AI isn't set up yet. Ask Rubix to set OPENAI_API_KEY.");
  const left = await takeQuota(args.tenant.id);

  const images = (await Promise.all(args.imageIds.map((id) => getImage(args.tenant.id, id)))).map((img, i) => {
    if (!img) throw new OrderError("An attached image couldn't be found. Attach it again.");
    return { i, img };
  });

  if (MOCK) return { proposal: mockProposal(args.message, images.length), left };

  const client = new OpenAI();
  const context =
    `Kedai: ${args.tenant.name}\n\nCURRENT MENU\n${await menuContext(args.tenant.id)}\n\n` +
    `CURRENT PENDING DRAFT\n${args.draft ? JSON.stringify(args.draft) : "(none)"}\n\n` +
    `ATTACHED IMAGES: ${images.length ? images.map(({ i }) => `image ${i}`).join(", ") : "none"}`;

  try {
    const response = await client.responses.parse({
      model: AI_MODEL,
      reasoning: { effort: "medium" },
      input: [
        { role: "system", content: SYSTEM },
        ...args.history.slice(-12).map((t) => ({ role: t.role, content: t.text })),
        {
          role: "user",
          content: [
            { type: "input_text", text: context },
            ...images.map(({ img }) => ({
              type: "input_image" as const,
              image_url: `data:${img.contentType};base64,${img.data.toString("base64")}`,
              detail: "high" as const,
            })),
            { type: "input_text", text: args.message || "(no text, see the attached images)" },
          ],
        },
      ],
      text: { format: zodTextFormat(Proposal, "menu_proposal") },
    });
    const proposal = response.output_parsed;
    if (!proposal) throw new OrderError("The AI couldn't handle this request. Try different wording or another image.");
    return { proposal, left };
  } catch (e) {
    if (e instanceof OrderError) throw e;
    if (e instanceof OpenAI.RateLimitError) throw new OrderError("The AI is busy right now. Try again in a minute.");
    if (e instanceof OpenAI.AuthenticationError) throw new OrderError("The OpenAI key is invalid. Ask Rubix to check OPENAI_API_KEY.");
    if (e instanceof OpenAI.APIError) {
      console.error("OpenAI error", e.status, e.message);
      throw new OrderError("Can't reach the AI right now. Try again shortly.");
    }
    throw e;
  }
}

/** Deterministic answer for OPENAI_API_KEY=mock: two set meals from the first image, one drink. */
function mockProposal(message: string, imageCount: number): ProposalT {
  const photo = (i: number, box: { x: number; y: number; w: number; h: number }) => (imageCount ? { image: 0, box } : null);
  return {
    reply: `Saya jumpa 3 menu${imageCount ? " dalam poster" : ""}. Sila semak harga sebelum masukkan.`,
    new_categories: ["Set Ayam Gepuk"],
    changes: [
      {
        op: "add",
        item_id: null,
        name: "Set A Simple Tapi Padu",
        price: 12,
        description: "Ayam original, sambal gepuk, timun, kobis",
        category: "Set Ayam Gepuk",
        available: null,
        addon_groups: [{ name: "Ayam", required: true, max_select: 1, options: [{ name: "Original", extra_price: 0 }, { name: "Crispy", extra_price: 1 }] }],
        photo: photo(0, { x: 40, y: 120, w: 420, h: 360 }),
      },
      {
        op: "add",
        item_id: null,
        name: "Set B Kenyang Puas",
        price: message.includes("15") ? 15 : 14,
        description: "Ayam, sambal, tauhu, tempe, timun, kobis",
        category: "Set Ayam Gepuk",
        available: null,
        addon_groups: null,
        photo: photo(0, { x: 520, y: 120, w: 420, h: 360 }),
      },
      {
        op: "add",
        item_id: null,
        name: "Teh O Ais",
        price: 2.5,
        description: null,
        category: "Minuman",
        available: null,
        addon_groups: null,
        photo: null,
      },
    ],
  };
}
