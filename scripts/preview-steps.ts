// public/recipes.json の各レシピについて、手順タブの文言をコンソールに出す (確認用)。
// 実行: npx vitest run scripts/preview-steps.ts  ではなく  npx tsx scripts/preview-steps.ts
// tsx が無い環境では npx vite-node scripts/preview-steps.ts でも可。
import { readFileSync } from 'node:fs'
import { validateInput } from '../src/lib/validate'
import { buildWorkflow } from '../src/lib/workflow'
import { setGramResolution } from '../src/lib/calc'

setGramResolution('coarse')
const data: unknown = JSON.parse(readFileSync(new URL('../public/recipes.json', import.meta.url), 'utf8'))
const v = validateInput(data)
if (!v.ok) {
  console.error(v.errors.join('\n'))
  process.exit(1)
}
for (const r of v.recipes) {
  console.log(`\n=== ${r.id} (${r.status}) ===`)
  const cards = buildWorkflow(r, { targetGrams: 100, measuredBase: null, margin: 0.05, premixActual: null })
  cards.forEach((c, i) => {
    console.log(`${i + 1}. [${c.title}] ${c.text}`)
    for (const n of c.notes) console.log(`     note: ${n}`)
  })
}
