import { hc } from 'hono/client'
import type { AppType } from '.'

const client = hc<AppType>('http://localhost:8080')

const main = async () => {
  const response = await client.users[':id'].$get({
    param: {
      id: '123',
    },
  })
  const data = await response.json()
  console.log(data)
}

main()
