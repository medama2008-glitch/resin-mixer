// dist を削除する。
// Windows + OneDrive 配下では Node の fs.rmSync がネイティブクラッシュ (0xC0000409) するため、
// OS のコマンドに委譲する。Vite の emptyOutDir も同じ理由で落ちるので、ビルド前に必ずこれを通す。
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
if (!existsSync(dist)) process.exit(0)

const r =
  process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/c', 'rmdir', '/s', '/q', dist], { stdio: 'inherit' })
    : spawnSync('rm', ['-rf', dist], { stdio: 'inherit' })

if (r.status !== 0) {
  console.error(`dist の削除に失敗しました (exit ${r.status})`)
  process.exit(r.status ?? 1)
}
