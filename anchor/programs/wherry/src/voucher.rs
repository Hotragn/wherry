use anchor_lang::prelude::*;
use solana_instructions_sysvar::{load_current_index_checked, load_instruction_at_checked};

use crate::error::WherryError;

pub const VOUCHER_DOMAIN: &[u8; 8] = b"WHERRY01";
pub const VOUCHER_LEN: usize = 172;
pub const ED25519_PROGRAM_ID: Pubkey = pubkey!("Ed25519SigVerify111111111111111111111111111");

/// The exact bytes a phone signs:
/// "WHERRY01" | program_id | tab | merchant | mint | amount u64 LE | serial u32 LE
/// | voucher_expires_at i64 LE | nonce [u8; 16]
pub fn voucher_bytes(
    tab: &Pubkey,
    merchant: &Pubkey,
    mint: &Pubkey,
    amount: u64,
    serial: u32,
    voucher_expires_at: i64,
    nonce: &[u8; 16],
) -> [u8; VOUCHER_LEN] {
    let mut m = [0u8; VOUCHER_LEN];
    m[..8].copy_from_slice(VOUCHER_DOMAIN);
    m[8..40].copy_from_slice(crate::ID.as_ref());
    m[40..72].copy_from_slice(tab.as_ref());
    m[72..104].copy_from_slice(merchant.as_ref());
    m[104..136].copy_from_slice(mint.as_ref());
    m[136..144].copy_from_slice(&amount.to_le_bytes());
    m[144..148].copy_from_slice(&serial.to_le_bytes());
    m[148..156].copy_from_slice(&voucher_expires_at.to_le_bytes());
    m[156..172].copy_from_slice(nonce);
    m
}

/// Shop's consent to a courier settling its vouchers on one tab, signed by the shop's key:
/// "WHERRYC1" | program_id | merchant | tab | max_fee_bps u16 LE | max_fee_abs u64 LE
/// | auth_expires_at i64 LE | auth_nonce [u8; 16]
pub const COURIER_DOMAIN: &[u8; 8] = b"WHERRYC1";
pub const COURIER_AUTH_LEN: usize = 138;

pub fn courier_auth_bytes(
    merchant: &Pubkey,
    tab: &Pubkey,
    max_fee_bps: u16,
    max_fee_abs: u64,
    auth_expires_at: i64,
    auth_nonce: &[u8; 16],
) -> [u8; COURIER_AUTH_LEN] {
    let mut m = [0u8; COURIER_AUTH_LEN];
    m[..8].copy_from_slice(COURIER_DOMAIN);
    m[8..40].copy_from_slice(crate::ID.as_ref());
    m[40..72].copy_from_slice(merchant.as_ref());
    m[72..104].copy_from_slice(tab.as_ref());
    m[104..106].copy_from_slice(&max_fee_bps.to_le_bytes());
    m[106..114].copy_from_slice(&max_fee_abs.to_le_bytes());
    m[114..122].copy_from_slice(&auth_expires_at.to_le_bytes());
    m[122..138].copy_from_slice(auth_nonce);
    m
}

/// Require that the instruction right before the current one is an Ed25519 precompile call
/// that verified exactly one signature, by `device_key`, over `expected`, with the key,
/// signature and message all inline (instruction indexes = u16::MAX).
/// The precompile only proves that some signature is valid; binding it to this tab is our job.
pub fn verify_previous_ed25519(
    ix_sysvar: &AccountInfo,
    device_key: &[u8; 32],
    expected: &[u8],
) -> Result<()> {
    verify_ed25519_before(
        ix_sysvar,
        1,
        device_key,
        expected,
        WherryError::DeviceKeyMismatch,
        WherryError::VoucherMismatch,
    )
}

/// The same check for the instruction `back` places before the current one, with the errors to
/// raise for a wrong key and a wrong message.
pub fn verify_ed25519_before(
    ix_sysvar: &AccountInfo,
    back: usize,
    key: &[u8; 32],
    expected: &[u8],
    wrong_key: WherryError,
    wrong_message: WherryError,
) -> Result<()> {
    let current = load_current_index_checked(ix_sysvar)? as usize;
    require!(current >= back, WherryError::MissingEd25519Instruction);
    let ix = load_instruction_at_checked(current - back, ix_sysvar)?;
    require_keys_eq!(
        ix.program_id,
        ED25519_PROGRAM_ID,
        WherryError::MissingEd25519Instruction
    );

    // [count u8][padding u8] then 7 x u16: sig_off, sig_ix, pk_off, pk_ix, msg_off, msg_len, msg_ix
    let d = &ix.data;
    require!(
        d.len() >= 16 && d[0] == 1,
        WherryError::MalformedEd25519Instruction
    );
    let at = |i: usize| u16::from_le_bytes([d[i], d[i + 1]]);
    require!(
        at(4) == u16::MAX && at(8) == u16::MAX && at(14) == u16::MAX,
        WherryError::MalformedEd25519Instruction
    );
    let (pk_off, msg_off, msg_len) = (at(6) as usize, at(10) as usize, at(12) as usize);

    let pubkey = d
        .get(pk_off..pk_off + 32)
        .ok_or(WherryError::MalformedEd25519Instruction)?;
    if pubkey != key {
        return Err(wrong_key.into());
    }
    let message = d
        .get(msg_off..msg_off + msg_len)
        .ok_or(WherryError::MalformedEd25519Instruction)?;
    if message != expected {
        return Err(wrong_message.into());
    }
    Ok(())
}
