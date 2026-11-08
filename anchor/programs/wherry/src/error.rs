use anchor_lang::prelude::*;

#[error_code]
pub enum WherryError {
    #[msg("Amount must be more than zero")]
    InvalidAmount,
    #[msg("Expiry must be in the future and at most 30 days away")]
    InvalidExpiry,
    #[msg("This tab is not open")]
    TabNotOpen,
    #[msg("This tab has expired")]
    TabExpired,
    #[msg("The settlement window for this tab has closed")]
    SettlementWindowClosed,
    #[msg("Shops can still settle this tab")]
    SettlementWindowOpen,
    #[msg("No Ed25519 signature check right before this settlement")]
    MissingEd25519Instruction,
    #[msg("The Ed25519 check must verify exactly one inline signature")]
    MalformedEd25519Instruction,
    #[msg("The voucher was not signed by this tab's phone key")]
    DeviceKeyMismatch,
    #[msg("The signed voucher does not match this settlement")]
    VoucherMismatch,
    #[msg("Voucher serial must be below 1024")]
    SerialOutOfRange,
    #[msg("This voucher was already settled")]
    VoucherAlreadySettled,
    #[msg("The voucher expires after its tab")]
    VoucherOutlivesTab,
    #[msg("Wrong token mint for this tab")]
    WrongMint,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("The seed does not match the commitment")]
    SeedMismatch,
    #[msg("Tab id must equal the number of tabs this payer has opened")]
    InvalidTabId,
    #[msg("A seed is already committed and not yet revealed")]
    SeedAlreadyCommitted,
    #[msg("No seed is committed")]
    NoSeedCommitted,
}
