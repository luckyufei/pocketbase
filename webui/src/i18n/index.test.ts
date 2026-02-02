// T133-134: 国际化测试
import { describe, it, expect, beforeEach } from 'vitest'
import i18n from './index'

describe('i18n', () => {
  beforeEach(() => {
    // 重置语言
    i18n.changeLanguage('en')
  })

  it('should initialize with default language', () => {
    expect(i18n.language).toBe('en')
  })

  it('should have required namespaces', () => {
    expect(i18n.hasResourceBundle('en', 'translation')).toBe(true)
    expect(i18n.hasResourceBundle('zh', 'translation')).toBe(true)
  })

  describe('English translations', () => {
    beforeEach(() => {
      i18n.changeLanguage('en')
    })

    it('should have nav translations', () => {
      expect(i18n.t('nav.home')).toBe('Home')
      expect(i18n.t('nav.collections')).toBe('Collections')
      expect(i18n.t('nav.settings')).toBe('Settings')
      expect(i18n.t('nav.logs')).toBe('Logs')
      expect(i18n.t('nav.monitoring')).toBe('Monitoring')
    })

    it('should have login translations', () => {
      expect(i18n.t('login.email')).toBe('Email')
      expect(i18n.t('login.password')).toBe('Password')
      expect(i18n.t('login.submit')).toBe('Login')
    })

    it('should have settings translations', () => {
      expect(i18n.t('settings.title')).toBe('Settings')
      expect(i18n.t('settings.application.title')).toBe('Application Settings')
      expect(i18n.t('settings.mail.title')).toBe('Mail Settings')
      expect(i18n.t('settings.storage.title')).toBe('Storage Settings')
      expect(i18n.t('settings.backups.title')).toBe('Backup Management')
    })

    it('should have logs translations', () => {
      expect(i18n.t('logs.title')).toBe('Logs')
      expect(i18n.t('logs.filter')).toBe('Filter logs...')
      expect(i18n.t('logs.levels.info')).toBe('Info')
      expect(i18n.t('logs.levels.error')).toBe('Error')
    })

    it('should have monitoring translations', () => {
      expect(i18n.t('monitoring.title')).toBe('System Monitoring')
      expect(i18n.t('monitoring.cpu')).toBe('CPU Usage')
      expect(i18n.t('monitoring.memory')).toBe('Memory Usage')
    })

    it('should have traces translations', () => {
      expect(i18n.t('traces.title')).toBe('Request Traces')
      expect(i18n.t('traces.method')).toBe('Method')
      expect(i18n.t('traces.status')).toBe('Status')
    })

    it('should have analytics translations', () => {
      expect(i18n.t('analytics.title')).toBe('Traffic Analytics')
      expect(i18n.t('analytics.pageViews')).toBe('Page Views')
      expect(i18n.t('analytics.uniqueVisitors')).toBe('Unique Visitors')
    })

    it('should have theme translations', () => {
      expect(i18n.t('theme.light')).toBe('Light Mode')
      expect(i18n.t('theme.dark')).toBe('Dark Mode')
    })

    it('should have error translations', () => {
      expect(i18n.t('error.title')).toBe('Something went wrong')
      expect(i18n.t('error.retry')).toBe('Retry')
      expect(i18n.t('error.goHome')).toBe('Go Home')
    })

    it('should have common translations', () => {
      expect(i18n.t('common.save')).toBe('Save')
      expect(i18n.t('common.cancel')).toBe('Cancel')
      expect(i18n.t('common.delete')).toBe('Delete')
      expect(i18n.t('common.loading')).toBe('Loading...')
    })
  })

  describe('Chinese translations', () => {
    beforeEach(() => {
      i18n.changeLanguage('zh')
    })

    it('should have nav translations', () => {
      expect(i18n.t('nav.home')).toBe('首页')
      expect(i18n.t('nav.collections')).toBe('Collections')
      expect(i18n.t('nav.settings')).toBe('设置')
      expect(i18n.t('nav.logs')).toBe('日志')
      expect(i18n.t('nav.monitoring')).toBe('监控')
    })

    it('should have login translations', () => {
      expect(i18n.t('login.email')).toBe('邮箱')
      expect(i18n.t('login.password')).toBe('密码')
      expect(i18n.t('login.submit')).toBe('登录')
    })

    it('should have settings translations', () => {
      expect(i18n.t('settings.title')).toBe('设置')
      expect(i18n.t('settings.application.title')).toBe('应用设置')
      expect(i18n.t('settings.mail.title')).toBe('邮件设置')
      expect(i18n.t('settings.storage.title')).toBe('存储设置')
      expect(i18n.t('settings.backups.title')).toBe('备份管理')
    })

    it('should have logs translations', () => {
      expect(i18n.t('logs.title')).toBe('日志')
      expect(i18n.t('logs.filter')).toBe('筛选日志...')
      expect(i18n.t('logs.levels.info')).toBe('信息')
      expect(i18n.t('logs.levels.error')).toBe('错误')
    })

    it('should have monitoring translations', () => {
      expect(i18n.t('monitoring.title')).toBe('系统监控')
      expect(i18n.t('monitoring.cpu')).toBe('CPU 使用率')
      expect(i18n.t('monitoring.memory')).toBe('内存使用')
    })

    it('should have traces translations', () => {
      expect(i18n.t('traces.title')).toBe('请求追踪')
      expect(i18n.t('traces.method')).toBe('方法')
      expect(i18n.t('traces.status')).toBe('状态')
    })

    it('should have analytics translations', () => {
      expect(i18n.t('analytics.title')).toBe('流量分析')
      expect(i18n.t('analytics.pageViews')).toBe('页面浏览量')
      expect(i18n.t('analytics.uniqueVisitors')).toBe('独立访客')
    })

    it('should have theme translations', () => {
      expect(i18n.t('theme.light')).toBe('浅色模式')
      expect(i18n.t('theme.dark')).toBe('深色模式')
    })

    it('should have error translations', () => {
      expect(i18n.t('error.title')).toBe('出错了')
      expect(i18n.t('error.retry')).toBe('重试')
      expect(i18n.t('error.goHome')).toBe('返回首页')
    })

    it('should have common translations', () => {
      expect(i18n.t('common.save')).toBe('保存')
      expect(i18n.t('common.cancel')).toBe('取消')
      expect(i18n.t('common.delete')).toBe('删除')
      expect(i18n.t('common.loading')).toBe('加载中...')
    })
  })

  describe('language switching', () => {
    it('should switch between languages', async () => {
      await i18n.changeLanguage('en')
      expect(i18n.t('nav.home')).toBe('Home')

      await i18n.changeLanguage('zh')
      expect(i18n.t('nav.home')).toBe('首页')

      await i18n.changeLanguage('en')
      expect(i18n.t('nav.home')).toBe('Home')
    })
  })
})
