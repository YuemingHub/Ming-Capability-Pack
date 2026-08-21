// Ming Capability Pack - 增强版知识图谱（扩展关键词）

const INTENT_CAPABILITY_MAP = {
  // 代码相关
  'code-development': {
    capabilities: ['code-generation', 'code-review', 'testing'],
    keywords: [
      'code', 'programming', 'function', 'api', 'test', 'debug',
      'review', 'lint', 'format', 'refactor',
      '代码', '编程', '函数', '测试', '调试', '审查', '格式化', '重构',
      'typescript', 'javascript', 'python', 'react', 'vue'
    ],
    searchTerms: ['code', 'programming', 'test', 'lint', 'review'],
    scene: 'development',
    priority: 3
  },

  // 部署运维
  'deployment': {
    capabilities: ['ci-cd', 'containerization', 'monitoring'],
    keywords: [
      'deploy', 'production', 'docker', 'kubernetes', 'ci/cd', 'pipeline',
      'aws', 'azure', 'vercel', 'netlify', 'server', 'hosting',
      '部署', '生产', '容器', '编排', '持续集成', '服务器',
      '上线', '发布', '运维'
    ],
    searchTerms: ['deploy', 'docker', 'ci/cd', 'production', 'monitoring'],
    scene: 'deployment',
    priority: 3
  },

  // 文档管理
  'documentation': {
    capabilities: ['docs-generation', 'readme', 'api-docs'],
    keywords: [
      'docs', 'documentation', 'readme', 'api docs', 'wiki', 'guide',
      'tutorial', 'manual', 'changelog', 'contributing',
      '文档', '说明', '手册', '指南', '教程', '更新日志',
      '注释', '注解', '说明文档'
    ],
    searchTerms: ['docs', 'documentation', 'readme', 'api'],
    scene: 'documentation',
    priority: 4
  },

  // 安全审查
  'security-review': {
    capabilities: ['security-scan', 'vulnerability-check', 'auth-testing'],
    keywords: [
      'security', 'vulnerability', 'auth', 'permission', 'audit', 'scan',
      'encryption', 'token', 'oauth', 'jwt',
      '安全', '漏洞', '权限', '扫描', '审计', '加密', '认证',
      '检查权限', '安全检查'
    ],
    searchTerms: ['security', 'auth', 'permission', 'vulnerability', 'audit'],
    scene: 'security',
    priority: 4
  },

  // 性能优化
  'performance-optimization': {
    capabilities: ['profiling', 'caching', 'optimization'],
    keywords: [
      'performance', 'optimize', 'cache', 'speed', 'benchmark', 'profile',
      'memory', 'cpu', 'latency', 'throughput',
      '性能', '优化', '缓存', '加速', '基准', '内存', '延迟',
      '提高性能', '优化性能'
    ],
    searchTerms: ['performance', 'optimize', 'cache', 'speed'],
    scene: 'performance',
    priority: 4
  },

  // 数据库操作
  'database-operations': {
    capabilities: ['sql-optimization', 'migration', 'backup'],
    keywords: [
      'database', 'sql', 'query', 'migration', 'backup', 'restore',
      'mysql', 'postgresql', 'sqlite', 'mongodb',
      '数据库', '查询', '迁移', '备份', '恢复', 'SQL',
      '优化查询', '数据库性能'
    ],
    searchTerms: ['database', 'sql', 'query', 'migration'],
    scene: 'database',
    priority: 4
  },

  // 监控告警
  'monitoring-alerting': {
    capabilities: ['monitoring', 'alerting', 'logging'],
    keywords: [
      'monitor', 'monitoring', 'alert', 'alerting', 'logging', 'log',
      'metrics', 'dashboard', 'notification',
      '监控', '告警', '日志', '指标', '仪表盘', '通知',
      '设置监控', '监控告警'
    ],
    searchTerms: ['monitor', 'alert', 'logging', 'metrics'],
    scene: 'monitoring',
    priority: 4
  },

  // 自动化工作流
  'automation': {
    capabilities: ['workflow-automation', 'scheduling', 'notification'],
    keywords: [
      'automation', 'workflow', 'schedule', 'trigger', 'cron',
      'script', 'batch', 'automatic',
      '工作流', '自动化', '定时', '触发', '脚本', '批量'
    ],
    searchTerms: ['workflow', 'automation', 'schedule'],
    scene: 'automation',
    priority: 5
  }
}

export { INTENT_CAPABILITY_MAP }
