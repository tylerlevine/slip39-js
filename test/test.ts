import * as assert from 'assert';
import * as slip39 from '../src/slip39';
import { decodeHexString, encodeHexString } from '../src/utils';

import { mnemonicVectors, vectors } from './vectors';

const MASTERSECRET = 'ABCDEFGHIJKLMNOP';
const MS = encodeHexString(MASTERSECRET);
const PASSPHRASE = 'TREZOR';
const ONE_GROUP = [
  [5, 7]
];

const slip15 = slip39.Slip39.fromArray(MS, {
  passphrase: PASSPHRASE,
  threshold: 1,
  groups: ONE_GROUP
});

const slip15NoPW = slip39.Slip39.fromArray(MS, {
  threshold: 1,
  groups: ONE_GROUP
});

//
// Shuffle
//
function shuffle(array: unknown[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

//
// Combination C(n, k) of the groups
//
function getCombinations<T>(array: T[], k: number) {
  const result: T[][] = [];
  const combinations: T[] = [];

  function helper(level: number, start: number) {
    for (let i = start; i < array.length - k + level + 1; i++) {
      combinations[level] = array[i];

      if (level < k - 1) {
        helper(level + 1, i + 1);
      } else {
        result.push(combinations.slice(0));
      }
    }
  }

  helper(0, 0);
  return result;
}

describe('Basic Tests', () => {
  describe('Test threshold 1 with 5 of 7 shares of a group combinations', () => {
    const mnemonics = slip15.fromPath('r/0').mnemonics;

    const combinations = getCombinations([0, 1, 2, 3, 4, 5, 6], 5);
    combinations.forEach((item) => {
      shuffle(item);
      const description = `Test shuffled combination ${item.join(' ')}.`;
      it(description, () => {
        const shares = item.map((idx) => mnemonics[idx]);
        assert.equal(decodeHexString(MS), decodeHexString(slip39.Slip39.recoverSecret(shares, PASSPHRASE)));
      });
    });
  });

  describe('Test passhrase', () => {
    const mnemonics = slip15.fromPath('r/0').mnemonics;
    const nopwMnemonics = slip15NoPW.fromPath('r/0').mnemonics;

    it('should return valid mastersecret when user submits valid passphrse', () => {
      assert.equal(decodeHexString(MS), decodeHexString(slip39.Slip39.recoverSecret(mnemonics.slice(0, 5), PASSPHRASE)));
    });
    it('should NOT return valid mastersecret when user submits invalid passphrse', () => {
      assert.notEqual(decodeHexString(MS), decodeHexString(slip39.Slip39.recoverSecret(mnemonics.slice(0, 5))));
    });
    it('should return valid mastersecret when user does not submit passphrse', () => {
      assert.equal(decodeHexString(MS), decodeHexString(slip39.Slip39.recoverSecret(nopwMnemonics.slice(0, 5))));
    });
  });

  describe('Test iteration exponent', () => {
    const slip1 = slip39.Slip39.fromArray(MS, {
      iterationExponent: 1
    });

    const slip2 = slip39.Slip39.fromArray(MS, {
      iterationExponent: 2
    });

    it('should return valid mastersecret when user apply valid iteration exponent', () => {
      assert.equal(decodeHexString(MS), decodeHexString(slip39.Slip39.recoverSecret(slip1.fromPath('r/0').mnemonics)));
      assert.equal(decodeHexString(MS), decodeHexString(slip39.Slip39.recoverSecret(slip2.fromPath('r/0').mnemonics)));
    });
    /**
     * assert.throws(() => x.y.z);
     * assert.throws(() => x.y.z, ReferenceError);
     * assert.throws(() => x.y.z, ReferenceError, /is not defined/);
     * assert.throws(() => x.y.z, /is not defined/);
     * assert.doesNotThrow(() => 42);
     * assert.throws(() => x.y.z, Error);
     * assert.throws(() => model.get.z, /Property does not exist in model schema./)
     * Ref: https://stackoverflow.com/questions/21587122/mocha-chai-expect-to-throw-not-catching-thrown-errors
     */
    it('should throw an Error when user submits invalid iteration exponent', () => {
      assert.throws(() => slip39.Slip39.fromArray(MS, { iterationExponent: -1 }), Error);
      assert.throws(() => slip39.Slip39.fromArray(MS, { iterationExponent: 33 }), Error);
    });
  });
});

// FIXME: finish it.
describe('Group Sharing Tests', () => {
  describe('Test all valid combinations of mnemonics', () => {
    const groups = [
      [3, 5],
      [3, 3],
      [2, 5],
      [1, 1]
    ];
    const slip = slip39.Slip39.fromArray(MS, {
      threshold: 2,
      groups: groups
    });

    const group2Mnemonics = slip.fromPath('r/2').mnemonics;
    const group3Mnemonic = slip.fromPath('r/3').mnemonics[0];

    it('Should return the valid master secret when it tested with minimal sets of mnemonics.', () => {
      const mnemonics = group2Mnemonics.filter((_, index) => {
        return index === 0 || index === 2;
      }).concat(group3Mnemonic);

      assert.equal(decodeHexString(MS), decodeHexString(slip39.Slip39.recoverSecret(mnemonics)));
    });
    xit('TODO: Should NOT return the valid master secret when one complete group and one incomplete group out of two groups required', () => {
      assert.fail('unimplemented');
    });
    xit('TODO: Should return the valid master secret when one group of two required but only one applied.', () => {
      assert.fail('unimplemented');
    });
  });
});

describe('Original test vectors Tests', () => {
  vectors.forEach((item) => {
    const description = item[0];
    const mnemonics = item[1];
    const masterSecret = Buffer.from(item[2], 'hex');

    it(description, () => {
      if (masterSecret.length !== 0) {
        const ms = slip39.Slip39.recoverSecret(mnemonics, PASSPHRASE);
        assert.equal(masterSecret.every((v, i) => v === ms[i]), true);
      } else {
        assert.throws(() => slip39.Slip39.recoverSecret(mnemonics, PASSPHRASE), Error);
      }
    });
  });
});

describe('Invalid Shares', () => {
  const tests: [string, number, number[][], number[]][] = [
    ['Short master secret', 1, [
      [2, 3]
    ], MS.slice(0, 14)],
    ['Odd length master secret', 1, [
      [2, 3]
    ], MS.concat([55])],
    ['Group threshold exceeds number of groups', 3, [
      [3, 5],
      [2, 5]
    ], MS],
    ['Invalid group threshold.', 0, [
      [3, 5],
      [2, 5]
    ], MS],
    ['Member threshold exceeds number of members', 2, [
      [3, 2],
      [2, 5]
    ], MS],
    ['Invalid member threshold', 2, [
      [0, 2],
      [2, 5]
    ], MS],
    ['Group with multiple members and threshold 1', 2, [
      [3, 5],
      [1, 3],
      [2, 5]
    ], MS]
  ];

  tests.forEach((item) => {
    const description = item[0];
    const threshold = item[1];

    const groups = item[2];
    const secret = item[3];

    it(description, () => {
      assert.throws(() =>
        slip39.Slip39.fromArray(secret, {
          threshold: threshold,
          groups: groups
        }), Error);
    });
  });
});

describe('Mnemonic Validation', () => {
  describe('Valid Mnemonics', () => {
    const mnemonics = slip15.fromPath('r/0').mnemonics;

    mnemonics.forEach((mnemonic, index) => {
      it(`Mnemonic at index ${index} should be valid`, () => {
        const isValid = slip39.Slip39.validateMnemonic(mnemonic);

        assert.equal(isValid, true);
      });
    });
  });

  mnemonicVectors.forEach((item) => {
    const description = item[0];
    const mnemonics = item[1];

    describe(description, () => {
      mnemonics.forEach((mnemonic, index) => {
        it(`Mnemonic at index ${index} should be invalid`, () => {
          const isValid = slip39.Slip39.validateMnemonic(mnemonic);

          assert.equal(isValid, false);
        });
      });
    });
  });
});

function itTestArray(t: number, g: number, gs: number[][]) {
  it(`recover master secret for ${t} shares (threshold=${t}) of ${g} '[1, 1,]' groups",`,() => {
    const slip = slip39.Slip39.fromArray(MS, {
      groups: gs.slice(0, g),
      passphrase: PASSPHRASE,
      threshold: t
    });

    const mnemonics = slip.fromPath('r').mnemonics.slice(0, t);

    const recoveredSecret = slip39.Slip39.recoverSecret(mnemonics, PASSPHRASE);
    assert.equal(MASTERSECRET, String.fromCharCode(...recoveredSecret));
  });
}

describe('Groups test (T=1, N=1 e.g. [1,1]) - ', () => {
  const totalGroups = 16;
  const groups = Array.from(Array(totalGroups), () => [1, 1]);

  for (let group = 1; group <= totalGroups; group++) {
    for (let threshold = 1; threshold <= group; threshold++) {
      itTestArray(threshold, group, groups);
    }
  }
});
