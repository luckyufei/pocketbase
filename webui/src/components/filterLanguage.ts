/**
 * @file filterLanguage.ts
 * @description PocketBase filter 语法定义
 * 
 * 使用 CodeMirror legacy-modes 的 simpleMode 定义语法高亮规则
 * 支持：字符串、数字、运算符、宏、布尔值、字段名、注释
 */

import { StreamLanguage } from '@codemirror/language'
import { simpleMode } from '@codemirror/legacy-modes/mode/simple-mode'

/**
 * Token 类型枚举
 */
export enum TokenType {
  String = 'string',
  Number = 'number',
  Operator = 'operator',
  Keyword = 'keyword',    // 宏和字段路径
  Atom = 'atom',          // true, false, null
  Variable = 'variable',  // 简单变量名
  Comment = 'comment',
  Bracket = 'bracket',
  Other = 'other'
}

/**
 * Token 接口
 */
export interface Token {
  type: TokenType
  text: string
  from: number
  to: number
}

/**
 * 所有时间宏
 */
const TIME_MACROS = [
  '@now',
  '@second',
  '@minute', 
  '@hour',
  '@day',
  '@month',
  '@year',
  '@weekday',
  '@yesterday',
  '@tomorrow',
  '@todayStart',
  '@todayEnd',
  '@monthStart',
  '@monthEnd',
  '@yearStart',
  '@yearEnd'
]

/**
 * 创建宏的正则表达式模式
 */
function createMacroPattern(macro: string): RegExp {
  return new RegExp(macro.replace('@', '\\@'))
}

/**
 * simpleMode 规则定义
 * @see https://codemirror.net/5/demo/simplemode.html
 */
const filterRules = {
  start: [
    // 布尔值和 null
    {
      regex: /true|false|null/,
      token: 'atom'
    },
    // 单行注释
    { regex: /\/\/.*/, token: 'comment' },
    // 双引号字符串
    { regex: /"(?:[^\\]|\\.)*?(?:"|$)/, token: 'string' },
    // 单引号字符串
    { regex: /'(?:[^\\]|\\.)*?(?:'|$)/, token: 'string' },
    // 数字（十六进制、科学计数法、浮点数、整数）
    {
      regex: /0x[a-f\d]+|[-+]?(?:\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/i,
      token: 'number'
    },
    // 运算符（注意顺序：长的在前）
    {
      regex: /&&|\|\||!=|!~|>=|<=|=|~|>|</,
      token: 'operator'
    },
    // 括号
    { regex: /[\{\[\(]/, indent: true, token: 'bracket' },
    { regex: /[\}\]\)]/, dedent: true, token: 'bracket' },
    // 时间宏（需要在字段路径之前匹配）
    ...TIME_MACROS.map(macro => ({
      regex: createMacroPattern(macro),
      token: 'keyword'
    })),
    // @request.* 特殊处理
    { regex: /@request\.method/, token: 'keyword' },
    { regex: /@request\.\w+/, token: 'keyword' },
    { regex: /@collection\.\w+/, token: 'keyword' },
    // 点分隔的字段路径 (例如 user.profile.name)
    { regex: /\w+[\w.]*\w+/, token: 'keyword' },
    // 简单变量名
    { regex: /\w+/, token: 'variable' },
  ],
  meta: {
    lineComment: '//'
  }
}

/**
 * 创建 filter 语言的 StreamLanguage
 */
export const filterLanguage = StreamLanguage.define(
  // @ts-expect-error simpleMode types are not fully compatible
  simpleMode(filterRules)
)

