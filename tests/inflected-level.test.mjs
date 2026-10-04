import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupLevel } from '../scripts/cefr.mjs';
test('çekimli fiil temel fiilin seviyesine kaynak belirtilerek eşlenir', () => {
  assert.equal(lookupLevel('brought', 'verb').level, lookupLevel('bring', 'verb').level);
  assert.match(lookupLevel('brought', 'verb').levelSource, /bring/);
  assert.equal(lookupLevel('brought', 'noun').level, '');
});
