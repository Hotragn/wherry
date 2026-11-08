// The AI risk officer: a small language model running on this device (WebLLM on WebGPU).
// After the first download it works with no network. It only ever sees vouchers the rules
// already accepted, and it can only turn an accept into a decline: it tightens, never loosens.
import type { MLCEngineInterface } from "@mlc-ai/web-llm";

export const OFFICER_MODEL = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

export type OfficerFacts = {
  amount: bigint;
  /** Escrow left in the tab before this sale, if the tab is known. */
  coverageLeft?: bigint;
  tabsOpened?: number;
  tabsClosedClean?: number;
  shortfalls?: number;
  vouchersSettled?: number;
  /** Unsettled vouchers from this tab already queued at this shop. */
  waitingFromTab: number;
  /** Minutes since the shop last synced its tab list, if ever. */
  syncAgeMin?: number;
};

export const REASONS = {
  clean_history: "clean payment history",
  small_share: "small share of the tab",
  past_shortfalls: "shortfalls on this payer's record",
  large_share: "too much of the tab in one sale",
  new_payer: "new payer, large amount",
  stale_sync: "tab list too old to trust",
  unverified_tab: "tab not in your list",
  busy_customer: "too many unsettled vouchers from this tab",
} as const;
export type Reason = keyof typeof REASONS;

export type Opinion = { decision: "accept" | "decline"; reason: Reason; line: string; ms: number };

// The model only picks the main reason (constrained to this list); the decision follows from it.
// In our spike, small models picked reasons well but contradicted them when also asked to decide.
const SCHEMA = JSON.stringify({
  type: "object",
  properties: { reason: { type: "string", enum: Object.keys(REASONS) } },
  required: ["reason"],
});
const DECLINE_REASONS = new Set<Reason>(["past_shortfalls", "large_share", "new_payer", "stale_sync", "unverified_tab", "busy_customer"]);

/** Tighten-only: the officer may decline only when the code found at least one warning sign. */
export function verdict(f: OfficerFacts, reason: Reason): Opinion["decision"] {
  return DECLINE_REASONS.has(reason) && warningSigns(f).length > 0 ? "decline" : "accept";
}

const SYSTEM = `You are the risk officer for a small market stall that accepts offline payment vouchers.
The stall's rules already allow this payment. Weigh the warning signs against the payer's record.
Accept when there are no warning signs, or when a long clean record outweighs a small one.
Decline when a warning sign is serious for this payer. Answer with JSON: the main reason.`;

let engine: Promise<MLCEngineInterface> | null = null;

/** Load (first time: download, then from the browser cache) and compile the model. */
export function loadOfficer(onProgress?: (p: { progress: number; text: string }) => void) {
  engine ??= import("@mlc-ai/web-llm").then(({ CreateMLCEngine }) =>
    CreateMLCEngine(OFFICER_MODEL, { initProgressCallback: onProgress }),
  );
  engine.catch(() => (engine = null));
  return engine;
}

export const officerSupported = () => typeof navigator !== "undefined" && "gpu" in navigator;

const pct = (part: bigint, whole: bigint) => (whole > 0n ? Number((part * 100n) / whole) : 100);

/** Soft warning signs the rules only warn about. The officer weighs them; it never sees hard failures. */
export function warningSigns(f: OfficerFacts): string[] {
  const share = f.coverageLeft === undefined ? undefined : pct(f.amount, f.coverageLeft);
  const signs: string[] = [];
  if (f.coverageLeft === undefined) signs.push("tab not in your list");
  if (f.shortfalls) signs.push(`${f.shortfalls} shortfall${f.shortfalls === 1 ? "" : "s"} on record out of ${f.tabsOpened} tabs`);
  if (share !== undefined && share > 50) signs.push(`${share}% of the tab in one sale`);
  if (share !== undefined && share > 25 && f.tabsClosedClean === 0) signs.push(`first tab and ${share}% of it`);
  if (f.syncAgeMin === undefined || f.syncAgeMin > 60) signs.push(f.syncAgeMin === undefined ? "tab list never synced" : `tab list ${f.syncAgeMin} minutes old`);
  if (f.waitingFromTab >= 5) signs.push(`${f.waitingFromTab} unsettled vouchers from this tab`);
  return signs;
}

/** The facts as the model reads them. Numbers are computed here, never by the model. */
export function describe(f: OfficerFacts): string {
  const usd = (u: bigint) => `$${(Number(u) / 1e6).toFixed(2)}`;
  const signs = warningSigns(f);
  return [
    `Payment: ${usd(f.amount)}${f.coverageLeft === undefined ? "" : ` (${pct(f.amount, f.coverageLeft)}% of the tab)`}`,
    f.tabsOpened === undefined
      ? "Payer record: unknown"
      : `Payer record: ${f.tabsClosedClean} tabs closed clean, ${f.vouchersSettled} vouchers paid, ${f.shortfalls} shortfalls`,
    `Warning signs: ${signs.length ? signs.join("; ") : "none"}`,
  ].join("\n");
}

