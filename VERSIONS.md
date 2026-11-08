# VERSIONS: the one pinned set (Wherry, 2026-11-08)

Forked from `kit/nextjs-anchor` (create-solana-dapp 4.8.5, pulled 2026-11-08 03:27 ET).
Every version below was installed and used for a real build, test run or devnet deploy.

## Toolchain
| Tool | Pinned | Notes |
|---|---|---|
| Node | 26.8.1 | Runs the TS tests natively (type stripping, `node --test`) |
| pnpm | 12.8.1 | `pnpm-lock.yaml` is the lockfile |
| Solana / Agave CLI | 3.1.10 | `cargo-build-sbf` 3.1.10, platform-tools v1.52 |
| Anchor CLI | 1.1.2 (avm 1.1.2) | `NO_DNA=1 anchor build` |
| Rust host toolchain | 1.98.1 | `anchor/rust-toolchain.toml` (template said 1.96, not installed here) |
| Surfpool | 1.7.0 | Installed, not used: tests run on LiteSVM |
| Devnet cluster | Agave 4.4.0 | Checked with `solana cluster-version -ud` |

## Program crates (`anchor/programs/wherry`)
| Crate | Pinned |
|---|---|
| anchor-lang | 1.1.2 (`init-if-needed`) |
| anchor-spl | 1.1.2 (`token`, `token_2022`, `associated_token`; `token_2022` only because its IDL build needs it) |
| solana-instructions-sysvar | 3.0.1 |
| solana-sha256-hasher | 3.1.0 |

## JavaScript
| Package | Pinned | Notes |
|---|---|---|
| next | 16.4.3 | from the template |
| react / react-dom | 19.2.3 | from the template |
| @solana/kit | 8.6.0 | template shipped ^6.3.0; see clash 4 |
| @solana/program-client-core | 8.6.0 | needed by the Codama 2.x client |
| @solana/kit-plugin-rpc | 0.23.0 | |
| @solana-program/token | 0.18.0 | |
| @solana-program/system | 0.16.0 | |
| @solana-program/compute-budget | 0.20.0 | |
| codama | 1.11.0 | |
| @codama/renderers-js | 2.8.0 | flat output, `.ts` import extensions, erasable syntax |
| @codama/nodes-from-anchor | 1.5.6 | |
| litesvm (npm) | 1.6.2 | Kit 8 native |
| Wallet | template's wallet-standard layer | `@wallet-standard/app` 1.1, `@solana/wallet-standard-features` ^1.3 |

Not used, on purpose: `@solana/web3.js` (v1 or v3), `@anchor-lang/core`, `@solana/wallet-adapter-*`, `@solana/spl-token`.

## Clashes from knowledge/, resolved against this pin
1. **anchor-cli 1.1.2 installed vs anchor-lang 1.2.x in the docs.** Use 1.1.2 for the CLI, anchor-lang and anchor-spl, as the template does. No 1.2-only features (solana-v4 opt-in).
2. **web3.js v1 vs v3 vs Kit.** Kit 8 only, with the Codama-generated client. Anchor's TS client needs web3.js v1, so we don't use it.
3. **SBPFv3 on devnet.** Feature `BUwGLeF3Lxyfv1J1wY8biFHBB2hrk2QhbNftQf3VV3cC` has no account on devnet, so it's inactive. CLI 3.1.10 builds SBPFv0 (ELF `e_flags` = 0), and that deployed fine.
4. **Kit 6 (template) vs Kit 8 (spec).** litesvm 1.6.2 and @solana-program/* 0.16+ peer on Kit 8, so Kit 8.6.0. The template's deprecated `@solana/kit-client-rpc` goes when the template UI is replaced.
5. **1232-byte legacy tx limit vs a 3-voucher batch.** Each voucher adds a 284-byte inline Ed25519 instruction, and a batch of 3 measures 1,536 bytes. We use **v1 transactions** (SIMD-0385, 4,096 bytes). Feature `txv1aq4pp281K9um3tnPgkfX8UqtFT6wcVW3hNezGLL` is active on devnet (Some(slot 492,480,000)). LiteSVM 1.6.2 runs v1 too.

## Deploy facts (measured)
- `--use-rpc` deploys hit public devnet 429s ("Max retries exceeded"). The default TPU path deployed in 17.5 s.
- Program data rent: 327,800 bytes = 1.666 SOL. A deploy or upgrade needs about 2× that in the wallet for a moment, because of the buffer.
