"use client";

import { useState } from "react";
import { formatUsd } from "../lib/config.ts";
import { loadOfficer, officerSupported } from "../lib/officer.ts";
import { DEFAULT_WEIGHTS, NEED_LABEL, NEEDS, PLANNER_MODEL, askPlanner, planFor, type Need, type Plan } from "../lib/planner.ts";
import { Money } from "./ui";

const MODEL_LABEL = PLANNER_MODEL.split("-Instruct")[0].replace(/-/g, " ");

/** "Make it last": an offline budget plan for a stranded week. Advice only; the person always decides. */
export function Planner({
  spendable,
  plan,
  onPlan,
  spentToday,
}: {
  spendable: bigint;
  plan: Plan | null;
  onPlan: (p: Plan) => void;
  spentToday: (n: Need) => bigint;
}) {
  // null = follow whether a plan exists (it loads from IndexedDB after the first render)
  const [editingChoice, setEditing] = useState<boolean | null>(null);
  const editing = editingChoice ?? !plan;
  const [days, setDays] = useState(plan?.days ?? 3);
  const [situation, setSituation] = useState(plan?.situation ?? "");
  const [state, setState] = useState<{ s: "idle" } | { s: "loading"; pct: number } | { s: "thinking" } | { s: "note"; text: string }>({ s: "idle" });

  async function makePlan(useAi: boolean) {
    if (!useAi || !officerSupported()) {
      onPlan(planFor(spendable, days, DEFAULT_WEIGHTS, situation, "default"));
      setState(useAi ? { s: "note", text: "This phone has no WebGPU, so this is the simple plan." } : { s: "idle" });
      return setEditing(false);
    }
    setState({ s: "loading", pct: 0 });
    try {
      await loadOfficer((p) => setState({ s: "loading", pct: p.progress }));
    } catch {
      onPlan(planFor(spendable, days, DEFAULT_WEIGHTS, situation, "default"));
      setState({ s: "note", text: "The AI isn't on this phone yet (its first download needs the network), so this is the simple plan." });
      return setEditing(false);
    }
    setState({ s: "thinking" });
    const answer = await askPlanner(situation, days);
    onPlan(answer ? planFor(spendable, days, answer.weights, situation, "ai", answer.ms) : planFor(spendable, days, DEFAULT_WEIGHTS, situation, "default"));
    setState(answer ? { s: "idle" } : { s: "note", text: "The AI didn't give a usable answer, so this is the simple plan." });
    setEditing(false);
  }

  if (editing) {
    return (
      <section aria-label="Make it last" className="paper flex max-w-xl flex-col gap-3 p-5">
        <h2 className="text-2xl">Make it last</h2>
        <p className="text-sm text-muted">
          Stuck for a while? Plan how <Money units={spendable} /> stretches. The planner runs on this phone and only advises; you decide every payment.
        </p>
        <label className="flex flex-col gap-1">
          <span className="label">It has to last</span>
          <select className="field" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 7, 10, 14].map((d) => (
              <option key={d} value={d}>
                {d} day{d === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="label">Your situation (optional)</span>
          <input
            className="field"
            value={situation}
            maxLength={160}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="Road closed by a landslide, need to call family"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-quiet" disabled={state.s === "loading" || state.s === "thinking"} onClick={() => makePlan(true)}>
            {state.s === "loading" ? `Getting the planner ready: ${Math.round(state.pct * 100)}%` : state.s === "thinking" ? "Planning on this phone…" : "Plan with the AI on this phone"}
          </button>
          <button type="button" className="link text-sm" onClick={() => makePlan(false)}>
            Use a simple plan
          </button>
          {plan && (
            <button type="button" className="link text-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          )}
        </div>
        <p className="text-xs text-muted">The AI downloads once (about 1 GB) and then works with no signal.</p>
      </section>
    );
  }

  if (!plan) return null;
  return (
    <section aria-label="Your budget" className="flex max-w-xl flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl">Today&apos;s budget</h2>
        <button
          type="button"
          className="link text-sm"
          onClick={() => {
            setDays(plan.days);
            setSituation(plan.situation);
            setEditing(true);
          }}
        >
          Re-plan
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {NEEDS.map((n) => {
          const left = plan.perDay[n] - spentToday(n);
          return (
            <li key={n} className="paper flex flex-col gap-1 p-3 shadow-1">
              <span className="label">{NEED_LABEL[n]}</span>
              <Money units={plan.perDay[n]} className="text-xl" />
              <span className={`text-xs ${left < 0n ? "text-err" : "text-muted"}`}>{left < 0n ? `${formatUsd(-left)} over` : `${formatUsd(left)} left today`}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted">
        {plan.days} day{plan.days === 1 ? "" : "s"} from <Money units={plan.total} />.{" "}
        {plan.by === "ai" ? (
          <>
            Split by {MODEL_LABEL} on this phone in <span className="mono">{((plan.ms ?? 0) / 1000).toFixed(1)} s</span>, offline.
          </>
        ) : (
          "Simple plan: water 15%, food 45%, transport 25%, phone credit 15%."
        )}
      </p>
      {state.s === "note" && <p className="text-sm text-warn">{state.text}</p>}
    </section>
  );
}
