import { format } from 'prettier'
import assert from 'node:assert'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { argv, env } from 'node:process'

const initCwd = env['INIT_CWD']
const npmPackageVersion = argv[2]

assert(initCwd, 'INIT_CWD environment variable is not set')
assert(npmPackageVersion, 'npm_package_version environment variable is not set')

const denoJsonPath = join(initCwd, 'deno.json')
const denoJson = JSON.stringify(
  { ...JSON.parse(await readFile(denoJsonPath, 'utf-8')), version: npmPackageVersion },
  null,
  2
)
await writeFile(denoJsonPath, await format(denoJson, { parser: 'json' }))
