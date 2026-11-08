use anchor_lang::prelude::*;

/// A customer's escrow. PDA `["tab", owner, tab_id u64 LE]`.
/// The vault is this PDA's associated token account for `mint`.
#[account]
#[derive(InitSpace)]
pub struct Tab {
    pub owner: Pubkey,
    pub tab_id: u64,
    /// Ed25519 public key of the paired phone. It signs vouchers offline.
    pub device_key: [u8; 32],
    pub mint: Pubkey,
    pub deposited: u64,
    pub settled: u64,
    /// Voucher value the vault could not cover.
    pub shortfall: u64,
    pub expires_at: i64,
    /// `expires_at + SETTLE_WINDOW`. Shops settle until then; the owner closes after.
    pub settle_deadline: i64,
    /// One bit per voucher serial (0..1024). A set bit means settled.
    pub used: [u8; 128],
    pub status: TabStatus,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum TabStatus {
    Open,
    Closed,
}

/// A payer's public track record. PDA `["payer", owner]`.
#[account]
#[derive(InitSpace)]
pub struct PayerRecord {
    pub owner: Pubkey,
    pub tabs_opened: u32,
    pub tabs_closed_clean: u32,
    pub vouchers_settled: u32,
    pub volume_settled: u64,
    pub shortfalls: u32,
    pub shortfall_amount: u64,
    pub bump: u8,
}

/// Commit/reveal seed for the provably fair game bonus. PDA `["game", studio]`.
#[account]
#[derive(InitSpace)]
pub struct GameConfig {
    pub studio: Pubkey,
    /// sha256 of the seed for `epoch`. All zeroes means nothing is committed.
    pub seed_commitment: [u8; 32],
    pub epoch: u32,
    pub last_revealed_seed: [u8; 32],
    pub bump: u8,
}

#[event]
pub struct TabOpened {
    pub tab: Pubkey,
    pub owner: Pubkey,
    pub tab_id: u64,
    pub amount: u64,
    pub expires_at: i64,
}

#[event]
pub struct VoucherSettled {
    pub tab: Pubkey,
    pub merchant: Pubkey,
    pub serial: u32,
    pub amount: u64,
    pub paid: u64,
    pub nonce: [u8; 16],
}

#[event]
pub struct Shortfall {
    pub tab: Pubkey,
    pub merchant: Pubkey,
    pub serial: u32,
    pub amount: u64,
    pub paid: u64,
}

#[event]
pub struct TabClosed {
    pub tab: Pubkey,
    pub refunded: u64,
    pub clean: bool,
}

#[event]
pub struct SeedCommitted {
    pub studio: Pubkey,
    pub epoch: u32,
    pub seed_hash: [u8; 32],
}

#[event]
pub struct SeedRevealed {
    pub studio: Pubkey,
    pub epoch: u32,
    pub seed: [u8; 32],
}

#[event]
pub struct CourierSettled {
    pub tab: Pubkey,
    pub courier: Pubkey,
    pub merchant: Pubkey,
    pub serial: u32,
    pub fee: u64,
}
