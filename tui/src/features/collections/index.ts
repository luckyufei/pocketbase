/**
 * Collections Feature Index
 */

// Store
export {
  collectionsAtom,
  activeCollectionAtom,
  isCollectionsLoadingAtom,
  collectionsErrorAtom,
  setCollectionsAtom,
  setActiveCollectionAtom,
  setLoadingAtom,
  setErrorAtom,
  clearCollectionsAtom,
  type CollectionInfo,
  type CollectionType,
} from "./store/collectionsAtoms.js";

// API
export {
  fetchCollections,
  getCollectionSchema,
  findCollectionByName,
  type CollectionSchema,
  type SchemaField,
  type APIRules,
} from "./lib/collectionsApi.js";
