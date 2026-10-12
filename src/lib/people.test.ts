import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, codeFromPath, formatCode, joinNames, newInviteCode, normalizeCode } from './people';

describe('invite codes', () => {
  it('are 6 characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const c = newInviteCode();
      expect(c).toHaveLength(6);
      expect([...c].every(ch => CODE_ALPHABET.includes(ch))).toBe(true);
    }
    expect(CODE_ALPHABET).not.toMatch(/[01ILO]/);
  });
  it('are shown with a dash and accepted however they are typed', () => {
    expect(formatCode('K7M4QX')).toBe('K7M-4QX');
    expect(normalizeCode('K7M-4QX')).toBe('K7M4QX');
    expect(normalizeCode(' k7m 4qx ')).toBe('K7M4QX');
    expect(normalizeCode('K7M4Q')).toBeNull();
    expect(normalizeCode('K7M4QO')).toBeNull();
  });
  it('come from an invite link', () => {
    expect(codeFromPath('/einladung/K7M4QX')).toBe('K7M4QX');
    expect(codeFromPath('/einladung/K7M4QX/')).toBe('K7M4QX');
    expect(codeFromPath('/plan')).toBeNull();
  });
});

describe('joinNames', () => {
  it('reads like a sentence', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['Anna'])).toBe('Anna');
    expect(joinNames(['Anna', 'Tom'])).toBe('Anna und Tom');
    expect(joinNames(['Anna', 'Tom', 'Lea'])).toBe('Anna, Tom und Lea');
  });
});
