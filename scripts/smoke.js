/**
 * 冒烟验证脚本
 *
 * 依次执行：
 *   1. typecheck
 *   2. build
 *   3. [可选] 真机 headless 调用（需要 DSH_HOME + DSH_BIN）
 *
 * 用法：
 *   node scripts/smoke.js
 *   DSH_HOME="C:\Users\Administrator\.dsh" DSH_BIN="E:/claw/DSH Desktop/resources/app/node_modules/@deepseek-ai/dsh/lib/bin.js" node scripts/smoke.js
 */

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function run(title, cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n==> ${title}`)
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      cwd: ROOT,
      ...opts,
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${title} 失败，退出码 ${code}`))
    })
  })
}

async function main() {
  const failures = []

  // 1. typecheck
  try {
    await run('typecheck', 'npm', ['run', 'typecheck'])
  } catch (e) {
    failures.push(e.message)
  }

  // 2. build
  try {
    await run('build', 'npm', ['run', 'build'])
  } catch (e) {
    failures.push(e.message)
  }

  // 3. 单元测试
  try {
    await run('test', 'npm', ['run', 'test'])
  } catch (e) {
    failures.push(e.message)
  }

  // 4. 可选真机验证
  const dshBin = process.env.DSH_BIN
  const dshHome = process.env.DSH_HOME
  if (dshBin && existsSync(dshBin) && dshHome) {
    try {
      const goal = '在当前目录创建 smoke-test.html，内容为 <h1>Ming Smoke OK</h1>'
      const prompt = `请调用 ming_auto 工具：${goal}`
      const profile = process.env.DSH_PROFILE || 'ming'
      await run('harness smoke', process.execPath, [
        dshBin,
        '--profile', profile,
        prompt,
      ])
      console.log('\n==> 真机验证：通过')
    } catch (e) {
      failures.push(e.message)
    }
  } else {
    console.log('\n==> 跳过真机验证（未设置 DSH_BIN / DSH_HOME）')
  }

  console.log('\n==> 结果')
  if (failures.length === 0) {
    console.log('全部通过')
    process.exit(0)
  } else {
    console.log(`${failures.length} 项失败：`)
    failures.forEach((f) => console.log(`  - ${f}`))
    process.exit(1)
  }
}

main()
