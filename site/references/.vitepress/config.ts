import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'PocketBase',
  description: 'Open Source backend in 1 file',
  
  head: [
    ['link', { rel: 'icon', href: '/images/logo.svg' }],
  ],

  themeConfig: {
    logo: '/images/logo.svg',
    
    nav: [
      { text: 'Docs', link: '/introduction' },
      { text: 'FAQ', link: '/faq' },
      { text: 'GitHub', link: 'https://github.com/pocketbase/pocketbase' }
    ],

    sidebar: {
      '/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Overview', link: '/introduction' },
            { text: 'How to use', link: '/how-to-use' },
            { text: 'CLI Commands', link: '/cli' },
            { text: 'Collections', link: '/collections' },
            { text: 'API rules and filters', link: '/api-rules-and-filters' },
            { text: 'Authentication', link: '/authentication' },
            { text: 'Files handling', link: '/files-handling' },
            { text: 'Working with relations', link: '/working-with-relations' },
            { text: 'Use as framework', link: '/use-as-framework' },
          ]
        },
        {
          text: 'Web APIs',
          items: [
            { text: 'Records', link: '/api/records' },
            { text: 'Realtime', link: '/api/realtime' },
            { text: 'Files', link: '/api/files' },
            { text: 'Collections', link: '/api/collections' },
            { text: 'Settings', link: '/api/settings' },
            { text: 'Logs', link: '/api/logs' },
            { text: 'Traces', link: '/api/traces' },
            { text: 'Analytics', link: '/api/analytics' },
            { text: 'Crons', link: '/api/crons' },
            { text: 'Backups', link: '/api/backups' },
            { text: 'Health', link: '/api/health' },
          ]
        },
        {
          text: 'Go SDK',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/go/overview' },
            { text: 'Event hooks', link: '/go/event-hooks' },
            { text: 'Routing', link: '/go/routing' },
            { text: 'Database', link: '/go/database' },
            { text: 'Records', link: '/go/records' },
            { text: 'Collections', link: '/go/collections' },
            { text: 'Migrations', link: '/go/migrations' },
            { text: 'Jobs scheduling', link: '/go/jobs-scheduling' },
            { text: 'Sending emails', link: '/go/sending-emails' },
            { text: 'Rendering templates', link: '/go/rendering-templates' },
            { text: 'Console commands', link: '/go/console-commands' },
            { text: 'Realtime', link: '/go/realtime' },
            { text: 'Filesystem', link: '/go/filesystem' },
            { text: 'Logging', link: '/go/logging' },
            { text: 'Testing', link: '/go/testing' },
            { text: 'Miscellaneous', link: '/go/miscellaneous' },
            { text: 'Record proxy', link: '/go/record-proxy' },
          ]
        },
        {
          text: 'JS SDK',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/js/overview' },
            { text: 'Event hooks', link: '/js/event-hooks' },
            { text: 'Routing', link: '/js/routing' },
            { text: 'Database', link: '/js/database' },
            { text: 'Records', link: '/js/records' },
            { text: 'Collections', link: '/js/collections' },
            { text: 'Migrations', link: '/js/migrations' },
            { text: 'Jobs scheduling', link: '/js/jobs-scheduling' },
            { text: 'Sending emails', link: '/js/sending-emails' },
            { text: 'Rendering templates', link: '/js/rendering-templates' },
            { text: 'Console commands', link: '/js/console-commands' },
            { text: 'Sending HTTP requests', link: '/js/sending-http-requests' },
            { text: 'Realtime', link: '/js/realtime' },
            { text: 'Filesystem', link: '/js/filesystem' },
            { text: 'Logging', link: '/js/logging' },
          ]
        },
        {
          text: 'Advanced',
          collapsed: true,
          items: [
            { text: 'PostgreSQL', link: '/postgresql' },
            { text: 'Jobs 任务队列', link: '/jobs' },
            { text: 'Secrets 密钥管理', link: '/secrets' },
            { text: 'Proxy 代理网关', link: '/proxy' },
          ]
        },
        {
          text: 'Going to production',
          link: '/going-to-production'
        },
        {
          text: 'FAQ',
          link: '/faq'
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/pocketbase/pocketbase' }
    ],

    search: {
      provider: 'local'
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025-2026 Pocket3AS'
    }
  }
})
