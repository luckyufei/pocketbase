import { defineConfig } from 'vitepress'

// 英文侧边栏配置
const sidebarEn = [
  {
    text: 'Introduction',
    items: [
      { text: 'Overview', link: '/en/introduction' },
      { text: 'How to use', link: '/en/how-to-use' },
      { text: 'CLI Commands', link: '/en/cli' },
      { text: 'Collections', link: '/en/collections' },
      { text: 'API rules and filters', link: '/en/api-rules-and-filters' },
      { text: 'Authentication', link: '/en/authentication' },
      { text: 'Files handling', link: '/en/files-handling' },
      { text: 'Working with relations', link: '/en/working-with-relations' },
      { text: 'Extending PocketBase', link: '/en/use-as-framework' },
    ]
  },
  {
    text: 'Web APIs',
    items: [
      { text: 'Records', link: '/en/api/records' },
      { text: 'Realtime', link: '/en/api/realtime' },
      { text: 'Files', link: '/en/api/files' },
      { text: 'Collections', link: '/en/api/collections' },
      { text: 'Settings', link: '/en/api/settings' },
      { text: 'Logs', link: '/en/api/logs' },
      { text: 'Crons', link: '/en/api/crons' },
      { text: 'Backups', link: '/en/api/backups' },
      { text: 'Health', link: '/en/api/health' },
    ]
  },
  {
    text: 'Go SDK',
    collapsed: true,
    items: [
      { text: 'Overview', link: '/en/go/overview' },
      { text: 'Event hooks', link: '/en/go/event-hooks' },
      { text: 'Routing', link: '/en/go/routing' },
      { text: 'Database', link: '/en/go/database' },
      { text: 'Records', link: '/en/go/records' },
      { text: 'Collections', link: '/en/go/collections' },
      { text: 'Migrations', link: '/en/go/migrations' },
      { text: 'Jobs scheduling', link: '/en/go/jobs-scheduling' },
      { text: 'Sending emails', link: '/en/go/sending-emails' },
      { text: 'Rendering templates', link: '/en/go/rendering-templates' },
      { text: 'Console commands', link: '/en/go/console-commands' },
      { text: 'Realtime', link: '/en/go/realtime' },
      { text: 'Filesystem', link: '/en/go/filesystem' },
      { text: 'Logging', link: '/en/go/logging' },
      { text: 'Testing', link: '/en/go/testing' },
      { text: 'Miscellaneous', link: '/en/go/miscellaneous' },
      { text: 'Record proxy', link: '/en/go/record-proxy' },
      { text: 'Analytics', link: '/en/go/analytics' },
    ]
  },
  {
    text: 'JS SDK',
    collapsed: true,
    items: [
      { text: 'Overview', link: '/en/js/overview' },
      { text: 'Event hooks', link: '/en/js/event-hooks' },
      { text: 'Routing', link: '/en/js/routing' },
      { text: 'Database', link: '/en/js/database' },
      { text: 'Records', link: '/en/js/records' },
      { text: 'Collections', link: '/en/js/collections' },
      { text: 'Migrations', link: '/en/js/migrations' },
      { text: 'Jobs scheduling', link: '/en/js/jobs-scheduling' },
      { text: 'Sending emails', link: '/en/js/sending-emails' },
      { text: 'Rendering templates', link: '/en/js/rendering-templates' },
      { text: 'Console commands', link: '/en/js/console-commands' },
      { text: 'Sending HTTP requests', link: '/en/js/sending-http-requests' },
      { text: 'Realtime', link: '/en/js/realtime' },
      { text: 'Filesystem', link: '/en/js/filesystem' },
      { text: 'Logging', link: '/en/js/logging' },
    ]
  },
  {
    text: 'Advanced',
    collapsed: true,
    items: [
      { text: 'PostgreSQL', link: '/en/postgresql' },
      { text: 'Jobs', link: '/en/jobs' },
      { text: 'Process Manager', link: '/en/process-manager' },
      { text: 'Secrets', link: '/en/secrets' },
      { text: 'Proxy', link: '/en/proxy' },
    ]
  },
  {
    text: 'Going to production',
    link: '/en/going-to-production'
  },
  {
    text: 'FAQ',
    link: '/en/faq'
  }
]

