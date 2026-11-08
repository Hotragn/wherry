// Pure text frames for the ASCII animations (Paper Mono). Tested in tests/ascii-frames.test.ts.

const pad = (s: string, n: number) =>
  s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
const put = (row: string, x: number, s: string) =>
  (x >= row.length
    ? row
    : row.slice(0, Math.max(0, x)) +
      s.slice(Math.max(0, -x)) +
      row.slice(x + s.length)
  ).slice(0, row.length);
const WAVE = "~ ~~  ~~~ ~  ~~ ~~~  ~ ~~";

const BOAT = ["    |\\    ", "    | \\   ", "    |__\\  ", " \\_o__o_/ "];

/** The landing hero: Doggett rows a ticket from the phone's bank to the shop's while the signal drops to nothing. */
export function riverFrame(ms: number, cols = 62) {
  const cycle = 9000;
  const p = (ms % cycle) / cycle;
  const travel = Math.min(1, Math.max(0, (p - 0.08) / 0.78));
  const bars =
    travel < 0.15
      ? "[||||] 4G"
      : travel < 0.28
        ? "[|||.]"
        : travel < 0.38
          ? "[||..]"
          : travel < 0.46
            ? "[|...]"
            : "[....] NO SIGNAL";
  const status =
    travel < 0.46
      ? ""
      : travel < 1
        ? "  that's fine. tickets still work."
        : "  ticket landed. collect later.";
  const rows = Array.from({ length: 10 }, () => " ".repeat(cols));
  rows[0] = pad(` signal ${bars}${status}`, cols);
  rows[4] = put(put(rows[4], 1, "PHONE"), cols - 6, "SHOP");
  rows[5] = put(put(rows[5], 0, "+----+"), cols - 7, "+-----+");
  rows[6] = put(put(rows[6], 0, "|____|"), cols - 7, "|__$__|");
  const x = Math.round(7 + travel * (cols - 31));
  rows[2] = put(rows[2], x + 2, "[No.7 $3.50]");
  BOAT.forEach((line, i) => (rows[3 + i] = put(rows[3 + i], x, line)));
  const shift = Math.floor(ms / 140);
  for (const [r, dir, sparse] of [
    [7, 1, false],
    [8, -1, false],
    [9, 1, true],
  ] as const) {
    let w = "";
    for (let c = 0; c < cols; c++) {
      const ch =
        WAVE[
          (((c + dir * shift * (sparse ? 2 : 1)) % WAVE.length) + WAVE.length) %
            WAVE.length
        ];
      w += sparse && c % 3 ? " " : ch;
    }
    rows[r] = sparse ? w : put(put(w, 0, "######"), cols - 7, "#######");
  }
  return rows.join("\n");
}

/** A ferry ticket printed character by character, like a receipt printer. */
export function ticketLines(serial: string, shop: string, amount: string) {
  const w = 30;
  const row = (s: string) => `| ${pad(s, w - 4)} |`;
  const line = "+" + "=".repeat(w - 2) + "+";
  return [
    line,
    row(`WHERRY FERRY      ${serial}`.slice(0, w - 4)),
    row("ADMIT ONE CROSSING"),
    row(`TO   ${shop}`),
    row(`FARE ${amount}`),
    "+" + "- ".repeat((w - 2) / 2) + "+",
    row("signed on this phone"),
    row("no signal needed"),
    line,
  ].join("\n");
}

export const typed = (text: string, ms: number, cps = 260) => {
  const n = Math.floor((ms / 1000) * cps);
  return text
    .split("")
    .map((ch, i) => (i < n || ch === "\n" ? ch : " "))
    .join("");
};
