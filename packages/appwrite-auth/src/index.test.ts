import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

/******
 The tests will be added by creating
 mocking server inside the `test.server` file
 after Appwrite will release version 1.5 officially

 *****/

describe('Appwrite middleware', () => {
  const app = new Hono()

  it('should be 1', () => {
    expect(1).toBe(1)
  })
})

describe.skip('Appwrite email Helper', () => {
  const app = new Hono()


})

describe.skip('Appwrite oauth2 helper', () => {
  const app = new Hono()


})
