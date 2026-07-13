#!/usr/bin/env node

import * as core from '@actions/core'
import * as exec from '@actions/exec'

const exclude = new Set(['@hono/bun-compress', '@hono/bun-transpiler', '@hono/node-ws'])
const since = core.getInput('since') || 'origin/main'

const { stdout } = await exec.getExecOutput('pnpm', [
  'list',
  '--recursive',
  '--depth=-1',
  '--json',
  // Select workspace packages whose files changed since `since`.
  '--filter',
  `[${since}]`,
])

const changed = []

for (const workspace of JSON.parse(stdout || '[]')) {
  if (workspace.private) {
    continue
  }
  if (!exclude.has(workspace.name)) {
    changed.push(workspace.name.replace(/^@hono\//, ''))
  }
}

core.setOutput('packages', changed)
