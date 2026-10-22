"use client";

import { useEffect } from "react";
import { Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui";
import { useT } from "@/components/i18n";

export function ReceiptActions({ autoPrint, shareText }: { autoPrint: boolean; shareText: string }) {
  const t = useT();
  useEffect(() => {
    if (autoPrint) setTimeout(() => window.print(), 300);
  }, [autoPrint]);
  return (
    <div className="no-print mx-auto mb-4 flex w-[80mm] max-w-full gap-2 px-1">
      <Button variant="secondary" className="flex-1" onClick={() => window.print()}>
        <Printer className="size-4" aria-hidden /> {t("Print")}
      </Button>
      <a
        className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-pandan px-4 text-sm font-semibold text-on-brand"
        href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noreferrer"
      >
        <Share2 className="size-4" aria-hidden /> WhatsApp
      </a>
    </div>
  );
}
