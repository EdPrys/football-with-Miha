import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBranchRoute } from './check-branch-route.mjs';

const local = { repo: 'owner/repo', headRepo: 'owner/repo' };
test('releases must originate from the local dev branch', () => {
  assert.doesNotThrow(() => checkBranchRoute({ ...local, base: 'main', head: 'dev' }));
  for (const head of ['feature/game', 'main', 'release/v1']) {
    assert.throws(() => checkBranchRoute({ ...local, base: 'main', head }));
  }
  assert.throws(() =>
    checkBranchRoute({ ...local, headRepo: 'other/repo', base: 'main', head: 'dev' }),
  );
});
test('tasks go to dev and local main can sync the release back', () => {
  for (const head of ['feature/game', 'fix/date', 'chore/ci', 'dependabot/npm/react', 'main']) {
    assert.doesNotThrow(() => checkBranchRoute({ ...local, base: 'dev', head }));
  }
  for (const head of ['dev', 'random', 'feature/']) {
    assert.throws(() => checkBranchRoute({ ...local, base: 'dev', head }));
  }
  assert.throws(() =>
    checkBranchRoute({ ...local, headRepo: 'other/repo', base: 'dev', head: 'main' }),
  );
  assert.throws(() => checkBranchRoute({ ...local, base: 'other', head: 'feature/game' }));
});