/**
 * 简单的 tokenizer 用于测试
 * 注意：这是一个简化版本，主要用于单元测试验证
 * 实际 CodeMirror 使用 filterLanguage 进行高亮
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let pos = 0

  while (pos < input.length) {
    // 跳过空白
    const whitespaceMatch = input.slice(pos).match(/^\s+/)
    if (whitespaceMatch) {
      pos += whitespaceMatch[0].length
      continue
    }

    let matched = false

    // 尝试匹配各种 token
    const remaining = input.slice(pos)

    // 注释
    const commentMatch = remaining.match(/^\/\/.*/)
    if (commentMatch) {
      tokens.push({
        type: TokenType.Comment,
        text: commentMatch[0],
        from: pos,
        to: pos + commentMatch[0].length
      })
      pos += commentMatch[0].length
      matched = true
      continue
    }

    // 双引号字符串
    const doubleStringMatch = remaining.match(/^"(?:[^\\]|\\.)*?(?:"|$)/)
    if (doubleStringMatch) {
      tokens.push({
        type: TokenType.String,
        text: doubleStringMatch[0],
        from: pos,
        to: pos + doubleStringMatch[0].length
      })
      pos += doubleStringMatch[0].length
      matched = true
      continue
    }

    // 单引号字符串
    const singleStringMatch = remaining.match(/^'(?:[^\\]|\\.)*?(?:'|$)/)
    if (singleStringMatch) {
      tokens.push({
        type: TokenType.String,
        text: singleStringMatch[0],
        from: pos,
        to: pos + singleStringMatch[0].length
      })
      pos += singleStringMatch[0].length
      matched = true
      continue
    }

    // 布尔值和 null
    const atomMatch = remaining.match(/^(true|false|null)\b/)
    if (atomMatch) {
      tokens.push({
        type: TokenType.Atom,
        text: atomMatch[0],
        from: pos,
        to: pos + atomMatch[0].length
      })
      pos += atomMatch[0].length
      matched = true
      continue
    }

    // 时间宏 (在数字之前检查，因为 @ 不会被数字匹配)
    let macroMatched = false
    for (const macro of TIME_MACROS) {
      if (remaining.startsWith(macro)) {
        // 确保不是更长标识符的前缀
        const nextChar = remaining[macro.length]
        if (!nextChar || !/\w/.test(nextChar)) {
          tokens.push({
            type: TokenType.Keyword,
            text: macro,
            from: pos,
            to: pos + macro.length
          })
          pos += macro.length
          matched = true
          macroMatched = true
          break
        }
      }
    }
    if (macroMatched) continue

    // @request.* 和 @collection.*
    const requestMatch = remaining.match(/^@request\.\w+/)
    if (requestMatch) {
      tokens.push({
        type: TokenType.Keyword,
        text: requestMatch[0],
        from: pos,
        to: pos + requestMatch[0].length
      })
      pos += requestMatch[0].length
      matched = true
      continue
    }

    const collectionMatch = remaining.match(/^@collection\.\w+/)
    if (collectionMatch) {
      tokens.push({
        type: TokenType.Keyword,
        text: collectionMatch[0],
        from: pos,
        to: pos + collectionMatch[0].length
      })
      pos += collectionMatch[0].length
      matched = true
      continue
    }

    // 数字
    const numberMatch = remaining.match(/^0x[a-f\d]+|^[-+]?(?:\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/i)
    if (numberMatch && numberMatch[0]) {
      tokens.push({
        type: TokenType.Number,
        text: numberMatch[0],
        from: pos,
        to: pos + numberMatch[0].length
      })
      pos += numberMatch[0].length
      matched = true
      continue
    }

    // 运算符 (按长度排序，先匹配长的)
    const operatorMatch = remaining.match(/^(&&|\|\||!=|!~|>=|<=|=|~|>|<)/)
    if (operatorMatch) {
      tokens.push({
        type: TokenType.Operator,
        text: operatorMatch[0],
        from: pos,
        to: pos + operatorMatch[0].length
      })
      pos += operatorMatch[0].length
      matched = true
      continue
    }

    // 括号
    const bracketMatch = remaining.match(/^[\{\[\(\}\]\)]/)
    if (bracketMatch) {
      tokens.push({
        type: TokenType.Bracket,
        text: bracketMatch[0],
        from: pos,
        to: pos + bracketMatch[0].length
      })
      pos += bracketMatch[0].length
      matched = true
      continue
    }

    // 点分隔的字段路径
    const fieldPathMatch = remaining.match(/^\w+(?:\.\w+)+/)
    if (fieldPathMatch) {
      tokens.push({
        type: TokenType.Keyword,
        text: fieldPathMatch[0],
        from: pos,
        to: pos + fieldPathMatch[0].length
      })
      pos += fieldPathMatch[0].length
      matched = true
      continue
    }

    // 简单变量名
    const variableMatch = remaining.match(/^\w+/)
    if (variableMatch) {
      tokens.push({
        type: TokenType.Variable,
        text: variableMatch[0],
        from: pos,
        to: pos + variableMatch[0].length
      })
      pos += variableMatch[0].length
      matched = true
      continue
    }

    // 未知字符，跳过
    if (!matched) {
      pos++
    }
  }

  return tokens
}

export default filterLanguage
