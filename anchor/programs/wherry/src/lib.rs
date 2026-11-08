//! Wherry: a customer locks tokens in an onchain tab, a paired phone signs vouchers offline,
//! and shops settle batches of vouchers later. Each settlement checks the phone's Ed25519
//! signature through the precompile and the instructions sysvar.
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, TransferChecked};

pub mod error;
pub mod state;
pub mod voucher;

pub use error::WherryError;
pub use state::*;

declare_id!("7QcwJ8Jwj4W74Ypq58U5jgBrxwHDvxquGwic2xzPr4MM");

/// How long shops can still settle after a tab expires.
pub const SETTLE_WINDOW: i64 = 24 * 60 * 60;
/// The longest a tab can stay open.
pub const MAX_TAB_DURATION: i64 = 30 * 24 * 60 * 60;
/// Voucher serials are 0..MAX_SERIALS (one bit each in `Tab::used`).
pub const MAX_SERIALS: u32 = 1024;

#[program]
pub mod wherry {
    use super::*;

    pub fn open_tab(
        ctx: Context<OpenTab>,
        tab_id: u64,
        device_key: [u8; 32],
        amount: u64,
        expires_at: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(amount > 0, WherryError::InvalidAmount);
        let latest = now
            .checked_add(MAX_TAB_DURATION)
            .ok_or(WherryError::MathOverflow)?;
        require!(
            expires_at > now && expires_at <= latest,
            WherryError::InvalidExpiry
        );

        let payer = &mut ctx.accounts.payer_record;
        if payer.owner == Pubkey::default() {
            payer.owner = ctx.accounts.owner.key();
            payer.bump = ctx.bumps.payer_record;
        }
        // Sequential ids mean a closed tab's address, and its old vouchers, never come back.
        require!(
            tab_id == u64::from(payer.tabs_opened),
            WherryError::InvalidTabId
        );
        payer.tabs_opened = payer
            .tabs_opened
            .checked_add(1)
            .ok_or(WherryError::MathOverflow)?;

        token::transfer_checked(
            CpiContext::new(
                Token::id(),
                TransferChecked {
                    from: ctx.accounts.owner_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        let tab = &mut ctx.accounts.tab;
        tab.owner = ctx.accounts.owner.key();
        tab.tab_id = tab_id;
        tab.device_key = device_key;
        tab.mint = ctx.accounts.mint.key();
        tab.deposited = amount;
        tab.settled = 0;
        tab.shortfall = 0;
        tab.expires_at = expires_at;
        tab.settle_deadline = expires_at
            .checked_add(SETTLE_WINDOW)
            .ok_or(WherryError::MathOverflow)?;
        tab.used = [0; 128];
        tab.status = TabStatus::Open;
        tab.bump = ctx.bumps.tab;

        emit!(TabOpened {
            tab: tab.key(),
            owner: tab.owner,
            tab_id,
            amount,
            expires_at,
        });
        Ok(())
    }

    pub fn top_up(ctx: Context<TopUp>, amount: u64) -> Result<()> {
        require!(amount > 0, WherryError::InvalidAmount);
        require!(
            Clock::get()?.unix_timestamp < ctx.accounts.tab.expires_at,
            WherryError::TabExpired
        );

        token::transfer_checked(
            CpiContext::new(
                Token::id(),
                TransferChecked {
                    from: ctx.accounts.owner_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        let tab = &mut ctx.accounts.tab;
        tab.deposited = tab
            .deposited
            .checked_add(amount)
            .ok_or(WherryError::MathOverflow)?;
        Ok(())
    }

    /// Pay one voucher. The instruction before this one must be the Ed25519 check of the
    /// voucher; batch by repeating (ed25519, settle) pairs in one transaction.
    pub fn settle(
        ctx: Context<Settle>,
        serial: u32,
        amount: u64,
        voucher_expires_at: i64,
        nonce: [u8; 16],
    ) -> Result<()> {
        let tab = &ctx.accounts.tab;
        let merchant = ctx.accounts.merchant.key();
        let expected = voucher::voucher_bytes(
            &tab.key(),
            &merchant,
            &ctx.accounts.mint.key(),
            amount,
            serial,
            voucher_expires_at,
            &nonce,
        );
        voucher::verify_previous_ed25519(
            &ctx.accounts.instructions.to_account_info(),
            &tab.device_key,
            &expected,
        )?;
        let (byte, bit) = check_voucher(tab, serial, amount, voucher_expires_at)?;

        // Shortfall instead of failure: the late shop gets what is left.
        let paid = amount.min(ctx.accounts.vault.amount);
        pay_from_vault(
            tab,
            &ctx.accounts.vault,
            &ctx.accounts.mint,
            ctx.accounts.merchant_token.to_account_info(),
            paid,
        )?;
        record_settlement(
            &mut ctx.accounts.tab,
            &mut ctx.accounts.payer_record,
            merchant,
            serial,
            amount,
            paid,
            (byte, bit),
            nonce,
        )
    }

    /// Anyone-settles courier: anyone with a signal can settle a shop's voucher, with the shop's
    /// signed consent, and earn a capped fee out of what is paid. The two instructions before this
    /// one must be the Ed25519 checks of the voucher (phone key) and of the authorization (shop key).
    #[allow(clippy::too_many_arguments)]
    pub fn settle_via_courier(
        ctx: Context<SettleViaCourier>,
        serial: u32,
        amount: u64,
        voucher_expires_at: i64,
        nonce: [u8; 16],
        fee_bps: u16,
        max_fee_bps: u16,
        max_fee_abs: u64,
        auth_expires_at: i64,
        auth_nonce: [u8; 16],
    ) -> Result<()> {
        let tab = &ctx.accounts.tab;
        let merchant = ctx.accounts.merchant.key();
        let ix_sysvar = ctx.accounts.instructions.to_account_info();
        let expected = voucher::voucher_bytes(
            &tab.key(),
            &merchant,
            &ctx.accounts.mint.key(),
            amount,
            serial,
            voucher_expires_at,
            &nonce,
        );
        voucher::verify_ed25519_before(
            &ix_sysvar,
            2,
            &tab.device_key,
            &expected,
            WherryError::DeviceKeyMismatch,
            WherryError::VoucherMismatch,
        )?;
        let auth = voucher::courier_auth_bytes(
            &merchant,
            &tab.key(),
            max_fee_bps,
            max_fee_abs,
            auth_expires_at,
            &auth_nonce,
        );
        voucher::verify_ed25519_before(
            &ix_sysvar,
            1,
            &merchant.to_bytes(),
            &auth,
            WherryError::CourierAuthWrongKey,
            WherryError::CourierAuthMismatch,
        )?;
        require!(
            Clock::get()?.unix_timestamp <= auth_expires_at,
            WherryError::CourierAuthExpired
        );
        require!(
            fee_bps <= max_fee_bps && max_fee_bps <= 10_000,
            WherryError::CourierFeeOverCap
        );
        let (byte, bit) = check_voucher(tab, serial, amount, voucher_expires_at)?;

        let paid = amount.min(ctx.accounts.vault.amount);
        // The fee comes out of what is actually paid, and never above the shop's absolute cap.
        let fee = ((paid as u128 * fee_bps as u128 / 10_000) as u64).min(max_fee_abs);
        pay_from_vault(
            tab,
            &ctx.accounts.vault,
            &ctx.accounts.mint,
            ctx.accounts.merchant_token.to_account_info(),
            paid - fee,
        )?;
        pay_from_vault(
            tab,
            &ctx.accounts.vault,
            &ctx.accounts.mint,
            ctx.accounts.courier_token.to_account_info(),
            fee,
        )?;
        emit!(CourierSettled {
            tab: tab.key(),
            courier: ctx.accounts.courier.key(),
            merchant,
            serial,
            fee,
        });
        record_settlement(
            &mut ctx.accounts.tab,
            &mut ctx.accounts.payer_record,
            merchant,
            serial,
            amount,
            paid,
            (byte, bit),
            nonce,
        )
    }

    /// After the settlement window: refund what is left and close the tab.
    pub fn close_tab(ctx: Context<CloseTab>) -> Result<()> {
        let tab = &ctx.accounts.tab;
        require!(
            Clock::get()?.unix_timestamp > tab.settle_deadline,
            WherryError::SettlementWindowOpen
        );

        let owner = tab.owner;
        let tab_id = tab.tab_id.to_le_bytes();
        let bump = [tab.bump];
        let seeds: &[&[&[u8]]] = &[&[b"tab", owner.as_ref(), &tab_id, &bump]];
        let refunded = ctx.accounts.vault.amount;
        if refunded > 0 {
            token::transfer_checked(
                CpiContext::new_with_signer(
                    Token::id(),
                    TransferChecked {
                        from: ctx.accounts.vault.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.owner_token.to_account_info(),
                        authority: tab.to_account_info(),
                    },
                    seeds,
                ),
                refunded,
                ctx.accounts.mint.decimals,
            )?;
        }
        token::close_account(CpiContext::new_with_signer(
            Token::id(),
            CloseAccount {
                account: ctx.accounts.vault.to_account_info(),
                destination: ctx.accounts.owner.to_account_info(),
                authority: tab.to_account_info(),
            },
            seeds,
        ))?;

        let clean = tab.shortfall == 0;
        if clean {
            let payer = &mut ctx.accounts.payer_record;
            payer.tabs_closed_clean = payer
                .tabs_closed_clean
                .checked_add(1)
                .ok_or(WherryError::MathOverflow)?;
        }
        let tab_key = ctx.accounts.tab.key();
        ctx.accounts.tab.status = TabStatus::Closed;
        emit!(TabClosed {
            tab: tab_key,
            refunded,
            clean,
        });
        Ok(())
    }

    /// The game studio commits to sha256(seed) before players buy.
    /// Allowed only when nothing is pending, so a commitment can't be swapped after purchases.
    pub fn commit_seed(ctx: Context<CommitSeed>, seed_hash: [u8; 32]) -> Result<()> {
        let game = &mut ctx.accounts.game;
        if game.studio == Pubkey::default() {
            game.studio = ctx.accounts.studio.key();
            game.bump = ctx.bumps.game;
        }
        require!(
            game.seed_commitment == [0u8; 32],
            WherryError::SeedAlreadyCommitted
        );
        game.seed_commitment = seed_hash;
        emit!(SeedCommitted {
            studio: game.studio,
            epoch: game.epoch,
            seed_hash,
        });
        Ok(())
    }

    /// Reveal the committed seed and commit the next one in the same step.
    /// `next_hash` of all zeroes stops the chain.
    pub fn reveal_seed(ctx: Context<RevealSeed>, seed: [u8; 32], next_hash: [u8; 32]) -> Result<()> {
        let game = &mut ctx.accounts.game;
        require!(
            game.seed_commitment != [0u8; 32],
            WherryError::NoSeedCommitted
        );
        require!(
            solana_sha256_hasher::hash(&seed).to_bytes() == game.seed_commitment,
            WherryError::SeedMismatch
        );
        let epoch = game.epoch;
        game.last_revealed_seed = seed;
        game.seed_commitment = next_hash;
        game.epoch = epoch.checked_add(1).ok_or(WherryError::MathOverflow)?;
        emit!(SeedRevealed {
            studio: game.studio,
            epoch,
            seed,
        });
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(tab_id: u64)]
pub struct OpenTab<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + PayerRecord::INIT_SPACE,
        seeds = [b"payer", owner.key().as_ref()],
        bump,
    )]
    pub payer_record: Account<'info, PayerRecord>,
    #[account(
        init,
        payer = owner,
        space = 8 + Tab::INIT_SPACE,
        seeds = [b"tab", owner.key().as_ref(), &tab_id.to_le_bytes()],
        bump,
    )]
    pub tab: Account<'info, Tab>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = tab,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = owner)]
    pub owner_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TopUp<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        has_one = owner,
        has_one = mint @ WherryError::WrongMint,
        constraint = tab.status == TabStatus::Open @ WherryError::TabNotOpen,
        seeds = [b"tab", owner.key().as_ref(), &tab.tab_id.to_le_bytes()],
        bump = tab.bump,
    )]
    pub tab: Account<'info, Tab>,
    pub mint: Account<'info, Mint>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = tab)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = owner)]
    pub owner_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(mut)]
    pub merchant: Signer<'info>,
    #[account(
        mut,
        has_one = mint @ WherryError::WrongMint,
        constraint = tab.status == TabStatus::Open @ WherryError::TabNotOpen,
        seeds = [b"tab", tab.owner.as_ref(), &tab.tab_id.to_le_bytes()],
        bump = tab.bump,
    )]
    pub tab: Account<'info, Tab>,
    #[account(
        mut,
        seeds = [b"payer", tab.owner.as_ref()],
        bump = payer_record.bump,
    )]
    pub payer_record: Account<'info, PayerRecord>,
    pub mint: Account<'info, Mint>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = tab)]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = merchant,
        associated_token::mint = mint,
        associated_token::authority = merchant,
    )]
    pub merchant_token: Account<'info, TokenAccount>,
    /// CHECK: pinned to the instructions sysvar by address; read with the `_checked` loaders.
    #[account(address = solana_instructions_sysvar::ID)]
    pub instructions: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleViaCourier<'info> {
    #[account(mut)]
    pub courier: Signer<'info>,
    /// CHECK: the shop being paid. Bound by both signatures: the voucher names it, and its own key
    /// signed the courier authorization (checked through the instructions sysvar).
    pub merchant: UncheckedAccount<'info>,
    #[account(
        mut,
        has_one = mint @ WherryError::WrongMint,
        constraint = tab.status == TabStatus::Open @ WherryError::TabNotOpen,
        seeds = [b"tab", tab.owner.as_ref(), &tab.tab_id.to_le_bytes()],
        bump = tab.bump,
    )]
    pub tab: Box<Account<'info, Tab>>,
    #[account(
        mut,
        seeds = [b"payer", tab.owner.as_ref()],
        bump = payer_record.bump,
    )]
    pub payer_record: Box<Account<'info, PayerRecord>>,
    pub mint: Box<Account<'info, Mint>>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = tab)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = courier,
        associated_token::mint = mint,
        associated_token::authority = merchant,
    )]
    pub merchant_token: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = courier,
        associated_token::mint = mint,
        associated_token::authority = courier,
    )]
    pub courier_token: Box<Account<'info, TokenAccount>>,
    /// CHECK: pinned to the instructions sysvar by address; read with the `_checked` loaders.
    #[account(address = solana_instructions_sysvar::ID)]
    pub instructions: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseTab<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        close = owner,
        has_one = owner,
        has_one = mint @ WherryError::WrongMint,
        seeds = [b"tab", owner.key().as_ref(), &tab.tab_id.to_le_bytes()],
        bump = tab.bump,
    )]
    pub tab: Account<'info, Tab>,
    #[account(
        mut,
        seeds = [b"payer", owner.key().as_ref()],
        bump = payer_record.bump,
    )]
    pub payer_record: Account<'info, PayerRecord>,
    pub mint: Account<'info, Mint>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = tab)]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub owner_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CommitSeed<'info> {
    #[account(mut)]
    pub studio: Signer<'info>,
    #[account(
        init_if_needed,
        payer = studio,
        space = 8 + GameConfig::INIT_SPACE,
        seeds = [b"game", studio.key().as_ref()],
        bump,
    )]
    pub game: Account<'info, GameConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevealSeed<'info> {
    pub studio: Signer<'info>,
    #[account(
        mut,
        has_one = studio,
        seeds = [b"game", studio.key().as_ref()],
        bump = game.bump,
    )]
    pub game: Account<'info, GameConfig>,
}

