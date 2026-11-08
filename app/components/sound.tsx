"use client";

import { useRef, useState } from "react";
import { listenForVoucher, playVoucher } from "../lib/sound.ts";
import { Doggett } from "./doggett";

// Fetch the ggwave chunk as soon as the Phone or Shop page loads (online), so the service worker has it for offline use.
if (typeof window !== "undefined") import("ggwave").catch(() => {});

/** Phone: play the voucher out loud for the shop's Listen button. */
export function PlaySound({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "playing" | "done" | "failed">("idle");
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        className="btn btn-quiet"
        disabled={state === "playing"}
        onClick={async () => {
          setState("playing");
          try {
            await playVoucher(code);
            setState("done");
          } catch {
            setState("failed");
          }
        }}
      >
        {state === "playing" ? "Playing… hold the phone near the shop" : state === "done" ? "Play the sound again" : "Pay by sound"}
      </button>
      <span className="text-sm text-muted" aria-live="polite">
        {state === "failed" ? "This phone couldn't play it. Show the QR instead." : "Works best in a quiet room. About 12 s of chirps; the shop taps Listen first. The QR is quicker."}
      </span>
    </div>
  );
}

/** Shop: listen on the mic for a voucher. Asks for the mic only when tapped. */
export function ListenButton({ onCode }: { onCode: (code: string, seconds: number) => void }) {
  const [state, setState] = useState<{ s: "idle" | "listening" | "heard" | "failed"; note?: string }>({ s: "idle" });
  const [level, setLevel] = useState(0);
  const stop = useRef<AbortController | null>(null);

  async function listen() {
    stop.current = new AbortController();
    const timer = setTimeout(() => stop.current?.abort(), 45_000);
    setState({ s: "listening" });
    try {
      const { code, seconds } = await listenForVoucher(setLevel, stop.current.signal);
      setState({ s: "heard", note: `Heard it in ${seconds.toFixed(1)} s.` });
      onCode(code, seconds);
    } catch (e) {
      const denied = e instanceof DOMException && e.name === "NotAllowedError";
      const stopped = e instanceof DOMException && e.name === "AbortError";
      setState({ s: "failed", note: denied ? "No microphone access. Scan the QR or paste the code." : stopped ? "Didn't catch a voucher. Try again, or scan the QR." : "Listening failed here. Scan the QR or paste the code." });
    } finally {
      clearTimeout(timer);
      setLevel(0);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {state.s === "listening" ? (
        <>
          <button type="button" className="btn btn-quiet" onClick={() => stop.current?.abort()}>
            Stop listening
          </button>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-sunk" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
            <div className="h-full bg-ok transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
          <span className="text-sm text-muted">Listening… play the sound on the phone.</span>
        </>
      ) : (
        <button type="button" className="btn btn-quiet" onClick={listen}>
          Listen for a voucher (works best in a quiet room)
        </button>
      )}
      {(state.s === "heard" || state.s === "failed") && (
        <span className="flex items-center gap-2 text-sm" aria-live="polite">
          <Doggett pose={state.s === "heard" ? "success" : "error"} size={36} />
          {state.note}
        </span>
      )}
    </div>
  );
}
