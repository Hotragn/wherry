# STATUS: Wherry build

| Milestone | Target (ET) | Status | Time done | Proof | Cuts |
|---|---|---|---|---|---|
| Before M1 (fork, VERSIONS.md, deploy test) | 04:05 | done | 03:41 | Program deployed to devnet, tx `2KiK68LmAH9kSKmrivJsTqA4XjNH6GmLN7wwfkCN76vdLxjZ6hU34dWXZedYXcmbNXjHBrZuxws61HRURzjvXVxd` | none |
| M1 program on devnet + TS test | 05:00 | done | 03:45 | 16/16 LiteSVM TS tests pass; batch of 3 settled on devnet in one v1 tx (below) | none |
| M2 core flow e2e from UI | 06:45 | not started | | | |
| M3 AI officer + Gaming | 07:45 | not started | | | |
| M4 polish | 08:15 | not started | | | |
| FREEZE | 08:30 | | | | |
| Initial submission | <10:00 | | | | |
| Final submission | <11:00 | | | | |

Brand gate: waiting for "BRAND APPROVED". No UI styling written yet.

## Devnet
- Program ID: `7QcwJ8Jwj4W74Ypq58U5jgBrxwHDvxquGwic2xzPr4MM` (upgrade authority = deployer `J3ogqwY8pDhqrKtnkxmi6iSzcsVDs9BXfdS1a9ZhFc8A`)
- Test-USD mint (6 decimals): `DQRut6HQcdzu1bpKFzYRCPYfW1u7MCHso2EVGK6tuFs`; mint authority key in `keys/test-usd-authority.json` (for the faucet)
- Demo shop key: `FQPHfnsmMhKfw4UzLiECcAkAJrKNMFAmqiANvwbJYNcw` (`keys/demo-shop.json`)
- Deployer balance after M1: ~3.29 SOL

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