/// Every voucher rule except the signature. Returns the serial's (byte, bit) in the bitmap.
fn check_voucher(tab: &Tab, serial: u32, amount: u64, voucher_expires_at: i64) -> Result<(usize, u8)> {
    require!(amount > 0, WherryError::InvalidAmount);
    require!(serial < MAX_SERIALS, WherryError::SerialOutOfRange);
    let (byte, bit) = ((serial / 8) as usize, 1u8 << (serial % 8));
    require!(tab.used[byte] & bit == 0, WherryError::VoucherAlreadySettled);
    require!(
        voucher_expires_at <= tab.expires_at,
        WherryError::VoucherOutlivesTab
    );
    require!(
        Clock::get()?.unix_timestamp <= tab.settle_deadline,
        WherryError::SettlementWindowClosed
    );
    Ok((byte, bit))
}

/// Move `amount` from the vault to `to`, signed by the tab PDA. Zero is a no-op.
fn pay_from_vault<'info>(
    tab: &Account<'info, Tab>,
    vault: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    to: AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let owner = tab.owner;
    let tab_id = tab.tab_id.to_le_bytes();
    let bump = [tab.bump];
    let seeds: &[&[&[u8]]] = &[&[b"tab", owner.as_ref(), &tab_id, &bump]];
    token::transfer_checked(
        CpiContext::new_with_signer(
            Token::id(),
            TransferChecked {
                from: vault.to_account_info(),
                mint: mint.to_account_info(),
                to,
                authority: tab.to_account_info(),
            },
            seeds,
        ),
        amount,
        mint.decimals,
    )
}

