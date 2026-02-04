/**
 * Records Feature Index
 */

// Store
export {
  recordsAtom,
  activeRecordAtom,
  recordsFilterAtom,
  recordsPaginationAtom,
  isRecordsLoadingAtom,
  recordsErrorAtom,
  setRecordsAtom,
  setActiveRecordAtom,
  setFilterAtom,
  setPaginationAtom,
  setLoadingAtom,
  setErrorAtom,
  clearRecordsAtom,
  type RecordData,
  type RecordsFilter,
  type Pagination,
} from "./store/recordsAtoms.js";

// API
export {
  fetchRecords,
  getRecord,
  type FetchRecordsOptions,
  type FetchRecordsResult,
} from "./lib/recordsApi.js";

// Components
export { RecordsTable, type RecordsTableProps } from "./components/RecordsTable.js";
export { RecordDetail, type RecordDetailProps } from "./components/RecordDetail.js";
