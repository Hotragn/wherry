# STATUS: Wherry build

| Milestone | Target (ET) | Status | Time done | Proof | Cuts |
|---|---|---|---|---|---|
| Before M1 (fork, VERSIONS.md, deploy test) | 04:05 | done | 03:41 | Program deployed to devnet, tx `2KiK68LmAH9kSKmrivJsTqA4XjNH6GmLN7wwfkCN76vdLxjZ6hU34dWXZedYXcmbNXjHBrZuxws61HRURzjvXVxd` | none |
| M1 program on devnet + TS test | 05:00 | done | 03:45 | 16/16 LiteSVM TS tests pass; batch of 3 settled on devnet in one v1 tx (below) | none |
| M2 core flow e2e from UI | 06:45 | done | 04:12 | From the UI on devnet: open tab `5U9crhh5…`, 3 vouchers settled in one v1 tx `3GWbVawE…` (0.93 s), risk circuit trip, offline shell; screenshots in the shared notes folder `build-m2-screens/` | none |
| M3 AI officer + Gaming | 07:45 | done | 04:44 | AI officer (Qwen2.5-1.5B, WebLLM/WebGPU) in the Shop accept flow, 1.2–1.7 s per voucher, loads from cache with 0 network requests; game: commit `2r7CnF68…`, power-up settled in `BVMGtkkQ…`, reveal `2nrbnoD4…`, drop proven; screenshots in `build-m3-screens/` | none |
| M4 polish | 08:15 | done | 05:07 | 375 px pass (no overflow on 6 pages), a11y scan clean, guided path, README, branded 404/error; prod-build rehearsal: open `3beWsDgC…`, 3-voucher settle `5dwbbrL6…` (0.8 s), reveal `59iQvt8c…`; screenshots `build-m4-screens-375/`, `build-m4-rehearsal/` | none |
| FREEZE | 08:30 | | | | |
| Initial submission | <10:00 | | | | |
| Final submission | <11:00 | | | | |

Brand gate: BRAND APPROVED received 03:47. All colours come from design/tokens.css (Tailwind default palette switched off).

## Devnet
- Program ID: `7QcwJ8Jwj4W74Ypq58U5jgBrxwHDvxquGwic2xzPr4MM` (upgrade authority = deployer `J3ogqwY8pDhqrKtnkxmi6iSzcsVDs9BXfdS1a9ZhFc8A`)
- Test-USD mint (6 decimals): `DQRut6HQcdzu1bpKFzYRCPYfW1u7MCHso2EVGK6tuFs`; mint authority key in `keys/test-usd-authority.json` (for the faucet)
- Demo shop key: `FQPHfnsmMhKfw4UzLiECcAkAJrKNMFAmqiANvwbJYNcw` (`keys/demo-shop.json`)
- Deployer balance after M1: 3.30 SOL

## Real devnet transactions (`pnpm devnet-proof`)
| Step | Signature | Confirmed | Fee |
|---|---|---|---|
| Deploy program | `2KiK68LmAH9kSKmrivJsTqA4XjNH6GmLN7wwfkCN76vdLxjZ6hU34dWXZedYXcmbNXjHBrZuxws61HRURzjvXVxd` | finalized | |
| Create test-USD mint | `5qnf1jUu2QB5o6dGyaGQx119cKp1xoVSwAXsTUCwdbszRsSoTK2EZt1rMEfyvgPyRzvcrgSXrvLFKh2MKNLgsAiX` | 0.8 s | 10,000 |
| Open tab #0 ($40) | `2a131ogmseL2GCumC1Ua7bT6ezBMCkjyKyoQKMXvosWQyfggDqifFfBMPqbfdvvzccPUCuAwmzR1fwok2mY7hdZu` | 1.0 s | 5,000 |
| Settle 3 vouchers, one tx | `UsGT2YNAeCVuzE1AhtdhEjjLePtJnjHqecV3DUPcvzmTDqaFeuNXtJ35nz7an2o3K9wheiwzTUh7tRkH3XjZ11k` | 0.8 s | 20,000 |
| Open tab #1 ($40) | `zdUw3YLFKEs7ZKNTyuftnJF7PA6HtDUgNawA6Mq22p9WnKsRsHoL4UKoojNKW9ggc3CvV6JXT6525pn1NgZ4cTd` | 0.8 s | 5,000 |
| Settle 3 vouchers, one tx (v1, 66,564 CU) | `2BjZVw7XWS2TsdwmS7ASSrwCZXY9bVex8nKnBeJcXsKnBamknwVYPAqDgErwEJCk2xF3dVxYF4cRtcPj18zX45b9` | 0.9 s | 20,000 |
| Replay voucher #0 | rejected in simulation: `VoucherAlreadySettled` | | |

Payer record after both runs: 2 tabs, 6 vouchers, $13.50 settled, 0 shortfalls.

