// Pay by sound: the phone plays its voucher as ggwave audio, the shop's mic decodes it. Fully offline.
// A voucher code is 196 bytes; ggwave carries at most 140 per message. We drop the mint (the shop knows it,
// and a voucher for another mint fails the signature check anyway) and send the other 164 bytes as two
// messages, each led by one header byte. QR and paste stay as fallbacks.
import { getAddressEncoder } from "@solana/kit";
import { decodeVoucher, fromBase64Url, toBase64Url } from "./codes.ts";
import { MINT } from "./config.ts";

const HALF = 82;
const HEAD = 0xa0; // header byte: 0xa0 = first half, 0xa1 = second half

/** Split a WV1 voucher code into the two sound messages. */
export function soundChunks(code: string): Uint8Array[] {
  const b = fromBase64Url(code.trim().slice(4));
  if (!b || b.length !== 196) throw new Error("not a voucher code");
  const body = new Uint8Array([...b.subarray(0, 64), ...b.subarray(96)]); // 164 bytes, no mint
  return [0, 1].map((i) => Uint8Array.of(HEAD + i, ...body.subarray(i * HALF, (i + 1) * HALF)));
}

/** Collects heard messages; returns the WV1 code once both halves are in and it decodes, else null. */
export function chunkJoiner() {
  const halves: (Uint8Array | null)[] = [null, null];
  return (msg: Uint8Array): string | null => {
    const i = msg[0] - HEAD;
    if ((i !== 0 && i !== 1) || msg.length !== HALF + 1) return null;
    halves[i] = msg.slice(1);
    if (!halves[0] || !halves[1]) return null;
    const body = new Uint8Array([...halves[0], ...halves[1]]);
    const full = new Uint8Array([...body.subarray(0, 64), ...getAddressEncoder().encode(MINT), ...body.subarray(64)]);
    const code = `WV1.${toBase64Url(full)}`;
    return decodeVoucher(code) ? code : null;
  };
}

type Gg = {
  getDefaultParameters(): { sampleRateInp: number; sampleRateOut: number };
  init(p: object): number;
  encode(inst: number, data: Uint8Array, protocol: unknown, volume: number): Int8Array;
  decode(inst: number, data: Int8Array): Int8Array;
  free(inst: number): void;
  disableLog(): void;
  ProtocolId: Record<string, unknown>;
};

let lib: Promise<Gg> | null = null;
// ggwave holds only a few instances at once: every caller frees its own in a finally.
async function ggwave(rate: number): Promise<{ g: Gg; inst: number }> {
  lib ??= import("ggwave").then(async (m) => {
    const g: Gg = await (m.default as () => Promise<Gg>)();
    g.disableLog();
    return g;
  });
  const g = await lib;
  const p = g.getDefaultParameters();
  p.sampleRateInp = rate;
  p.sampleRateOut = rate;
  return { g, inst: g.init(p) };
}

/** Play the voucher out loud. Resolves with the playing time in seconds when it has finished. */
export async function playVoucher(code: string): Promise<number> {
  const ctx = new AudioContext();
  let gg: { g: Gg; inst: number } | null = null;
  try {
    gg = await ggwave(ctx.sampleRate);
    const { g, inst } = gg;
    const gap = new Float32Array(Math.round(ctx.sampleRate * 0.4));
    // encode() returns a view into wasm memory (float32 samples as bytes): copy before the next call.
    const parts = soundChunks(code).map((c) => new Float32Array(g.encode(inst, c, g.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST, 25).slice().buffer));
    const all = new Float32Array(parts[0].length + gap.length + parts[1].length);
    all.set(parts[0], 0);
    all.set(parts[1], parts[0].length + gap.length);
    const buf = ctx.createBuffer(1, all.length, ctx.sampleRate);
    buf.getChannelData(0).set(all);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    await new Promise<void>((done) => ((src.onended = () => done()), src.start()));
    return buf.duration;
  } finally {
    if (gg) gg.g.free(gg.inst);
    await ctx.close();
  }
}

/**
 * Listen on the mic until a whole voucher is heard. Asks for the mic only when called (the Listen tap).
 * onLevel gets the input level 0..1 for the meter. Rejects on abort or if the mic is refused.
 */
export async function listenForVoucher(onLevel: (level: number) => void, signal: AbortSignal): Promise<{ code: string; seconds: number }> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const ctx = new AudioContext();
  const started = performance.now();
  let gg: { g: Gg; inst: number } | null = null;
  try {
    gg = await ggwave(ctx.sampleRate);
    const { g, inst } = gg;
    const join = chunkJoiner();
    const source = ctx.createMediaStreamSource(stream);
    // shortcut: ScriptProcessorNode is deprecated but needs no worklet file; move to an AudioWorklet if browsers drop it.
    const proc = ctx.createScriptProcessor(1024, 1, 1);
    source.connect(proc);
    proc.connect(ctx.destination); // outputs silence; Chrome only runs the callback when connected
    return await new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("stopped", "AbortError")), { once: true });
      proc.onaudioprocess = (e) => {
        const x = e.inputBuffer.getChannelData(0);
        let sum = 0;
        for (const s of x) sum += s * s;
        onLevel(Math.min(1, Math.sqrt(sum / x.length) * 4));
        const heard = g.decode(inst, new Int8Array(x.slice().buffer));
        if (heard.length > 0) {
          const code = join(new Uint8Array(heard)); // copy: heard is a view into wasm memory
          if (code) resolve({ code, seconds: (performance.now() - started) / 1000 });
        }
      };
    });
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    await ctx.close(); // stops onaudioprocess before the instance goes
    if (gg) gg.g.free(gg.inst);
  }
}
