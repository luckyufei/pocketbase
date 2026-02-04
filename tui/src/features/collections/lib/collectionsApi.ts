/**
 * Collections API (STORY-4.2)
 * 
 * API functions for Collections operations
 */

import type PocketBase from "pocketbase";
import type { CollectionInfo, CollectionType } from "../store/collectionsAtoms.js";

/**
 * Schema field definition
 */
export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  unique: boolean;
  options?: Record<string, unknown>;
}

/**
 * API rules definition
 */
export interface APIRules {
  list: string | null;
  view: string | null;
  create: string | null;
  update: string | null;
  delete: string | null;
}

/**
 * Collection schema with fields and rules
 */
export interface CollectionSchema {
  id: string;
  name: string;
  type: CollectionType;
  fields: SchemaField[];
  rules?: APIRules;
}

/**
 * Fetch all collections with record counts
 */
export async function fetchCollections(pb: PocketBase): Promise<CollectionInfo[]> {
  const collections = await pb.collections.getFullList();
  
  // Fetch record counts for each collection in parallel
  const collectionsWithCounts = await Promise.all(
    collections.map(async (col) => {
      let recordsCount = 0;
      try {
        // Use getList with perPage=1 to get totalItems without fetching all records
        const result = await pb.collection(col.name).getList(1, 1);
        recordsCount = result.totalItems;
      } catch {
        // If we can't fetch records (e.g., permission denied), keep count as 0
        recordsCount = 0;
      }
      
      return {
        id: col.id,
        name: col.name,
        type: col.type as CollectionType,
        recordsCount,
      };
    })
  );
  
  return collectionsWithCounts;
}

/**
 * Get collection schema by name
 */
export async function getCollectionSchema(
  pb: PocketBase, 
  collectionName: string
): Promise<CollectionSchema> {
  const collection = await pb.collections.getOne(collectionName);
  
  const fields: SchemaField[] = (collection.schema || []).map((field: any) => ({
    name: field.name,
    type: field.type,
    required: field.required ?? false,
    unique: field.unique ?? false,
    options: field.options,
  }));

  const rules: APIRules = {
    list: collection.listRule ?? null,
    view: collection.viewRule ?? null,
    create: collection.createRule ?? null,
    update: collection.updateRule ?? null,
    delete: collection.deleteRule ?? null,
  };

  return {
    id: collection.id,
    name: collection.name,
    type: collection.type as CollectionType,
    fields,
    rules,
  };
}

/**
 * Find collection by name in a list
 */
export function findCollectionByName(
  collections: CollectionInfo[], 
  name: string
): CollectionInfo | undefined {
  return collections.find(c => c.name === name);
}
