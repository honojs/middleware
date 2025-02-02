// @ts-check
const fs = require('node:fs')
const path = require('node:path')

// https://github.com/samchon/typia/issues/1432
// typia generated files have some type errors

const generatedFiles = fs
  .readdirSync(path.resolve(__dirname, '../test-generated'))
  .map((file) => path.resolve(__dirname, '../test-generated', file))

for (const file of generatedFiles) {
  const content = fs.readFileSync(file, 'utf8')
  const lines = content.split('\n')
  const distLines = []
  for (const line of lines) {
    if (
      line.includes('._httpHeaderReadNumber(') ||
      line.includes('._httpHeaderReadBigint(') ||
      line.includes('._httpHeaderReadBoolean(')
    )
      distLines.push(`// @ts-ignore`)
    distLines.push(line)
  }

  fs.writeFileSync(file, distLines.join('\n'))
}
