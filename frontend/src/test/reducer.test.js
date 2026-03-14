import { describe, it, expect } from 'vitest';

// Extracted reducer logic from Dapp.jsx — same implementation
const initialState = {
  selectedAddress: undefined,
  transactionError: undefined,
  networkError: undefined,
  txBeingSent: undefined,
  register: null,
  seePedigree: null,
  contractReady: false,
  dogId: undefined,
  name: undefined,
  breed: undefined,
  age: undefined,
  sex: undefined,
  mother: undefined,
  father: undefined,
  owner: undefined,
  lastRegistered: null,
};

function reducer(state, patch) {
  return { ...state, ...patch };
}

describe('Dapp reducer', () => {
  it('returns initial state when patched with nothing', () => {
    expect(reducer(initialState, {})).toEqual(initialState);
  });

  it('sets selectedAddress', () => {
    const next = reducer(initialState, { selectedAddress: '0xabc' });
    expect(next.selectedAddress).toBe('0xabc');
  });

  it('sets contractReady to true', () => {
    const next = reducer(initialState, { contractReady: true });
    expect(next.contractReady).toBe(true);
  });

  it('sets register true, seePedigree false', () => {
    const next = reducer(initialState, { register: true, seePedigree: false });
    expect(next.register).toBe(true);
    expect(next.seePedigree).toBe(false);
  });

  it('sets seePedigree true, register false', () => {
    const next = reducer(initialState, { register: false, seePedigree: true });
    expect(next.seePedigree).toBe(true);
    expect(next.register).toBe(false);
  });

  it('sets txBeingSent and clears it', () => {
    let state = reducer(initialState, { txBeingSent: '0xhash' });
    expect(state.txBeingSent).toBe('0xhash');
    state = reducer(state, { txBeingSent: undefined });
    expect(state.txBeingSent).toBeUndefined();
  });

  it('sets dog fields from retrieveDog result', () => {
    const next = reducer(initialState, {
      dogId: '5', name: 'Rex', breed: 'Labrador',
      sex: 'M', age: '3', mother: '0', father: '1', owner: '0xabc',
    });
    expect(next.dogId).toBe('5');
    expect(next.name).toBe('Rex');
    expect(next.breed).toBe('Labrador');
    expect(next.sex).toBe('M');
    expect(next.age).toBe('3');
    expect(next.mother).toBe('0');
    expect(next.father).toBe('1');
    expect(next.owner).toBe('0xabc');
  });

  it('resets to initial state', () => {
    const modified = reducer(initialState, { selectedAddress: '0xabc', contractReady: true });
    expect(reducer(modified, initialState)).toEqual(initialState);
  });

  it('sets lastRegistered on success', () => {
    const next = reducer(initialState, { lastRegistered: { name: 'Rex' } });
    expect(next.lastRegistered).toEqual({ name: 'Rex' });
  });

  it('clears lastRegistered', () => {
    const state = reducer(initialState, { lastRegistered: { name: 'Rex' } });
    const next = reducer(state, { lastRegistered: null });
    expect(next.lastRegistered).toBeNull();
  });

  it('sets transactionError', () => {
    const err = new Error('reverted');
    const next = reducer(initialState, { transactionError: err });
    expect(next.transactionError).toBe(err);
  });

  it('clears transactionError on dismiss', () => {
    const err = new Error('reverted');
    let state = reducer(initialState, { transactionError: err });
    state = reducer(state, { transactionError: undefined });
    expect(state.transactionError).toBeUndefined();
  });

  it('does not mutate previous state', () => {
    const prev = { ...initialState };
    reducer(initialState, { selectedAddress: '0xabc' });
    expect(initialState).toEqual(prev);
  });
});
