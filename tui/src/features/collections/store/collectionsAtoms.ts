/**
 * Collections State Atoms (STORY-4.1)
 * 
 * State management for Collections feature
 */

import { atom } from "jotai";

/**
 * Collection type
 */
export type CollectionType = "base" | "auth" | "view";

/**
 * Collection information
 */
export interface CollectionInfo {
  id: string;
  name: string;
  type: CollectionType;
  recordsCount: number;
}

/**
 * Collections list atom
 */
export const collectionsAtom = atom<CollectionInfo[]>([]);

/**
 * Currently active/selected collection
 */
export const activeCollectionAtom = atom<CollectionInfo | null>(null);

/**
 * Loading state for collections
 */
export const isCollectionsLoadingAtom = atom<boolean>(false);

/**
 * Error state for collections operations
 */
export const collectionsErrorAtom = atom<string | null>(null);

/**
 * Write-only atom to set collections
 */
export const setCollectionsAtom = atom(
  null,
  (_get, set, collections: CollectionInfo[]) => {
    set(collectionsAtom, collections);
  }
);

/**
 * Write-only atom to set active collection
 */
export const setActiveCollectionAtom = atom(
  null,
  (_get, set, collection: CollectionInfo | null) => {
    set(activeCollectionAtom, collection);
  }
);

/**
 * Write-only atom to set loading state
 */
export const setLoadingAtom = atom(
  null,
  (_get, set, loading: boolean) => {
    set(isCollectionsLoadingAtom, loading);
  }
);

/**
 * Write-only atom to set error
 */
export const setErrorAtom = atom(
  null,
  (_get, set, error: string | null) => {
    set(collectionsErrorAtom, error);
  }
);

/**
 * Write-only atom to clear all collections state
 */
export const clearCollectionsAtom = atom(
  null,
  (_get, set) => {
    set(collectionsAtom, []);
    set(activeCollectionAtom, null);
    set(isCollectionsLoadingAtom, false);
    set(collectionsErrorAtom, null);
  }
);
