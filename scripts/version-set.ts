import assert from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { argv, env } from 'node:process'

const initCwd = env['INIT_CWD']
const npmPackageVersion = argv[2]

assert(initCwd, 'INIT_CWD environment variable is not set')
assert(npmPackageVersion, 'npm_package_version environment variable is not set')

const denoJsonPath = join(initCwd, 'deno.json')
const denoJson = JSON.stringify(
  {
    ...(JSON.parse(await readFile(denoJsonPath, 'utf-8')) as Record<string, unknown>),
    version: npmPackageVersion,
  },
  null,
  2
)
await writeFile(denoJsonPath, denoJson)
execFileSync('vp', ['fmt', denoJsonPath], { stdio: 'inherit' })
