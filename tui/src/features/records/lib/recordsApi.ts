/**
 * Records API (STORY-5.2)
 * 
 * API functions for Records operations
 */

import type PocketBase from "pocketbase";
import type { RecordData } from "../store/recordsAtoms.js";

/**
 * Options for fetching records
 */
export interface FetchRecordsOptions {
  page?: number;
  perPage?: number;
  filter?: string;
  sort?: string;
}

/**
 * Result of fetching records
 */
export interface FetchRecordsResult {
  records: RecordData[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

/**
 * System fields that should be excluded from data
 */
const SYSTEM_FIELDS = ["id", "created", "updated", "collectionId", "collectionName"];

/**
 * Transform raw record to RecordData
 */
function transformRecord(raw: Record<string, unknown>): RecordData {
  const { id, created, updated, collectionId, collectionName, ...data } = raw;
  
  return {
    id: id as string,
    created: created as string,
    updated: updated as string,
    collectionId: collectionId as string | undefined,
    collectionName: collectionName as string | undefined,
    data,
  };
}

/**
 * Fetch records list with pagination and filtering
 */
export async function fetchRecords(
  pb: PocketBase,
  collectionName: string,
  options: FetchRecordsOptions
): Promise<FetchRecordsResult> {
  const { 
    page = 1, 
    perPage = 20, 
    filter = "", 
    sort = "" 
  } = options;

  const result = await pb.collection(collectionName).getList(page, perPage, {
    filter,
    sort,
  });

  return {
    records: result.items.map(transformRecord),
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  };
}

/**
 * Get a single record by ID
 */
export async function getRecord(
  pb: PocketBase,
  collectionName: string,
  recordId: string
): Promise<RecordData> {
  const raw = await pb.collection(collectionName).getOne(recordId);
  return transformRecord(raw as Record<string, unknown>);
}

/**
 * Create a new record in a collection
 */
export async function createRecord(
  pb: PocketBase,
  collectionName: string,
  data: Record<string, unknown>
): Promise<RecordData> {
  const raw = await pb.collection(collectionName).create(data);
  return transformRecord(raw as Record<string, unknown>);
}

/**
 * Update an existing record
 */
export async function updateRecord(
  pb: PocketBase,
  collectionName: string,
  recordId: string,
  data: Record<string, unknown>
): Promise<RecordData> {
  const raw = await pb.collection(collectionName).update(recordId, data);
  return transformRecord(raw as Record<string, unknown>);
}

/**
 * Delete a single record
 */
export async function deleteRecord(
  pb: PocketBase,
  collectionName: string,
  recordId: string
): Promise<void> {
  await pb.collection(collectionName).delete(recordId);
}

/**
 * Result of batch delete operation
 */
export interface DeleteRecordsResult {
  success: string[];
  failed: string[];
}

/**
 * Delete multiple records (batch)
 */
export async function deleteRecords(
  pb: PocketBase,
  collectionName: string,
  recordIds: string[]
): Promise<DeleteRecordsResult> {
  const result: DeleteRecordsResult = {
    success: [],
    failed: [],
  };

  for (const id of recordIds) {
    try {
      await pb.collection(collectionName).delete(id);
      result.success.push(id);
    } catch {
      result.failed.push(id);
    }
  }

  return result;
}
