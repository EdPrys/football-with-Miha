# Repository instructions

<!-- postman-cli:installation:start -->

Postman CLI is installed on this device, and can be used for API Engineering work.
<!-- postman-cli:installation:end -->

Read CLAUDE.md for architecture and product rules.

## Branch workflow

- Start every task from current `origin/dev` in a dedicated task branch, such as
  `feature/<task>`, `fix/<task>`, or `chore/<task>`.
- Task pull requests target `dev`. Do not commit or push directly to `dev` or `main`.
- Release pull requests go from this repository's `dev` to `main`. Preserve history
  with a merge commit (no squash/rebase for releases).
- Sync `main` back into `dev` with a merge-commit PR after release.
- Keep both long-lived branches. Do not bypass checks, force push, or disable branch protection.
- A successful push/CI is not proof of a successful production deployment.
- Full workflow and verification requirements: docs/DEVELOPMENT.md.
