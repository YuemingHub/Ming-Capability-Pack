/**
 * installer 单元测试：安装命令解析、参数构建、profile 定位、安装核对
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildInstallArgs,
  buildInstallCommand,
  checkInstalled,
  dshBinCandidates,
  matchReason,
  parseInstallCommand,
  profileDirsOf,
  resolveDshHome,
  resolveProfileName,
} from '../dist/internals.js'

// ---------- parseInstallCommand ----------

test('parseInstallCommand 解析完整命令（含 --profile）', () => {
  const parsed = parseInstallCommand('dsh plugin --profile web add dsh-excel-tools')
  assert.equal(parsed.source, 'dsh-excel-tools')
  assert.equal(parsed.profile, 'web')
})

test('parseInstallCommand 无 profile 时 source 正确、profile 为空', () => {
  const parsed = parseInstallCommand('dsh plugin add foo')
  assert.equal(parsed.source, 'foo')
  assert.equal(parsed.profile, undefined)
})

test('parseInstallCommand 兼容 dsh.cmd 与 flag 后置', () => {
  assert.equal(parseInstallCommand('dsh.cmd plugin add bar').source, 'bar')
  const parsed = parseInstallCommand('dsh plugin add baz --profile web')
  assert.equal(parsed.source, 'baz')
  assert.equal(parsed.profile, 'web')
})

test('parseInstallCommand 支持 github 源', () => {
  assert.equal(parseInstallCommand('dsh plugin add github:owner/repo').source, 'github:owner/repo')
})

test('parseInstallCommand 拒绝非 dsh 命令（防任意命令注入）', () => {
  assert.throws(() => parseInstallCommand('rm -rf /'), /必须以 dsh 开头/)
  assert.throws(() => parseInstallCommand('echo hi'), /必须以 dsh 开头/)
  assert.throws(() => parseInstallCommand(''), /安装命令为空/)
})

test('parseInstallCommand 拒绝缺少 plugin 子命令或源', () => {
  assert.throws(() => parseInstallCommand('dsh --version'), /缺少 plugin 子命令/)
  assert.throws(() => parseInstallCommand('dsh plugin --profile web add'), /缺少插件源/)
})

// ---------- buildInstallArgs / buildInstallCommand ----------

test('buildInstallArgs 有 dsh bin 时 bin.js 在前', () => {
  const args = buildInstallArgs('x', 'ming', 'E:\\dsh\\bin.js')
  assert.deepEqual(args, ['E:\\dsh\\bin.js', 'plugin', '--profile', 'ming', 'add', 'x'])
})

test('buildInstallArgs 无 dsh bin 时直接用 dsh 可执行文件', () => {
  const args = buildInstallArgs('x', 'ming', null)
  assert.deepEqual(args, ['plugin', '--profile', 'ming', 'add', 'x'])
})

test('buildInstallCommand 有 bin.js 时命令以 node 开头（Windows 直接 spawn 脚本会 EFTYPE）', () => {
  const { args, command } = buildInstallCommand('x', 'ming', 'E:\\dsh\\bin.js')
  assert.deepEqual(args, ['E:\\dsh\\bin.js', 'plugin', '--profile', 'ming', 'add', 'x'])
  assert.ok(command.startsWith('node E:\\dsh\\bin.js plugin --profile ming add x'))
})

test('buildInstallCommand 无 bin.js 时命令直接用 dsh', () => {
  const { args, command } = buildInstallCommand('x', 'ming', null)
  assert.deepEqual(args, ['plugin', '--profile', 'ming', 'add', 'x'])
  assert.equal(command, 'dsh plugin --profile ming add x')
})

// ---------- dshBinCandidates / resolveDshHome / profileDirsOf ----------

test('dshBinCandidates 优先环境变量，并包含宿主安装位置', () => {
  const old = process.env.DSH_BIN
  process.env.DSH_BIN = 'C:\\custom\\bin.js'
  try {
    const candidates = dshBinCandidates('D:\\app\\dist\\services')
    assert.equal(candidates[0], 'C:\\custom\\bin.js')
    // 随 profile 安装：dist/services → 上四层到 node_modules
    assert.ok(candidates.some(c => c.endsWith('@deepseek-ai\\dsh\\lib\\bin.js') || c.endsWith('@deepseek-ai/dsh/lib/bin.js')))
    assert.ok(candidates.length >= 3)
  } finally {
    if (old === undefined) delete process.env.DSH_BIN
    else process.env.DSH_BIN = old
  }
})

test('resolveDshHome 用 DSH_HOME，缺省回落到主目录 .dsh', () => {
  const old = process.env.DSH_HOME
  process.env.DSH_HOME = 'X:\\dsh-home'
  try {
    assert.equal(resolveDshHome(), 'X:\\dsh-home')
  } finally {
    if (old === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = old
  }
})

test('profileDirsOf 指向 profiles 目录', () => {
  assert.deepEqual(profileDirsOf('X:\\home'), ['X:\\home\\profiles'])
})

// ---------- resolveProfileName（含临时 DSH_HOME）----------

async function withTempDshHome(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'ming-test-'))
  const oldHome = process.env.DSH_HOME
  const oldProfile = process.env.DSH_PROFILE
  process.env.DSH_HOME = dir
  delete process.env.DSH_PROFILE
  try {
    return await fn(dir)
  } finally {
    if (oldHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = oldHome
    if (oldProfile === undefined) delete process.env.DSH_PROFILE
    else process.env.DSH_PROFILE = oldProfile
  }
}

test('resolveProfileName 优先 DSH_PROFILE 环境变量', async () => {
  await withTempDshHome(async () => {
    process.env.DSH_PROFILE = 'web'
    assert.equal(await resolveProfileName(), 'web')
  })
})

test('resolveProfileName 扫描 profiles 找到含本插件的 profile', async () => {
  await withTempDshHome(async (home) => {
    await mkdir(join(home, 'profiles', 'ming'), { recursive: true })
    await writeFile(
      join(home, 'profiles', 'ming', 'package.json'),
      JSON.stringify({ name: 'profile-ming', dependencies: { '@mingworkbench/capability-pack': '0.7.0' } }),
    )
    assert.equal(await resolveProfileName(), 'ming')
  })
})

test('resolveProfileName 找不到时回落到 ming', async () => {
  await withTempDshHome(async () => {
    assert.equal(await resolveProfileName(), 'ming')
  })
})

// ---------- checkInstalled ----------

test('checkInstalled 在 profile package.json 中确认已安装', async () => {
  await withTempDshHome(async (home) => {
    await mkdir(join(home, 'profiles', 'ming'), { recursive: true })
    await writeFile(
      join(home, 'profiles', 'ming', 'package.json'),
      JSON.stringify({ name: 'profile-ming', dependencies: { 'dsh-excel-tools': '^1.0.0' } }),
    )
    const result = await checkInstalled('dsh-excel-tools')
    assert.equal(result.confirmed, true)
    assert.match(result.detail, /dsh-excel-tools/)
  })
})

test('checkInstalled 未安装时如实报告未确认', async () => {
  await withTempDshHome(async (home) => {
    await mkdir(join(home, 'profiles', 'ming'), { recursive: true })
    await writeFile(join(home, 'profiles', 'ming', 'package.json'), JSON.stringify({ name: 'profile-ming' }))
    const result = await checkInstalled('no-such-plugin')
    assert.equal(result.confirmed, false)
  })
})

test('checkInstalled 通过 profiles/node_modules 目录兜底确认', async () => {
  await withTempDshHome(async (home) => {
    await mkdir(join(home, 'profiles', 'node_modules', 'dsh-deploy-tools'), { recursive: true })
    const result = await checkInstalled('dsh-deploy-tools')
    assert.equal(result.confirmed, true)
  })
})

// ---------- matchReason ----------

test('matchReason 命中关键词时给出相关性说明', () => {
  const plugin = { name: 'dsh-excel-tools', description: { en: 'Excel tools', zh: 'Excel 报表工具' }, category: 'tools', stars: 132 }
  assert.match(matchReason(plugin, 'excel 报表'), /命中「excel」/)
})

test('matchReason 未命中时说明是供对比的候选', () => {
  const plugin = { name: 'dsh-pdf-tools', description: { en: 'PDF tools' }, category: 'tools', stars: 0 }
  assert.match(matchReason(plugin, '网站部署'), /供对比/)
})
