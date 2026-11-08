import type { Sent } from "../lib/chain.ts";
import { Doggett } from "./doggett";
import { TxLink } from "./ui";

export type TxState =
  | { s: "idle" }
  | { s: "wallet" }
  | { s: "sending"; what: string }
  | { s: "done"; what: string; sent: Sent }
  | { s: "error"; message: string };

export const lamportsToSol = (l: bigint) => `${(Number(l) / 1e9).toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} SOL`;

/** Transaction state in plain words, with Doggett and an Explorer link. */
export function TxStatus({ state }: { state: TxState }) {
  if (state.s === "idle") return null;
  const pose = state.s === "done" ? "success" : state.s === "error" ? "error" : "waiting";
  return (
    <div role="status" aria-live="polite" className="w-rise flex items-center gap-3 rounded-md bg-sunk px-3 py-2">
      <Doggett pose={pose} size={48} />
      <div className="flex min-w-0 flex-col">
        {state.s === "wallet" && <span>Waiting for your wallet</span>}
        {state.s === "sending" && <span>{state.what}: sending to devnet</span>}
        {state.s === "done" && (
          <>
            <span className="text-ok">
              {state.what}. Confirmed in <span className="mono">{state.sent.seconds.toFixed(1)} s</span>.
            </span>
            <span className="flex flex-wrap gap-x-3 text-sm text-muted">
              <TxLink signature={state.sent.signature}>View on Explorer</TxLink>
              {state.sent.feeLamports !== null && (
                <span>
                  Fee <span className="mono">{lamportsToSol(state.sent.feeLamports)}</span>
                </span>
              )}
            </span>
          </>
        )}
        {state.s === "error" && <span className="text-err">{state.message}</span>}
      </div>
    </div>
  );
}