// 中文侧边栏配置
const sidebarZh = [
  {
    text: '入门',
    items: [
      { text: '概述', link: '/zh/introduction' },
      { text: '如何使用', link: '/zh/how-to-use' },
      { text: 'CLI 命令', link: '/zh/cli' },
      { text: '数据集合', link: '/zh/collections' },
      { text: 'API 规则与过滤器', link: '/zh/api-rules-and-filters' },
      { text: '身份认证', link: '/zh/authentication' },
      { text: '文件处理', link: '/zh/files-handling' },
      { text: '关联关系', link: '/zh/working-with-relations' },
      { text: '扩展 PocketBase', link: '/zh/use-as-framework' },
    ]
  },
  {
    text: 'Web API',
    items: [
      { text: '记录 (Records)', link: '/zh/api/records' },
      { text: '实时 (Realtime)', link: '/zh/api/realtime' },
      { text: '文件 (Files)', link: '/zh/api/files' },
      { text: '集合 (Collections)', link: '/zh/api/collections' },
      { text: '设置 (Settings)', link: '/zh/api/settings' },
      { text: '日志 (Logs)', link: '/zh/api/logs' },
      { text: '定时任务 (Crons)', link: '/zh/api/crons' },
      { text: '备份 (Backups)', link: '/zh/api/backups' },
      { text: '健康检查 (Health)', link: '/zh/api/health' },
    ]
  },
  {
    text: 'Go SDK',
    collapsed: true,
    items: [
      { text: '概述', link: '/zh/go/overview' },
      { text: '事件钩子', link: '/zh/go/event-hooks' },
      { text: '路由', link: '/zh/go/routing' },
      { text: '数据库', link: '/zh/go/database' },
      { text: '记录操作', link: '/zh/go/records' },
      { text: '集合操作', link: '/zh/go/collections' },
      { text: '数据迁移', link: '/zh/go/migrations' },
      { text: '任务调度', link: '/zh/go/jobs-scheduling' },
      { text: '发送邮件', link: '/zh/go/sending-emails' },
      { text: '模板渲染', link: '/zh/go/rendering-templates' },
      { text: '控制台命令', link: '/zh/go/console-commands' },
      { text: '实时通信', link: '/zh/go/realtime' },
      { text: '文件系统', link: '/zh/go/filesystem' },
      { text: '日志记录', link: '/zh/go/logging' },
      { text: '测试', link: '/zh/go/testing' },
      { text: '其他', link: '/zh/go/miscellaneous' },
      { text: 'Record 代理', link: '/zh/go/record-proxy' },
      { text: '用户行为分析', link: '/zh/go/analytics' },
    ]
  },
  {
    text: 'JS SDK',
    collapsed: true,
    items: [
      { text: '概述', link: '/zh/js/overview' },
      { text: '事件钩子', link: '/zh/js/event-hooks' },
      { text: '路由', link: '/zh/js/routing' },
      { text: '数据库', link: '/zh/js/database' },
      { text: '记录操作', link: '/zh/js/records' },
      { text: '集合操作', link: '/zh/js/collections' },
      { text: '数据迁移', link: '/zh/js/migrations' },
      { text: '任务调度', link: '/zh/js/jobs-scheduling' },
      { text: '发送邮件', link: '/zh/js/sending-emails' },
      { text: '模板渲染', link: '/zh/js/rendering-templates' },
      { text: '控制台命令', link: '/zh/js/console-commands' },
      { text: 'HTTP 请求', link: '/zh/js/sending-http-requests' },
      { text: '实时通信', link: '/zh/js/realtime' },
      { text: '文件系统', link: '/zh/js/filesystem' },
      { text: '日志记录', link: '/zh/js/logging' },
    ]
  },
  {
    text: '高级',
    collapsed: true,
    items: [
      { text: 'PostgreSQL', link: '/zh/postgresql' },
      { text: '任务队列', link: '/zh/jobs' },
      { text: '进程管理器', link: '/zh/process-manager' },
      { text: '密钥管理', link: '/zh/secrets' },
      { text: '代理网关', link: '/zh/proxy' },
    ]
  },
  {
    text: '生产部署',
    link: '/zh/going-to-production'
  },
  {
    text: '常见问题',
    link: '/zh/faq'
  }
]

export default defineConfig({
  title: 'PocketBase',
  description: 'Open Source backend in 1 file',
  
  // Ignore existing dead links that are not part of this project
  ignoreDeadLinks: [
    /\/jsvm\/index/
  ],
  
  head: [
    ['link', { rel: 'icon', href: '/images/logo.svg' }],
  ],

  locales: {
    en: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      themeConfig: {
        nav: [
          { text: 'Docs', link: '/en/introduction' },
          { text: 'FAQ', link: '/en/faq' },
          { text: 'GitHub', link: 'https://github.com/pocketbase/pocketbase' }
        ],
        sidebar: {
          '/en/': sidebarEn
        }
      }
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      themeConfig: {
        nav: [
          { text: '文档', link: '/zh/introduction' },
          { text: '常见问题', link: '/zh/faq' },
          { text: 'GitHub', link: 'https://github.com/pocketbase/pocketbase' }
        ],
        sidebar: {
          '/zh/': sidebarZh
        },
        outlineTitle: '本页目录',
        lastUpdatedText: '最后更新',
        docFooter: {
          prev: '上一页',
          next: '下一页'
        }
      }
    }
  },

  themeConfig: {
    logo: '/images/logo.svg',

    outline: {
      level: 'deep'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/pocketbase/pocketbase' }
    ],

    search: {
      provider: 'local'
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025-2026 PocketBase'
    }
  }
})
