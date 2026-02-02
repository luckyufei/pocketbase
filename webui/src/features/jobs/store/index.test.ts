/**
 * Jobs Store 测试
 * TDD: 红灯阶段
 */
import { describe, expect, it, beforeEach } from 'bun:test'
import { createStore } from 'jotai'
import {
  jobsAtom,
  statsAtom,
  isLoadingAtom,
  filterAtom,
  totalAtom,
  addJobsAtom,
  clearJobsAtom,
  setFilterAtom,
  setStatsAtom,
  type Job,
  type JobsStats,
  type JobsFilter,
} from './index'

describe('Jobs Store', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  describe('jobsAtom', () => {
    it('应该默认为空数组', () => {
      expect(store.get(jobsAtom)).toEqual([])
    })
  })

  describe('statsAtom', () => {
    it('应该默认为 null', () => {
      expect(store.get(statsAtom)).toBeNull()
    })
  })

  describe('isLoadingAtom', () => {
    it('应该默认为 false', () => {
      expect(store.get(isLoadingAtom)).toBe(false)
    })
  })

  describe('filterAtom', () => {
    it('应该有默认值', () => {
      const filter = store.get(filterAtom)
      expect(filter.topic).toBe('')
      expect(filter.status).toBe('')
      expect(filter.limit).toBe(20)
      expect(filter.offset).toBe(0)
    })
  })

  describe('totalAtom', () => {
    it('应该默认为 0', () => {
      expect(store.get(totalAtom)).toBe(0)
    })
  })

  describe('addJobsAtom', () => {
    it('应该添加新任务', () => {
      const jobs: Job[] = [
        {
          id: 'job1',
          topic: 'test',
          status: 'pending',
          retries: 0,
          max_retries: 3,
          created: '2026-01-13T10:00:00Z',
          run_at: '2026-01-13T10:00:00Z',
        },
      ]
      store.set(addJobsAtom, jobs)
      expect(store.get(jobsAtom)).toHaveLength(1)
    })

    it('应该替换现有任务', () => {
      const jobs: Job[] = [
        {
          id: 'job1',
          topic: 'test',
          status: 'pending',
          retries: 0,
          max_retries: 3,
          created: '2026-01-13T10:00:00Z',
          run_at: '2026-01-13T10:00:00Z',
        },
      ]
      store.set(addJobsAtom, jobs)
      store.set(addJobsAtom, jobs) // 再次添加
      expect(store.get(jobsAtom)).toHaveLength(1)
    })
  })

  describe('clearJobsAtom', () => {
    it('应该清空任务列表', () => {
      const jobs: Job[] = [
        {
          id: 'job1',
          topic: 'test',
          status: 'pending',
          retries: 0,
          max_retries: 3,
          created: '2026-01-13T10:00:00Z',
          run_at: '2026-01-13T10:00:00Z',
        },
      ]
      store.set(addJobsAtom, jobs)
      store.set(clearJobsAtom)
      expect(store.get(jobsAtom)).toEqual([])
    })
  })

  describe('setFilterAtom', () => {
    it('应该更新筛选条件', () => {
      const newFilter: JobsFilter = {
        topic: 'email',
        status: 'pending',
        limit: 50,
        offset: 10,
      }
      store.set(setFilterAtom, newFilter)
      expect(store.get(filterAtom)).toEqual(newFilter)
    })
  })

  describe('setStatsAtom', () => {
    it('应该更新统计数据', () => {
      const stats: JobsStats = {
        pending: 5,
        processing: 2,
        completed: 100,
        failed: 3,
        total: 110,
        success_rate: 0.97,
      }
      store.set(setStatsAtom, stats)
      expect(store.get(statsAtom)).toEqual(stats)
    })
  })
})
