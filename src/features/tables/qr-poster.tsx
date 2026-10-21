"use client";

import { useEffect, useState } from "react";
import { cn } from "@/core/lib/cn";
import {
  ensurePosterFonts, posterContact, posterDisplayUrl, posterHeadline, posterHint, posterKicker, posterWelcome, qrSvg, type QrPoster,
} from "./qr";

const serif = { fontFamily: "'Fraunces', Georgia, 'Times New Roman', serif" };

/** Vista previa del cartel: mismo diseño que la impresión y el PNG. */
export function QrPosterPreview({ poster, className }: { poster: QrPoster; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    void ensurePosterFonts();
    void qrSvg(poster.url).then((s) => alive && setSvg(s));
    return () => { alive = false; };
  }, [poster.url]);

  const contact = posterContact(poster);
  const welcome = posterWelcome(poster);

  return (
    <div className={cn("w-full max-w-[300px] rounded-[1.6rem] border-2 border-[#121212] bg-white px-6 pb-5 pt-6 text-center text-[#121212] shadow-sm", className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#b9532a]">{posterKicker(poster)}</p>
      {poster.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster.logoUrl} alt="" className="mx-auto mt-2.5 size-11 rounded-xl object-cover" />
      )}
      <p className="mt-2 break-words text-[22px] font-bold leading-tight" style={serif}>{poster.business}</p>
      {contact && <p className="mt-1 text-[11px] text-[#555]">{contact}</p>}
      {poster.table && <p className="mt-2.5 inline-block rounded-full bg-[#121212] px-3 py-0.5 text-xs font-bold text-white">{poster.table}</p>}
      <div className="mx-auto mb-3 mt-4 aspect-square w-[68%] [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} role="img"
        aria-label={`Código QR de ${poster.table ?? "la carta"}`} />
      <p className="text-[16px] font-semibold" style={serif}>{posterHeadline(poster)}</p>
      {welcome && <p className="mt-1 text-[10.5px] text-[#333]">{welcome}</p>}
      <p className="mt-1 text-[10px] text-[#555]">{posterHint}</p>
      <p className="mt-3 break-all text-[9px] text-[#777]">{posterDisplayUrl(poster.url)}</p>
    </div>
  );
}
