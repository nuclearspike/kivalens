import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { localBranchProblem, pushArgs } from '../../scripts/deployPush.mjs'

// Paul, 2026-11-20: work reaches master on GitHub and Heroku only from local master. The pre-push hook
// judges a push by its source ref, and scripts/deploy.mjs once pushed `<sha>:refs/heads/master`, which
// the hook refuses, so no deploy could get past it.

const A = 'a'.repeat(40)
const B = 'b'.repeat(40)

describe('a deploy pushes', () => {
  it('local master by name, never a commit id', () => {
    expect(pushArgs('origin', 'master')).toEqual(['push', 'origin', 'refs/heads/master:refs/heads/master'])
  })

  it('only while local master is the gated commit', () => {
    expect(localBranchProblem(A, A, 'master')).toBeNull()
    expect(localBranchProblem(B, A, 'master')).toMatch(/^local master is at bbbbbbbb, not aaaaaaaa\. Merge the commit into master in the main checkout first/)
    expect(localBranchProblem(null, A, 'master')).toBe('there is no local master')
  })

  // What a pre-push hook is told for each refspec: the hook sees the source as typed.
  it('with a source a pre-push hook sees as refs/heads/master', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kl-deploy-push-'))
    try {
      const run = (cwd: string, ...a: string[]) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      run(dir, 'init', '-q', '--bare', 'remote.git')
      const work = path.join(dir, 'work')
      fs.mkdirSync(work)
      run(work, 'init', '-q', '-b', 'master')
      run(work, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'a')
      const hooks = path.join(dir, 'hooks')
      fs.mkdirSync(hooks)
      const seen = path.join(dir, 'seen')
      fs.writeFileSync(path.join(hooks, 'pre-push'), `#!/bin/sh\ncat >> "${seen}"\nexit 1\n`, { mode: 0o755 })
      const push = (...a: string[]) => {
        try {
          run(work, '-c', `core.hooksPath=${hooks}`, ...a)
        } catch {
          // the hook refuses every push; only what it was told matters here
        }
      }
      const sha = run(work, 'rev-parse', 'HEAD').trim()
      push('push', '../remote.git', `${sha}:refs/heads/master`)
      push(...pushArgs('../remote.git', 'master'))
      const sources = fs.readFileSync(seen, 'utf8').trim().split('\n').map((l) => l.split(' ')[0])
      expect(sources).toEqual([sha, 'refs/heads/master'])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
