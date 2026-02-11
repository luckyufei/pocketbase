/**
 * exportFormData - 导出记录数据为 FormData
 * 
 * 用于将编辑后的记录数据转换为 API 请求所需的 FormData 格式
 */
import { ClientResponseError } from 'pocketbase'
import type { CollectionModel } from 'pocketbase'

export interface ExportFormDataOptions {
  record: Record<string, unknown>
  collection: CollectionModel
  uploadedFiles?: Record<string, File[]>
  deletedFiles?: Record<string, string[]>
}

/**
 * 将记录数据导出为 FormData
 * 
 * 功能：
 * - 跳过 autodate 字段
 * - 跳过 Auth 的 password 字段（除非显式设置）
 * - 验证 JSON 字段有效性
 * - 正确处理文件上传 (key+)
 * - 正确处理文件删除 (key-)
 * - undefined 转为 null
 */
export function exportFormData({
  record,
  collection,
  uploadedFiles = {},
  deletedFiles = {},
}: ExportFormDataOptions): FormData {
  const data = structuredClone(record || {})
  const formData = new FormData()
  const exportableFields = new Set<string>()
  const jsonFields = new Set<string>()
  const isAuthCollection = collection.type === 'auth'

  // Collect exportable fields
  for (const field of collection.fields || []) {
    if (field.type === 'autodate') continue
    if (isAuthCollection && field.type === 'password') continue
    exportableFields.add(field.name)
    if (field.type === 'json') jsonFields.add(field.name)
  }

  // Special handling for id field in new records
  if (data.id) {
    exportableFields.add('id')
  }

  // Auth password special handling
  if (isAuthCollection && data.password) {
    exportableFields.add('password')
  }
  if (isAuthCollection && data.passwordConfirm) {
    exportableFields.add('passwordConfirm')
  }

  // Export field values
  for (const key in data) {
    if (!exportableFields.has(key)) continue

    let value = data[key]
    if (value === undefined) value = null

    // JSON validation
    if (jsonFields.has(key) && value !== '' && value !== null) {
      try {
        if (typeof value === 'string') {
          JSON.parse(value)
        } else {
          JSON.stringify(value)
        }
      } catch (err) {
        throw new ClientResponseError({
          status: 400,
          response: {
            data: {
              [key]: {
                code: 'invalid_json',
                message: (err as Error).toString(),
              },
            },
          },
        })
      }
    }

    addValueToFormData(formData, key, value)
  }

  // Uploaded files (key+)
  for (const key in uploadedFiles) {
    for (const file of uploadedFiles[key] || []) {
      formData.append(`${key}+`, file)
    }
  }

  // Deleted files (key-)
  for (const key in deletedFiles) {
    for (const name of deletedFiles[key] || []) {
      formData.append(`${key}-`, name)
    }
  }

  return formData
}

/**
 * 添加值到 FormData
 * 正确处理各种类型的值
 */
function addValueToFormData(formData: FormData, key: string, value: unknown) {
  if (value === null || value === undefined) {
    formData.append(key, '')
  } else if (Array.isArray(value)) {
    if (value.length === 0) {
      formData.append(key, '')
    } else {
      for (const v of value) {
        formData.append(key, String(v))
      }
    }
  } else if (typeof value === 'object') {
    formData.append(key, JSON.stringify(value))
  } else if (typeof value === 'boolean') {
    formData.append(key, value ? 'true' : 'false')
  } else {
    formData.append(key, String(value))
  }
}
