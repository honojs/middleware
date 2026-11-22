import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'

describe('react entry point', () => {
  it('Should be marked as a Client Component module', async () => {
    const source = await readFile(new URL('./react.tsx', import.meta.url), 'utf8')
    // React only treats a module as a Client Component when the directive is the
    // first statement, so it must come before the imports. Without it, importing
    // this entry from a Server Component evaluates `React.createContext()` on the
    // server and throws "createContext only works in Client Components".
    expect(source.split(/\r?\n/)[0]).toBe("'use client'")
  })
})
