import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './style.css'

// 自定义组件
import CodeTabs from './components/CodeTabs.vue'
import Accordion from './components/Accordion.vue'
import FilterSyntax from './components/FilterSyntax.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // 注册全局组件
    app.component('CodeTabs', CodeTabs)
    app.component('Accordion', Accordion)
    app.component('FilterSyntax', FilterSyntax)
  }
} satisfies Theme
