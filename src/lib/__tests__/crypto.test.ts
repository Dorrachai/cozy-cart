import { describe, expect, it } from 'vitest';
import {
  buildInviteUrl,
  decryptPayload,
  deriveRoomCredentials,
  encryptPayload,
  extractFriendCodeFromInput,
  generateFriendCode,
  isValidFriendCode,
  normalizeFriendCode,
  parseInviteHash,
} from '../crypto';
import { sanitizeHouseholdIndex, sanitizeShoppingList } from '../sanitize';

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

  it('blocks malicious URLs, javascript:/data: schemes, and XSS payloads in Friend Codes & QR URLs', () => {
    const maliciousInputs = [
      'https://evil.example/phish',
      'https://evil.example/foo-bar-BAZ1234',
      'http://192.168.1.1/admin',
      'javascript:alert(1)',
      'javascript:alert(document.cookie)//H-berry-mochi-7K4P9X2',
      'data:text/html,<script>alert(1)</script>',
      '<script>alert(1)</script>',
      'H-berry-mochi-7K4P9X2?redirect=https://evil.example',
      'H-berry-mochi-7K4P9X2@evil.example',
    ];

    for (const bad of maliciousInputs) {
      expect(isValidFriendCode(bad)).toBe(false);
      expect(() => normalizeFriendCode(bad)).toThrow();
      expect(() => buildInviteUrl(bad, 'https://dorrachai.github.io/cozy-cart/')).toThrow();
      expect(parseInviteHash(`#join=${encodeURIComponent(bad)}`)).toBeNull();
    }

    // Also block non-HTTP(S) base origins in buildInviteUrl
    expect(() => buildInviteUrl('H-berry-mochi-7K4P9X2', 'javascript:alert(1)')).toThrow();
    expect(() => buildInviteUrl('H-berry-mochi-7K4P9X2', 'data:text/html,hi')).toThrow();

    // Join input helper accepts same-origin invite links, blocks external phishing domains
    expect(
      extractFriendCodeFromInput(
        'https://dorrachai.github.io/cozy-cart/#join=H-berry-mochi-7K4P9X2',
        'https://dorrachai.github.io'
      )
    ).toBe('H-berry-mochi-7K4P9X2');

    expect(() =>
      extractFriendCodeFromInput(
        'https://evil-phish.example/cozy-cart/#join=H-berry-mochi-7K4P9X2',
        'https://dorrachai.github.io'
      )
    ).toThrow(/External links are blocked/);

    expect(() =>
      extractFriendCodeFromInput('javascript:alert(1)', 'https://dorrachai.github.io')
    ).toThrow();
  });

  it('pins listCode and sanitizes untrusted decrypted payloads against QR spoofing & CRDT poisoning', () => {
    const now = 1_760_000_000_000;
    const pinnedCode = 'L-berry-mochi-7K4P9X2';

    // Simulate a malicious peer trying to overwrite listCode with a phishing URL and Year-9999 timestamp
    const tamperedRemoteList = {
      id: 'list123',
      listCode: 'https://evil.example/malicious-qr',
      title: 'Groceries\u0000\u0007',
      emoji: '🛒',
      createdAt: now - 1000,
      updatedAt: 99_999_999_999_999,
      items: {
        item1: {
          id: 'item1',
          name: 'Oat milk',
          qty: '2x',
          category: 'invalid-category',
          checked: false,
          updatedAt: 99_999_999_999_999,
        },
      },
    };

    const cleanList = sanitizeShoppingList(tamperedRemoteList, pinnedCode, now);
    expect(cleanList).not.toBeNull();
    // Must stay pinned to the cryptographic capability code, never the attacker's string
    expect(cleanList!.listCode).toBe(pinnedCode);
    expect(cleanList!.title).toBe('Groceries');
    expect(cleanList!.updatedAt).toBeLessThanOrEqual(now + 5 * 60 * 1000);
    expect(cleanList!.items['item1']?.category).toBe('other');

    // Simulate a tampered HouseholdIndex referencing a malicious URL as listCode
    const tamperedHousehold = {
      version: 1,
      householdName: 'Home',
      updatedAt: now,
      lists: {
        good: {
          id: 'good',
          listCode: 'L-lemon-toast-3M8Q2W9',
          title: 'October',
          emoji: '🎃',
          createdAt: now,
          updatedAt: now,
        },
        bad: {
          id: 'bad',
          listCode: 'https://evil.example/steal',
          title: 'Click Me',
          emoji: '💀',
          createdAt: now,
          updatedAt: now,
        },
      },
      learnedCategories: {
        'oat milk': 'dairy',
        evil: 'not-a-category',
      },
    };

    const cleanHousehold = sanitizeHouseholdIndex(tamperedHousehold, now);
    expect(cleanHousehold).not.toBeNull();
    expect(Object.keys(cleanHousehold!.lists)).toEqual(['good']);
    expect(cleanHousehold!.learnedCategories).toEqual({ 'oat milk': 'dairy' });
  });
});