/** The one line the shopkeeper sees: the model's call, explained only with facts computed in code. */
export function officerLine(f: OfficerFacts, decision: Opinion["decision"]): string {
  const history =
    f.tabsOpened === undefined
      ? null
      : f.tabsOpened <= 1
        ? "first tab from this customer"
        : `${f.tabsClosedClean} clean tab${f.tabsClosedClean === 1 ? "" : "s"} before`;
  const facts = [
    f.coverageLeft !== undefined && `${pct(f.amount, f.coverageLeft)}% of this tab`,
    history,
    f.shortfalls ? `${f.shortfalls} shortfall${f.shortfalls === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
  return decision === "accept" ? `Looks fine: ${facts.join(", ")}.` : `Caution: ${warningSigns(f).join("; ")}.`;
}

/** Tighten-only, in one place: the rules decide first; the officer can only turn an accept into a decline.
 *  No answer from the officer (junk, error or timeout) means the rules decide. */
export function finalDecision(
  rules: "accept" | "decline",
  officer: { decision: "accept" | "decline" } | null | undefined,
): { decision: "accept" | "decline"; by: "rules" | "officer" } {
  if (rules === "decline") return { decision: "decline", by: "rules" };
  if (officer?.decision === "decline") return { decision: "decline", by: "officer" };
  return { decision: "accept", by: officer ? "officer" : "rules" };
}

/** The model's raw reply as an opinion, or null if it isn't a reason from the list (then the rules decide). */
export function parseOpinion(content: string | null | undefined, f: OfficerFacts): Omit<Opinion, "ms"> | null {
  let reason: unknown;
  try {
    reason = (JSON.parse(content ?? "") as { reason?: unknown })?.reason;
  } catch {
    return null;
  }
  if (typeof reason !== "string" || !(reason in REASONS)) return null;
  const decision = verdict(f, reason as Reason);
  return { decision, reason: reason as Reason, line: officerLine(f, decision) };
}

export const OFFICER_TIMEOUT_MS = 8_000;

/** Resolve with null if `p` takes longer than `ms`. */
export const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

// Worked examples: small models follow examples far better than written rules.
const base: OfficerFacts = { amount: 3_000_000n, coverageLeft: 40_000_000n, tabsOpened: 6, tabsClosedClean: 5, shortfalls: 0, vouchersSettled: 30, waitingFromTab: 0, syncAgeMin: 10 };
const EXAMPLES: [OfficerFacts, Reason][] = [
  [base, "clean_history"],
  [{ ...base, tabsOpened: 40, tabsClosedClean: 38, shortfalls: 1, vouchersSettled: 150 }, "clean_history"],
  [{ ...base, shortfalls: 2, tabsClosedClean: 3 }, "past_shortfalls"],
  [{ ...base, amount: 30_000_000n }, "large_share"],
  [{ ...base, tabsOpened: 1, tabsClosedClean: 0, vouchersSettled: 0, amount: 12_000_000n }, "new_payer"],
  [{ ...base, syncAgeMin: 180 }, "stale_sync"],
  [{ ...base, tabsOpened: 1, tabsClosedClean: 0, vouchersSettled: 0, amount: 2_000_000n }, "small_share"],
  [{ ...base, waitingFromTab: 7 }, "busy_customer"],
];
const SHOTS = EXAMPLES.flatMap(([f, reason]) => [
  { role: "user" as const, content: describe(f) },
  { role: "assistant" as const, content: JSON.stringify({ reason }) },
]);

/** The officer's opinion, or null when it can't give one (not loaded, junk reply, error, or over the time limit). */
export async function askOfficer(f: OfficerFacts): Promise<Opinion | null> {
  const run = async () => {
    const e = await loadOfficer();
    const started = performance.now();
    const reply = await e.chat.completions.create({
      messages: [{ role: "system", content: SYSTEM }, ...SHOTS, { role: "user", content: describe(f) }],
      temperature: 0,
      max_tokens: 40,
      response_format: { type: "json_object", schema: SCHEMA },
    });
    const opinion = parseOpinion(reply.choices[0]?.message?.content, f);
    return opinion && { ...opinion, ms: performance.now() - started };
  };
  return withTimeout(run().catch(() => null), OFFICER_TIMEOUT_MS);
}
