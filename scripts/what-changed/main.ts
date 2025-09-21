#!/usr/bin/env node

import * as core from '@actions/core'
import * as exec from '@actions/exec'

interface TurboList {
  packageManager: string
  packages: {
    count: number
    items: {
      name: string
      path: string
    }[]
  }
}

const { stdout } = await exec.getExecOutput('turbo ls', ['--affected', '--output=json'])
const { packages } = JSON.parse(stdout) as TurboList
core.setOutput('packages', packages)
