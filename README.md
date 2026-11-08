# Wherry

The ferry for your money when the network's gone. Offline payments on Solana, backed by an onchain escrow.

> Work in progress for the MLH Solana Hackathon (Nov 2026). Devnet only. "Test dollars" are a devnet token, not real money.

Forked from the Solana Foundation template [`kit/nextjs-anchor`](https://github.com/solana-foundation/templates/tree/main/kit/nextjs-anchor) (`npx -y create-solana-dapp@latest -t solana-foundation/templates/kit/nextjs-anchor`). We kept its Next.js + `@solana/kit` + Codama + Anchor setup and its wallet-standard connection layer (the Kit-native path, not the older `@solana/wallet-adapter`), and replaced the vault program and the demo UI.

## Program (devnet)
`7QcwJ8Jwj4W74Ypq58U5jgBrxwHDvxquGwic2xzPr4MM`, [on Explorer](https://explorer.solana.com/address/7QcwJ8Jwj4W74Ypq58U5jgBrxwHDvxquGwic2xzPr4MM?cluster=devnet)

| Account | Seeds |
|---|---|
| `Tab` | `["tab", owner, tab_id u64 LE]` (tab ids run 0, 1, 2… per owner, so a closed tab's address never comes back) |
| Tab vault | the Tab PDA's associated token account for the mint |
| `PayerRecord` | `["payer", owner]` |
| `GameConfig` | `["game", studio]` |

Voucher (172 bytes, signed by the phone's Ed25519 key): `"WHERRY01"` ‖ program id ‖ tab ‖ merchant ‖ mint ‖ amount u64 LE ‖ serial u32 LE ‖ voucher_expires_at i64 LE ‖ nonce [u8; 16].

`settle` requires the instruction right before it to be an Ed25519 precompile call that verified exactly one signature with everything inline, by the tab's device key, over those exact bytes. A batch is several `(ed25519, settle)` pairs in one v1 transaction (3 vouchers = 1,536 bytes).

## Develop
```bash
pnpm install
pnpm anchor-build   # anchor build (program + IDL)
pnpm codama:js      # regenerate app/generated/wherry from the IDL
pnpm test           # LiteSVM tests for every instruction, including failure cases
pnpm dev
```
Try it on a real phone without publishing anything: `pnpm build && pnpm lan` serves the production build over HTTPS on your Wi-Fi address only (self-signed certificate, stops with Ctrl+C). Phones need HTTPS for the camera and WebCrypto.
Pinned versions and the reasons behind them: [VERSIONS.md](VERSIONS.md).

## Security notes
**What is trusted**
- *The phone key holder.* Whoever holds the paired phone can sign vouchers up to the tab's escrow. The key is a non-extractable WebCrypto Ed25519 key in that browser's IndexedDB.
- *The shop's sync freshness.* Offline, a shop judges coverage from its last copy of the tab list. The UI shows how old that copy is ("synced 12 min ago") and warns on unknown tabs.
- *The game studio's seed reveal.* The studio commits `sha256(seed)` before purchases and must reveal the matching seed later; it can't change it, but it can refuse to reveal (players see that).

**What an attacker could try, and what stops it**
| Attack | What stops it |
|---|---|
| Overspend across shops (offline, the phone signs more than the tab holds) | Settlement pays only from escrow: `paid = min(amount, vault)`. The late shop gets what's left and the gap is written to the payer's public record (`shortfalls`, `shortfall_amount`). Each shop's risk circuit caps what it holds per customer and in total, and it sees the payer record before accepting. |
| Replay a voucher | Every voucher has a serial; the tab's onchain bitmap (1,024 bits) marks it settled and a second settle fails with `VoucherAlreadySettled`. The shop also refuses a serial it has already taken, before syncing. |
| Cross-tab replay | The tab address is inside the signed bytes. Tab ids are sequential per owner (`tab_id == tabs_opened`), so a closed tab's address can never be reopened. |
| Tamper with the amount or redirect to another shop | The program rebuilds the 172 voucher bytes from the instruction args with `merchant = signer` and requires them to equal the bytes the Ed25519 precompile verified (`VoucherMismatch`). |
| Fake Ed25519 check (wrong key, extra signatures, data pointing elsewhere) | The previous instruction must be the Ed25519 program with exactly one signature, all three instruction indexes `u16::MAX` (inline), and the inline public key equal to the tab's device key. The instructions sysvar is read with the `_checked` loaders and pinned by address. |
| Front-run the owner's close | Shops can settle until `settle_deadline` (expiry + 24 h); the owner can close only after it. The windows never overlap. |
| Grind the game seed | The studio commits before purchases and `commit_seed` refuses to overwrite a pending commitment; the player's seed is the voucher nonce, random per voucher. Neither side can pick the outcome after seeing the other's input. |
| Fake QR sticker (someone pastes their own sticker over the shop's) | The phone shows the shop name and short key ("Paying Amara's kiosk · 6LNV…PsXm") before signing, and the shop's screen shows its own key. A voucher made out to the fake key fails the real shop's offline check at the counter ("Signature doesn't match. This voucher is for another shop"), so the swap is caught before the goods leave. |
| Faucet abuse | Devnet only, fixed $50 per request, at most 3 requests per address and 10 per IP per hour (in-memory limits). |
