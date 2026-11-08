// On-device budget planner for the paying phone: "I have $40 and may be stuck 3 days".
// The model only proposes how to split the money across needs; all arithmetic is code.
// It advises: the person always decides, and the escrow rules stay onchain.
import { formatUsd } from "./config.ts";
import { OFFICER_MODEL, loadOfficer, withTimeout } from "./officer.ts";

export const NEEDS = ["water", "food", "transport", "phone_credit"] as const;
export type Need = (typeof NEEDS)[number];
export const NEED_LABEL: Record<Need, string> = { water: "Water", food: "Food", transport: "Transport", phone_credit: "Phone credit" };
export type Weights = Record<Need, number>;
export const DEFAULT_WEIGHTS: Weights = { water: 15, food: 45, transport: 25, phone_credit: 15 };

export type Plan = {
  days: number;
  startedAt: number;
  total: bigint; // what was spendable when the plan was made
  weights: Weights; // percentages, summing to 100
  perDay: Record<Need, bigint>;
  situation: string;
  by: "ai" | "default";
  ms?: number;
};

/** Clamp to whole percentages that add up to exactly 100. Null if nothing usable. */
export function normalizeWeights(raw: Partial<Record<string, unknown>>): Weights | null {
  const vals = NEEDS.map((n) => Math.max(0, Math.round(Number(raw[n]) || 0)));
  const sum = vals.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  const pct = vals.map((v) => Math.floor((v * 100) / sum));
  pct[pct.indexOf(Math.max(...pct))] += 100 - pct.reduce((a, b) => a + b, 0); // remainder to the largest
  return Object.fromEntries(NEEDS.map((n, i) => [n, pct[i]])) as Weights;
}

export function planFor(total: bigint, days: number, weights: Weights, situation: string, by: Plan["by"], ms?: number): Plan {
  const daily = total / BigInt(Math.max(1, days));
  const perDay = Object.fromEntries(NEEDS.map((n) => [n, (daily * BigInt(weights[n])) / 100n])) as Record<Need, bigint>;
  return { days, startedAt: Date.now(), total, weights, perDay, situation, by, ms };
}

/** "This is 40% of today's food budget." or how far over it goes. Advice only. */
export function impactLine(plan: Plan, need: Need, spentToday: bigint, amount: bigint): string {
  const budget = plan.perDay[need];
  const label = NEED_LABEL[need].toLowerCase();
  if (budget <= 0n) return `There's no ${label} money in today's plan.`;
  const after = spentToday + amount;
  if (after > budget) return `This goes ${formatUsd(after - budget)} over today's ${label} budget (${formatUsd(budget)}).`;
  return `This is ${Number((amount * 100n) / budget)}% of today's ${label} budget (${formatUsd(budget - after)} left after it).`;
}

const SCHEMA = JSON.stringify({
  type: "object",
  properties: Object.fromEntries(NEEDS.map((n) => [n, { type: "integer", minimum: 0, maximum: 100 }])),
  required: [...NEEDS],
});

const SYSTEM = `You help a person whose phone payments only work from a pre-paid tab while the network is down.
They tell you their situation. Split each day's money across water, food, transport and phone_credit as percentages that add up to 100.
Put survival first: water and food. Give transport only if they need to move, and phone_credit if they need to reach people. Answer only with JSON.`;

const SHOTS = [
  ["Stuck in a village after a landslide closed the road. Need to call family.", { water: 20, food: 50, transport: 5, phone_credit: 25 }],
  ["Normal week, commute to the market every day.", { water: 10, food: 40, transport: 40, phone_credit: 10 }],
  ["Flood, staying put with two kids.", { water: 30, food: 60, transport: 0, phone_credit: 10 }],
] as const;

export const PLANNER_MODEL = OFFICER_MODEL;

/** Ask the on-device model for weights. Null when it can't answer (then use DEFAULT_WEIGHTS and say so). */
export async function askPlanner(situation: string, days: number): Promise<{ weights: Weights; ms: number } | null> {
  const run = async () => {
    const e = await loadOfficer();
    const started = performance.now();
    const reply = await e.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM },
        ...SHOTS.flatMap(([text, w]) => [
          { role: "user" as const, content: `${text} Days: 3.` },
          { role: "assistant" as const, content: JSON.stringify(w) },
        ]),
        { role: "user", content: `${situation.trim() || "No details."} Days: ${days}.` },
      ],
      temperature: 0,
      max_tokens: 60,
      response_format: { type: "json_object", schema: SCHEMA },
    });
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(reply.choices[0]?.message?.content ?? "");
    } catch {
      return null;
    }
    const weights = normalizeWeights(parsed);
    return weights && { weights, ms: performance.now() - started };
  };
  return withTimeout(run().catch(() => null), 15_000);
}
