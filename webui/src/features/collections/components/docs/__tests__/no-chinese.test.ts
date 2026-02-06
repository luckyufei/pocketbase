/**
 * Test to ensure no Chinese characters in docs components
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const CHINESE_REGEX = /[\u4e00-\u9fa5]/g

describe('No Chinese characters in docs components', () => {
  const docsDir = path.join(__dirname, '..')
  const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.tsx'))

  files.forEach((file) => {
    it(`${file} should not contain Chinese characters`, () => {
      const content = fs.readFileSync(path.join(docsDir, file), 'utf-8')
      const matches = content.match(CHINESE_REGEX)
      if (matches) {
        console.log(`Found Chinese characters in ${file}:`, matches)
      }
      expect(matches).toBeNull()
    })
  })
})

describe('No Chinese characters in apiDocsUtils', () => {
  it('apiDocsUtils.ts should not contain Chinese characters', () => {
    const libDir = path.join(__dirname, '../../../../../lib')
    const content = fs.readFileSync(path.join(libDir, 'apiDocsUtils.ts'), 'utf-8')
    const matches = content.match(CHINESE_REGEX)
    if (matches) {
      console.log('Found Chinese characters in apiDocsUtils.ts:', matches)
    }
    expect(matches).toBeNull()
  })
})
