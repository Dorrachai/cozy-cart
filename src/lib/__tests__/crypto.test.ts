import { describe, expect, it } from 'vitest';
import {
  buildInviteUrl,
  decryptPayload,
  deriveRoomCredentials,
  encryptPayload,
  generateFriendCode,
  normalizeFriendCode,
  parseInviteHash,
} from '../crypto';

describe('crypto & zero-knowledge Friend Codes', () => {
  it('generates distinct high-entropy H- and L- Friend Codes', () => {
    const hCode = generateFriendCode('household');
    const lCode = generateFriendCode('list');

    expect(hCode).toMatch(/^H-[a-z]+-[a-z]+-[2-9A-HJ-NP-Z]{7}$/);
    expect(lCode).toMatch(/^L-[a-z]+-[a-z]+-[2-9A-HJ-NP-Z]{7}$/);
    expect(hCode).not.toEqual(lCode);
  });

  it('normalizes casing and whitespace consistently', () => {
    const c1 = normalizeFriendCode('  h-Berry-Mochi-7k4p9x2 ');
    const c2 = normalizeFriendCode('H_berry_mochi_7K4P9X2');
    expect(c1).toBe('H-berry-mochi-7K4P9X2');
    expect(c2).toBe('H-berry-mochi-7K4P9X2');
  });

  it('derives deterministic 64-hex docId and encrypts/decrypts AES-256-GCM round-trip', async () => {
    const code = 'H-berry-mochi-7K4P9X2';
    const credsA = await deriveRoomCredentials(code);
    const credsB = await deriveRoomCredentials('  h berry mochi 7k4p9x2  ');

    expect(credsA.kind).toBe('household');
    expect(credsA.docId).toMatch(/^[a-f0-9]{64}$/);
    expect(credsA.docId).toBe(credsB.docId);

    const secret = { title: 'November Groceries 🍂', items: ['Oat milk', 'Sour gummies'] };
    const { ct, iv } = await encryptPayload(secret, credsA.aesKey);

    // Ciphertext must never leak plaintext terms
    expect(ct).not.toContain('November');
    expect(ct).not.toContain('milk');

    const decrypted = await decryptPayload<typeof secret>(ct, iv, credsB.aesKey);
    expect(decrypted).toEqual(secret);
  });

  it('rejects decryption with a different Friend Code or tampered ciphertext', async () => {
    const credsRight = await deriveRoomCredentials('L-lemon-toast-3M8Q2W9');
    const credsWrong = await deriveRoomCredentials('L-lemon-toast-3M8Q2W8');

    expect(credsRight.kind).toBe('list');
    expect(credsRight.docId).not.toBe(credsWrong.docId);

    const { ct, iv } = await encryptPayload({ hello: 'world' }, credsRight.aesKey);
    await expect(decryptPayload(ct, iv, credsWrong.aesKey)).rejects.toThrow();
  });

  it('stores invite codes strictly inside URL #hash fragment (never query params)', () => {
    const url = buildInviteUrl('L-mango-mint-9K4P2X7', 'https://user.github.io/cozy-cart/?foo=1');
    expect(url).toBe('https://user.github.io/cozy-cart/#join=L-mango-mint-9K4P2X7');
    expect(parseInviteHash('#join=L-mango-mint-9K4P2X7')).toBe('L-mango-mint-9K4P2X7');
    expect(parseInviteHash('')).toBeNull();
  });
});