/// Mark the serial used, update the tab and payer record, and emit the events.
#[allow(clippy::too_many_arguments)]
fn record_settlement(
    tab: &mut Account<Tab>,
    payer: &mut Account<PayerRecord>,
    merchant: Pubkey,
    serial: u32,
    amount: u64,
    paid: u64,
    (byte, bit): (usize, u8),
    nonce: [u8; 16],
) -> Result<()> {
    let tab_key = tab.key();
    tab.used[byte] |= bit;
    tab.settled = tab
        .settled
        .checked_add(paid)
        .ok_or(WherryError::MathOverflow)?;
    if paid < amount {
        let gap = amount - paid;
        tab.shortfall = tab
            .shortfall
            .checked_add(gap)
            .ok_or(WherryError::MathOverflow)?;
        payer.shortfalls = payer
            .shortfalls
            .checked_add(1)
            .ok_or(WherryError::MathOverflow)?;
        payer.shortfall_amount = payer
            .shortfall_amount
            .checked_add(gap)
            .ok_or(WherryError::MathOverflow)?;
        emit!(Shortfall {
            tab: tab_key,
            merchant,
            serial,
            amount,
            paid,
        });
    }
    payer.vouchers_settled = payer
        .vouchers_settled
        .checked_add(1)
        .ok_or(WherryError::MathOverflow)?;
    payer.volume_settled = payer
        .volume_settled
        .checked_add(paid)
        .ok_or(WherryError::MathOverflow)?;
    emit!(VoucherSettled {
        tab: tab_key,
        merchant,
        serial,
        amount,
        paid,
        nonce,
    });
    Ok(())
}