## Notes
- Public devnet RPC returns 429s under load (deploy with `--use-rpc` failed; reads in scripts retry). A provider RPC URL in `.env` would help the live demo.
- Batches use v1 transactions (3 vouchers = 1,536 bytes > the 1,232-byte legacy limit).

## M2: from the UI (dev server, built-in browser, test wallet in the browser)
Tab `2TuwWCRhZ7EpqsmFw1yWQWBMw77Lg8bGV9GFTkSkzeP8`:
| Step | Signature | Confirmed | Fee |
|---|---|---|---|
| Open tab ($40), Owner view | `5U9crhh5XjXnpgRAXXyQeE5P78TKtQTpW3CcPXAauwwEQisPpu3RccinLJ5QKAbR95JbmSCzGG11dgbeF55XbGre` | 1.0 s | 5,000 |
| Shop settles 3 vouchers, one v1 tx | `3GWbVawE3XGxjkQ8HJyJfBT6Q2vHp3athqUoZeMNQCuDYXePbHneK1To2Y12N9zvmUzwZdnHjkAfHUVaoGsDAcJX` | 0.93 s | 20,000 |
| Shop settles 1 voucher | `2bKyqDc57ZS1zPJ6S7Gi6Af5Cgr7s4cBrSmrrGjAUwAfcnTfrWoPPz61aeHNMaw318pyLvkHScaPn5MU7uGm4ew4` | 0.7 s | 10,000 |

Offline checks seen in the UI: "Signature valid · checked offline in 1 ms"; "Covered: $36.50 left in this tab after this sale"; 4th voucher ($12) declined: "this would put this customer at $18.75 offline, over your $15.00 limit for one customer".
Offline shell: service worker precaches all pages and their assets; with the server stopped, /app/phone and /app/shop still load and run.
Faucet key `5zGShzjgsovLoasxSiusW1VP7AjEdmA6wqA2QnogoJBr` (= test-USD mint authority) holds ~0.46 SOL for drips.
Not verified: a real wallet extension (Phantom etc.) in the Owner view; I used the browser test wallet. Real airplane mode on two devices is for the demo recording.

## M2 review fixes (04:25)
- v0 fallback, forced with `/app/shop?tx=v0`: 2 vouchers settled as 2 parallel v0 txs, `5ePGD7q692rXgfcDNKsfQEaGUJj1dzzyXu2z1qkydTEx5RDkmAP1GPTWhkCTwSGmfoBwRGo5bgocswWyMJ4VPvB5` and `4cFQHx9MoiE9jYr7GE7fvA23a6hPJqx6Vmb1HuMgNo1mZVyYAoMxZ8cMVjFGoAPd4qj7uAsmw3DwvRPKw1qJ3wvL` (version 0, 0.68 s / 0.69 s). UI: "Settled 2 vouchers · 2 transactions · 0.7 s".
- Faucet key topped up to 1.497 SOL; deployer 1.77 SOL (enough for one program upgrade buffer).

## M3: AI risk officer (on-device, offline, tighten-only)
- Model: `Qwen2.5-1.5B-Instruct-q4f16_1-MLC` via WebLLM 0.2.87 on WebGPU (this Mac: Apple, metal-3). First load 12.8 s (≈1 GB download); later loads 0.46–0.9 s from the browser cache with no requests to huggingface.co or raw.githubusercontent.com.
- Spike findings: 0.5B answered in ~0.3 s but couldn't apply rules (accepted everything); 1.5B also ignored explicit rules ("decline on shortfalls" → accept) even though it read the facts back correctly. Working design: code lists soft warning signs; the model picks the main reason from a JSON-schema enum (8 worked examples); the decision follows from the reason; it may decline only when a warning sign exists. 7/8 spike cases decided as labelled, 0 false declines.
- In the Shop: "AI officer: Accept: 8% of this tab, 0 clean tabs before. (1.7 s, on this device)". It only reviews what the rules accepted.

## M3: Doggett's Crossing (offline power-up + commit/reveal)
| Step | Signature / result |
|---|---|
| Studio commits sha256(seed), round 0 | `2r7CnF68pXz2RU3pqXiWnzcK8afsQwmBcdnB3XUDjYA3fg3m3AF98gMRMsenBggQSvs1M5y47M17FDpNJGnf7QTt` (1.0 s) |
| Phone buys Full sail offline | unlocked in 10 ms, voucher No. 0008, no network |
| Studio settles it (with No. 0007) in one v1 tx | `BVMGtkkQqApsF9GKKj242tdWe5KYfha1RLHUmZMo22eqF4rFiQKvLmZAV4utLeRfVSXfajAB9a2xCZjqg8QSeiL` (1.0 s) |
| Studio reveals seed, commits round 1 | `2nrbnoD4RgKxZDFgVZfiuC8YFYZHR59YPxXaLkgvPMeTiUvhd9Lk6PjqfXB7ZypqXkxDhDi4c22E9zCk4uikLULe` (1.0 s) |
| Player checks | sha256(seed) matches the commitment seen before buying; roll 81 → Oar polish (common) |
Game PDA: `DtnGwjM1qHsQ7E4GugU1w4CnE31W7X3MAxnixVviwZ3N` (studio = the shop key `6LNV…PsXm`).

