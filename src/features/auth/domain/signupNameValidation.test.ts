import { describe, expect, it } from 'vitest';
import { signupNameError } from './signupNameValidation';

describe('signup name validation', () => {
  it.each(['Maria Isabel de la Cruz Santos', '李明', "Ana María O'Connor", '  Jean-Luc Santos  '])('accepts complete names without enforcing a first/last split: %s', (name) => {
    expect(signupNameError(name)).toBe('');
  });
  it.each(['', ' ', 'A', '123', 'a'.repeat(201), 'Maria\nSantos', 'Maria\u200bSantos'])('rejects malformed names: %s', (name) => {
    expect(signupNameError(name)).toBeTruthy();
  });
});
