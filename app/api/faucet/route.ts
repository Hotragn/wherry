// Test-dollar faucet: the only server code. Devnet only.
// Sends a fixed $50 of test USD to an address, plus 0.02 devnet SOL for fees when it has less than 0.01.
import { NextResponse } from "next/server";
import { createClient, createKeyPairSignerFromBytes, isAddress, lamports } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { signer } from "@solana/kit-plugin-signer";
import { getTransferSolInstruction } from "@solana-program/system";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getMintToInstruction,
} from "@solana-program/token";
import { MINT, RPC_URL } from "../../lib/config.ts";

const DRIP_USD = 50_000_000n; // $50.00, fixed server-side
const DRIP_SOL = 20_000_000n; // 0.02 SOL: enough rent and fees for a few tabs
const LOW_SOL = 10_000_000n;
const PER_ADDRESS_MS = 5 * 60_000;
const PER_IP_HOUR = 10;

// shortcut: in-memory limits reset on redeploy and are per server instance; use a shared store (KV) for real traffic.
const lastByAddress = new Map<string, number>();
const hitsByIp = new Map<string, number[]>();

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { address?: unknown } | null;
  const to = typeof body?.address === "string" ? body.address.trim() : "";
  if (!isAddress(to)) {
    return NextResponse.json({ error: "That isn't a Solana address." }, { status: 400 });
  }

  const now = Date.now();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const recent = (hitsByIp.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (now - (lastByAddress.get(to) ?? 0) < PER_ADDRESS_MS) {
    return NextResponse.json({ error: "This address got test dollars in the last 5 minutes. Try again soon." }, { status: 429 });
  }
  if (recent.length >= PER_IP_HOUR) {
    return NextResponse.json({ error: "Too many requests from your network this hour." }, { status: 429 });
  }
  const secret = process.env.FAUCET_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "The faucet isn't set up on this server." }, { status: 503 });

  lastByAddress.set(to, now);
  hitsByIp.set(ip, [...recent, now]);
  try {
    const authority = await createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(secret)));
    const client = createClient().use(signer(authority)).use(solanaRpc({ rpcUrl: RPC_URL }));
    const [ata] = await findAssociatedTokenPda({ mint: MINT, owner: to, tokenProgram: TOKEN_PROGRAM_ADDRESS });
    const sol = (await client.rpc.getBalance(to).send()).value;
    const ixs = [
      await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: authority, mint: MINT, owner: to }),
      getMintToInstruction({ mint: MINT, token: ata, mintAuthority: authority, amount: DRIP_USD }),
      ...(sol < LOW_SOL ? [getTransferSolInstruction({ source: authority, destination: to, amount: lamports(DRIP_SOL) })] : []),
    ];
    const result = await client.sendTransaction(ixs);
    return NextResponse.json({ signature: result.context.signature, usd: "50.00", sol: sol < LOW_SOL ? "0.02" : "0" });
  } catch (e) {
    lastByAddress.delete(to);
    console.error("faucet failed", e);
    return NextResponse.json({ error: "The faucet couldn't send right now. Devnet may be busy; try again in a minute." }, { status: 502 });
  }
}
