import { hc } from 'hono/client'
import type { AppType } from '.'

const client = hc<AppType>('http://localhost:8000')

const main = async () => {
  const response = await client.posts.$post({
    json: { id: 123, title: 'Hello World`' },
  })
  const data = await response.json()
  console.log(data)
}

main()