## M3 review fixes (05:05)
- Game vouchers carry their seed round in nonce bytes 0–3; buying needs a commitment seen online; sealed drops show "Round N not revealed for 2 h"; the proof checks the round. Known limit and next step in README.
- Tighten-only proven in tests: rules decline + model accept → decline; junk/unknown reason/timeout → rules decide (23/23 tests).
- AI line: "Looks fine: … first tab from this customer. (1.7 s, on this device)" / "Caution: …"; preload button; "Rules only on this device" without WebGPU.
- Guided path: /app "Try it in 60 seconds", numbered role tabs, step line, Next link at the end of each view.

## M4: production-build rehearsal of the demo script (fresh origin, new keys)
| Step | Result |
|---|---|
| Owner opens a $40 tab (test wallet) | `3beWsDgCJ2xBA9QnmZbzdg97s3RJ5SJnPxaByJFu1saut8RbeJUWZh8WyQTckiKtq3488CnrcvYeJHEtWAdFF6m5`, 0.5 s |
| Studio commits seed, round 0 | `3QfN3kEwYUvJERhVBj9apE9wXnbB1X8Pveuaqhg1g1wAbDy9dAK8Pc49cWD5HGXMtknzbqak4r7NnXSRBuvmyhbN`, 0.7 s |
| Shop checks 3 vouchers offline | "checked offline in <1 ms", "AI OFFICER Looks fine: 8% of this tab, first tab from this customer. (1.7 s, on this device)" |
| 4th voucher ($12) | declined: "over your $15.00 limit for one customer"; risk circuit shows Tripped |
| Settle 3 in one tx | `5dwbbrL6gRzX9HL7168V9KQWGiQMWrzYFZP2j2yNrXZ7jiG2Uh2VRmFfUCRdBfySxEiGQefVoCZbYntWhEYP2iPX`, 0.8 s, $6.75 in, fee 0.00002 SOL |
| Replay No. 0001 | rejected |
| Power-up bought (round 0 in nonce), settled | `5Wd9Zbo5GykmSytGRRHJNfC3sfJJ6CjMZscTfUjRXiS9K4sND2AUbhA9qNeEMWuMEeZ2sWpdETCHQMVhEH58dtNG`, 0.9 s |
| Seed revealed | `59iQvt8c5UdCo97pQjXbvqR2F2vvZu7ZokzpxwRW4knzyQW8eBVQdPsG5Sz2i3EecUdMkRqNZAdqiZ1GKoWcb1J7`, 0.8 s |
| Player's proof | ✓ Oar polish; sha256(seed) matches; round in voucher 0 |

## Add-ons (ADDONS.md), 05:08–05:21 ET. No program upgrade; deployer still 1.77 SOL
| # | Status | Proof |
|---|---|---|
| 1 Batch | 5 vouchers per v1 tx (client); single-precompile `settle_batch` not built | devnet `xF5ViLRC44dCNDgD798kTTqWxB3gL7cq5QqkjwjUC5CNRBEmMicXhZtKmshepG8nkCNHtahrR7GirNR1CMvfwTC`: 5 vouchers, v1, 110,940 CU, 0.8 s |
| 2 Hash chain | link in nonce bytes 4–11; shops decline forks | test "a fork after the same voucher is rejected" |
| 3 v1 + limits | verified | `scripts/tx-info.ts`: configMask 12, CU limit 120,065, loaded data 543,222; v0 fallback tx is version 0 |
| 4 Zero-copy | not done (layout break for existing tabs, small gain); CU recorded | README "Measured numbers" |
| 5 Property tests | 25 seeded worlds × 10 attempts | 28/28 tests |
| 6 Non-extractable key | verified | test: pkcs8 and jwk export reject |
| 7 Offline hard reload | verified on localhost prod build; SW keeps lazy AI chunk | server stopped: Phone/Shop/Play reload and run, officer Ready |
| 8 Codama | verified | only the Ed25519 precompile ix is hand-built |
| 9 AI on screen | model name + latency | "(Qwen2.5 1.5B, 1.7 s, on this device)" |
| 10 Live numbers | Shop "Measured here" panel + README | 1 voucher: 1.0 s confirmed, 1.0 s finalized, 23,688 CU, AI 1.5 s |
| 11 Threat model | stolen phone, fork, malicious courier added | README |
| 12 Budget planner | phone, offline, advise-only | "Split by Qwen2.5 1.5B on this phone in 1.3 s, offline"; "This is 40% of today's food budget" |
| 13 Story | README "When the road is gone"; courier as unshipped design | README |
