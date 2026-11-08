/** "Built with" strip, like a partner bar: hand-drawn glyphs in the brand colours, plain names. Not endorsements. */
const ITEMS: { name: string; note: string; glyph: React.ReactNode }[] = [
  {
    name: "Solana",
    note: "devnet program",
    glyph: (
      <g fill="currentColor">
        <path d="M6 6h14l-3 3H3z" />
        <path d="M3 11h14l3 3H6z" />
        <path d="M6 16h14l-3 3H3z" />
      </g>
    ),
  },
  {
    name: "Anchor",
    note: "escrow + settlement",
    glyph: (
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v13M7 11h10M4 14a8 8 0 0 0 16 0" />
      </g>
    ),
  },
  {
    name: "Ed25519",
    note: "signed offline",
    glyph: (
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="8" cy="12" r="4" />
        <path d="M12 12h9M18 12v3M21 12v2" />
      </g>
    ),
  },
  {
    name: "WebGPU AI",
    note: "risk officer on device",
    glyph: (
      <g fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="6" y="6" width="12" height="12" rx="2" />
        <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" strokeLinecap="round" />
      </g>
    ),
  },
  {
    name: "ggwave",
    note: "pay by sound",
    glyph: (
      <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M4 12h2M8 8v8M12 5v14M16 8v8M20 12h0" />
      </g>
    ),
  },
];

export function BuiltWith() {
  return (
    <section aria-label="Built with" className="mx-auto max-w-page px-4 pb-16 md:px-8">
      <div className="grid overflow-hidden rounded-3xl border border-line sm:grid-cols-[10rem_repeat(5,minmax(0,1fr))]">
        <p className="label flex items-center px-5 py-4 sm:border-r sm:border-line">Built with</p>
        {ITEMS.map((it) => (
          <div key={it.name} className="flex items-center gap-3 border-t border-line px-5 py-4 sm:border-l-0 sm:border-t-0 sm:[&:not(:last-child)]:border-r">
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden className="shrink-0 text-ink">
              {it.glyph}
            </svg>
            <span className="flex flex-col leading-tight">
              <span className="font-semibold">{it.name}</span>
              <span className="text-xs text-muted">{it.note}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
