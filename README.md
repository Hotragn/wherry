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
Pinned versions and the reasons behind them: [VERSIONS.md](VERSIONS.md).
