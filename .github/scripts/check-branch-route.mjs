/** Keep release promotion explicit; never evaluate branch names as shell code. */
export function checkBranchRoute({ base, head, headRepo, repo }) {
  if (base === 'main') {
    if (head !== 'dev' || headRepo !== repo) {
      throw new Error(
        'Release PRs to main must come from dev in this repository. Target dev for tasks.',
      );
    }
    return;
  }
  if (base === 'dev') {
    if (head === 'main' && headRepo === repo) return; // sync after a release
    if (/^(feature|fix|hotfix|chore|docs|refactor|test|ci|perf|build|dependabot)\/.+/.test(head))
      return;
    throw new Error(
      'Task PRs to dev must use feature/*, fix/*, chore/* or another documented task prefix.',
    );
  }
  throw new Error('Target dev for tasks or main for releases.');
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  if (process.env.EVENT_NAME === 'pull_request') {
    checkBranchRoute({
      base: process.env.BASE_REF,
      head: process.env.HEAD_REF,
      headRepo: process.env.HEAD_REPO,
      repo: process.env.REPOSITORY,
    });
    console.log('Pull request branch route is valid.');
  } else {
    console.log('Branch route applies to pull requests only.');
  }
}
