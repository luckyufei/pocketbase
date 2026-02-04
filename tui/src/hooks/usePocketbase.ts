/**
 * usePocketbase Hook
 * 
 * Provides access to PocketBase client instance
 */

import { atom, useAtomValue } from "jotai";
import PocketBase from "pocketbase";
import { DEFAULT_PB_URL } from "../lib/pb.js";

/**
 * Atom for PocketBase server URL
 */
export const pbUrlAtom = atom<string>(DEFAULT_PB_URL);

/**
 * Atom for PocketBase auth token
 */
export const pbTokenAtom = atom<string | undefined>(undefined);

/**
 * Derived atom that creates PocketBase client
 */
export const pbClientAtom = atom((get) => {
  const url = get(pbUrlAtom);
  const token = get(pbTokenAtom);
  
  const client = new PocketBase(url);
  
  if (token) {
    client.authStore.save(token, null);
  }
  
  return client;
});

/**
 * Hook to get PocketBase client
 */
export function usePocketbase(): PocketBase {
  return useAtomValue(pbClientAtom);
}

/**
 * Hook to get PocketBase URL
 */
export function usePocketbaseUrl(): string {
  return useAtomValue(pbUrlAtom);
}
