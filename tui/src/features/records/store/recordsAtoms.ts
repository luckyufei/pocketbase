/**
 * Records State Atoms (STORY-5.1)
 * 
 * State management for Records feature
 */

import { atom } from "jotai";

/**
 * Record data structure
 */
export interface RecordData {
  id: string;
  created: string;
  updated: string;
  collectionId?: string;
  collectionName?: string;
  data: Record<string, unknown>;
}

/**
 * Records filter options
 */
export interface RecordsFilter {
  filter: string;
  sort: string;
}

/**
 * Pagination state
 */
export interface Pagination {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

/**
 * Records list atom
 */
export const recordsAtom = atom<RecordData[]>([]);

/**
 * Currently active/selected record
 */
export const activeRecordAtom = atom<RecordData | null>(null);

/**
 * Records filter state
 */
export const recordsFilterAtom = atom<RecordsFilter>({
  filter: "",
  sort: "",
});

/**
 * Pagination state
 */
export const recordsPaginationAtom = atom<Pagination>({
  page: 1,
  perPage: 20,
  totalItems: 0,
  totalPages: 0,
});

/**
 * Loading state for records
 */
export const isRecordsLoadingAtom = atom<boolean>(false);

/**
 * Error state for records operations
 */
export const recordsErrorAtom = atom<string | null>(null);

/**
 * Write-only atom to set records
 */
export const setRecordsAtom = atom(
  null,
  (_get, set, records: RecordData[]) => {
    set(recordsAtom, records);
  }
);

/**
 * Write-only atom to set active record
 */
export const setActiveRecordAtom = atom(
  null,
  (_get, set, record: RecordData | null) => {
    set(activeRecordAtom, record);
  }
);

/**
 * Write-only atom to set filter
 */
export const setFilterAtom = atom(
  null,
  (get, set, update: Partial<RecordsFilter>) => {
    const current = get(recordsFilterAtom);
    set(recordsFilterAtom, { ...current, ...update });
  }
);

/**
 * Write-only atom to set pagination
 */
export const setPaginationAtom = atom(
  null,
  (get, set, update: Partial<Pagination>) => {
    const current = get(recordsPaginationAtom);
    set(recordsPaginationAtom, { ...current, ...update });
  }
);

/**
 * Write-only atom to set loading state
 */
export const setLoadingAtom = atom(
  null,
  (_get, set, loading: boolean) => {
    set(isRecordsLoadingAtom, loading);
  }
);

/**
 * Write-only atom to set error
 */
export const setErrorAtom = atom(
  null,
  (_get, set, error: string | null) => {
    set(recordsErrorAtom, error);
  }
);

/**
 * Write-only atom to clear all records state
 */
export const clearRecordsAtom = atom(
  null,
  (_get, set) => {
    set(recordsAtom, []);
    set(activeRecordAtom, null);
    set(recordsFilterAtom, { filter: "", sort: "" });
    set(recordsPaginationAtom, { page: 1, perPage: 20, totalItems: 0, totalPages: 0 });
    set(isRecordsLoadingAtom, false);
    set(recordsErrorAtom, null);
  }
);
