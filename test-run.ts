// 测试脚本
import { mingAuto, searchPlugins } from './src/index.standalone.js'

async function test() {
  console.log('=== 测试 1: 搜索插件 ===')
  const plugins = await searchPlugins('website', 3)
  console.log('搜索结果:', JSON.stringify(plugins, null, 2))

  console.log('\n=== 测试 2: 完整分析 ===')
  await mingAuto('我想做一个摄影作品集网站')

  console.log('\n=== 测试 3: 数据处理 ===')
  await mingAuto('帮我把 CSV 数据可视化')
}

test().catch(console.error)
