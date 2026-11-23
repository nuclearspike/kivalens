// How a deploy pushes. Paul, 2026-11-20: "all worktrees should merge to main before pushing". GitHub's
// and Heroku's master take work only from local master, after it was merged there, and the pre-push hook
// (~/.git-hooks/pre-push) refuses every other source for master, a bare commit id included. So a deploy
// pushes local master, and only while local master is the commit it gated.

/** The `git push` arguments for one remote: the local branch by name, which the hook accepts; a commit id it refuses. */
export function pushArgs(remote, branch) {
  return ['push', remote, `refs/heads/${branch}:refs/heads/${branch}`]
}

/** Why local `branch` cannot go out as this deploy of `sha`; null when it is exactly that commit. */
export function localBranchProblem(localSha, sha, branch) {
  if (!localSha) return `there is no local ${branch}`
  if (localSha !== sha) {
    return `local ${branch} is at ${localSha.slice(0, 8)}, not ${sha.slice(0, 8)}. Merge the commit into ${branch} in the main checkout first: a deploy pushes local ${branch}`
  }
  return null
}
