// T056: Records Store
import { atom } from 'jotai'
import type { RecordModel, ListResult } from 'pocketbase'

/**
 * Records 列表结果
 */
export interface RecordsState {
  items: RecordModel[]
  page: number
  perPage: number
  totalItems: number
  totalPages: number
}

const initialState: RecordsState = {
  items: [],
  page: 1,
  perPage: 20,
  totalItems: 0,
  totalPages: 0,
}

/**
 * Records 状态
 */
export const recordsAtom = atom<RecordsState>(initialState)

/**
 * 当前选中的 Record
 */
export const activeRecordAtom = atom<RecordModel | null>(null)

/**
 * Records 加载状态
 */
export const recordsLoadingAtom = atom(false)

/**
 * Records 错误
 */
export const recordsErrorAtom = atom<string | null>(null)

/**
 * 选中的 Record IDs（用于批量操作）
 */
export const selectedRecordIdsAtom = atom<Set<string>>(new Set())

/**
 * 是否全选
 */
export const isAllSelectedAtom = atom((get) => {
  const records = get(recordsAtom)
  const selected = get(selectedRecordIdsAtom)
  return records.items.length > 0 && selected.size === records.items.length
})

/**
 * 排序状态
 */
export interface SortState {
  field: string
  direction: 'asc' | 'desc'
}

export const sortStateAtom = atom<SortState | null>(null)

/**
 * 筛选条件
 */
export const filterAtom = atom<string>('')

/**
 * 设置 Records
 */
export const setRecordsAtom = atom(null, (_get, set, result: ListResult<RecordModel>) => {
  set(recordsAtom, {
    items: result.items,
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  })
  set(recordsErrorAtom, null)
  set(selectedRecordIdsAtom, new Set())
})

/**
 * 添加 Record
 */
export const addRecordAtom = atom(null, (get, set, record: RecordModel) => {
  const state = get(recordsAtom)
  set(recordsAtom, {
    ...state,
    items: [record, ...state.items],
    totalItems: state.totalItems + 1,
  })
})

/**
 * 更新 Record
 */
export const updateRecordAtom = atom(null, (get, set, record: RecordModel) => {
  const state = get(recordsAtom)
  set(recordsAtom, {
    ...state,
    items: state.items.map((r) => (r.id === record.id ? record : r)),
  })
  // 如果是当前选中的，也更新
  const active = get(activeRecordAtom)
  if (active?.id === record.id) {
    set(activeRecordAtom, record)
  }
})

/**
 * 删除 Record
 */
export const deleteRecordAtom = atom(null, (get, set, id: string) => {
  const state = get(recordsAtom)
  set(recordsAtom, {
    ...state,
    items: state.items.filter((r) => r.id !== id),
    totalItems: state.totalItems - 1,
  })
  // 如果删除的是当前选中的，清空选中
  const active = get(activeRecordAtom)
  if (active?.id === id) {
    set(activeRecordAtom, null)
  }
  // 从选中列表中移除
  const selected = get(selectedRecordIdsAtom)
  if (selected.has(id)) {
    const newSelected = new Set(selected)
    newSelected.delete(id)
    set(selectedRecordIdsAtom, newSelected)
  }
})

/**
 * 批量删除 Records
 */
export const deleteRecordsAtom = atom(null, (get, set, ids: string[]) => {
  const state = get(recordsAtom)
  const idsSet = new Set(ids)
  set(recordsAtom, {
    ...state,
    items: state.items.filter((r) => !idsSet.has(r.id)),
    totalItems: state.totalItems - ids.length,
  })
  // 清空选中
  set(selectedRecordIdsAtom, new Set())
  // 如果删除的包含当前选中的，清空
  const active = get(activeRecordAtom)
  if (active && idsSet.has(active.id)) {
    set(activeRecordAtom, null)
  }
})

/**
 * 切换选中状态
 */
export const toggleRecordSelectionAtom = atom(null, (get, set, id: string) => {
  const selected = get(selectedRecordIdsAtom)
  const newSelected = new Set(selected)
  if (newSelected.has(id)) {
    newSelected.delete(id)
  } else {
    newSelected.add(id)
  }
  set(selectedRecordIdsAtom, newSelected)
})

/**
 * 全选/取消全选
 */
export const toggleAllSelectionAtom = atom(null, (get, set) => {
  const records = get(recordsAtom)
  const selected = get(selectedRecordIdsAtom)

  if (selected.size === records.items.length) {
    set(selectedRecordIdsAtom, new Set())
  } else {
    set(selectedRecordIdsAtom, new Set(records.items.map((r) => r.id)))
  }
})

/**
 * 重置 Records 状态
 */
export const resetRecordsAtom = atom(null, (_get, set) => {
  set(recordsAtom, initialState)
  set(activeRecordAtom, null)
  set(selectedRecordIdsAtom, new Set())
  set(sortStateAtom, null)
  set(filterAtom, '')
  set(recordsErrorAtom, null)
})
