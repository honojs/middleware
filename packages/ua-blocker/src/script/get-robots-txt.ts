import { writeFile, mkdir } from 'node:fs/promises'

const data = await fetch(
  'https://raw.githubusercontent.com/ai-robots-txt/ai.robots.txt/refs/heads/main/robots.json'
).then((res) => res.json())

// check if data directory exists
const dataDir = 'src/data'
await mkdir(dataDir, { recursive: true })

// write json file
await writeFile(`${dataDir}/robots.json`, JSON.stringify(data, null, 2))

console.log('☑︎ Fetched robots.json data successfully')
