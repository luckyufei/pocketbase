/**
 * @file filterLanguage.test.ts
 * @description PocketBase filter 语法定义测试
 * 
 * Task 6: CodeMirror 语法定义 (TDD)
 * 测试 filter 语法高亮规则的正确性
 */

import { describe, it, expect } from 'bun:test'
import { filterLanguage, tokenize, TokenType } from './filterLanguage'

describe('filterLanguage - 语法定义', () => {
  describe('语法高亮 - 字符串识别', () => {
    it('识别双引号字符串', () => {
      const tokens = tokenize('"hello world"')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.String, text: '"hello world"' })
      )
    })

    it('识别单引号字符串', () => {
      const tokens = tokenize("'hello world'")
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.String, text: "'hello world'" })
      )
    })

    it('识别包含转义字符的字符串', () => {
      const tokens = tokenize('"hello \\"world\\""')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.String })
      )
    })

    it('识别空字符串', () => {
      const tokens = tokenize('""')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.String, text: '""' })
      )
    })
  })

  describe('语法高亮 - 数字识别', () => {
    it('识别整数', () => {
      const tokens = tokenize('42')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Number, text: '42' })
      )
    })

    it('识别浮点数', () => {
      const tokens = tokenize('3.14')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Number, text: '3.14' })
      )
    })

    it('识别负数', () => {
      const tokens = tokenize('-123')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Number, text: '-123' })
      )
    })

    it('识别科学计数法', () => {
      const tokens = tokenize('1e10')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Number, text: '1e10' })
      )
    })

    it('识别十六进制数', () => {
      const tokens = tokenize('0xff')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Number, text: '0xff' })
      )
    })
  })

  describe('语法高亮 - 运算符识别', () => {
    it('识别相等运算符 =', () => {
      const tokens = tokenize('field = "value"')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Operator, text: '=' })
      )
    })

    it('识别不等运算符 !=', () => {
      const tokens = tokenize('field != "value"')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Operator, text: '!=' })
      )
    })

    it('识别模糊匹配运算符 ~', () => {
      const tokens = tokenize('field ~ "value"')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Operator, text: '~' })
      )
    })

    it('识别否定模糊匹配运算符 !~', () => {
      const tokens = tokenize('field !~ "value"')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Operator, text: '!~' })
      )
    })

    it('识别大于运算符 >', () => {
      const tokens = tokenize('age > 18')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Operator, text: '>' })
      )
    })

    it('识别小于运算符 <', () => {
      const tokens = tokenize('age < 100')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Operator, text: '<' })
      )
    })

    it('识别大于等于运算符 >=', () => {
      const tokens = tokenize('age >= 18')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Operator, text: '>=' })
      )
    })

    it('识别小于等于运算符 <=', () => {
      const tokens = tokenize('age <= 100')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Operator, text: '<=' })
      )
    })

    it('识别逻辑与运算符 &&', () => {
      const tokens = tokenize('a = 1 && b = 2')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Operator, text: '&&' })
      )
    })

    it('识别逻辑或运算符 ||', () => {
      const tokens = tokenize('a = 1 || b = 2')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Operator, text: '||' })
      )
    })
  })

  describe('语法高亮 - 宏识别', () => {
    it('识别 @now 宏', () => {
      const tokens = tokenize('@now')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Keyword, text: '@now' })
      )
    })

    it('识别 @todayStart 宏', () => {
      const tokens = tokenize('@todayStart')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Keyword, text: '@todayStart' })
      )
    })

    it('识别 @request.method', () => {
      const tokens = tokenize('@request.method')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Keyword, text: '@request.method' })
      )
    })

    it('识别所有时间宏', () => {
      const macros = [
        '@now', '@second', '@minute', '@hour', '@day', '@month', '@year', '@weekday',
        '@yesterday', '@tomorrow', '@todayStart', '@todayEnd',
        '@monthStart', '@monthEnd', '@yearStart', '@yearEnd'
      ]
      for (const macro of macros) {
        const tokens = tokenize(macro)
        expect(tokens).toContainEqual(
          expect.objectContaining({ type: TokenType.Keyword, text: macro })
        )
      }
    })
  })

  describe('语法高亮 - 布尔值和 null', () => {
    it('识别 true', () => {
      const tokens = tokenize('true')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Atom, text: 'true' })
      )
    })

    it('识别 false', () => {
      const tokens = tokenize('false')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Atom, text: 'false' })
      )
    })

    it('识别 null', () => {
      const tokens = tokenize('null')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Atom, text: 'null' })
      )
    })
  })

  describe('语法高亮 - 字段名识别', () => {
    it('识别简单字段名', () => {
      const tokens = tokenize('name')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Variable, text: 'name' })
      )
    })

    it('识别点分隔的字段名', () => {
      const tokens = tokenize('user.profile.name')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Keyword, text: 'user.profile.name' })
      )
    })
  })

  describe('语法高亮 - 注释识别', () => {
    it('识别单行注释', () => {
      const tokens = tokenize('// this is a comment')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Comment })
      )
    })
  })

  describe('语法高亮 - 括号识别', () => {
    it('识别圆括号', () => {
      const tokens = tokenize('(a = 1)')
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Bracket, text: '(' })
      )
      expect(tokens).toContainEqual(
        expect.objectContaining({ type: TokenType.Bracket, text: ')' })
      )
    })
  })

  describe('复合表达式', () => {
    it('完整 filter 表达式', () => {
      const tokens = tokenize('name = "test" && age > 18')
      
      // 应该包含字段名、运算符、字符串、数字
      expect(tokens.some(t => t.type === TokenType.Operator && t.text === '=')).toBe(true)
      expect(tokens.some(t => t.type === TokenType.String && t.text === '"test"')).toBe(true)
      expect(tokens.some(t => t.type === TokenType.Operator && t.text === '&&')).toBe(true)
      expect(tokens.some(t => t.type === TokenType.Number && t.text === '18')).toBe(true)
    })

    it('带宏的 filter 表达式', () => {
      const tokens = tokenize('created > @todayStart && status = true')
      
      expect(tokens.some(t => t.type === TokenType.Keyword && t.text === '@todayStart')).toBe(true)
      expect(tokens.some(t => t.type === TokenType.Atom && t.text === 'true')).toBe(true)
    })
  })
})

describe('filterLanguage - StreamLanguage 导出', () => {
  it('导出 filterLanguage 作为 StreamLanguage', () => {
    expect(filterLanguage).toBeDefined()
    // StreamLanguage 应该有 extension 属性
    expect(filterLanguage.extension).toBeDefined()
  })
})
