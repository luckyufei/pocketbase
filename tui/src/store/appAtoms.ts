/**
 * Application State Atoms
 * 
 * Global state management using Jotai
 * Corresponds to webui/src/store/app.ts
 */

import { atom } from "jotai";

/**
 * Application connection state
 */
export type AppState = "disconnected" | "connecting" | "connected" | "error";

/**
 * Current view/screen type
 */
export type ViewType = "dashboard" | "collections" | "records" | "logs" | "monitor" | "schema" | "help";

/**
 * Message type for notifications
 */
export type MessageType = "success" | "error" | "warning" | "info";

/**
 * Message structure
 */
export interface Message {
  id: string;
  type: MessageType;
  text: string;
  timestamp: number;
}

/**
 * Input for adding a new message
 */
export interface AddMessageInput {
  type: MessageType;
  text: string;
}

// ============================================
// Atoms
// ============================================

/**
 * Application connection state atom
 * Initial: disconnected
 */
export const appStateAtom = atom<AppState>("disconnected");

/**
 * Current view atom
 * Initial: dashboard
 */
export const currentViewAtom = atom<ViewType>("dashboard");

/**
 * Messages list atom (for toasts/notifications)
 */
export const messagesAtom = atom<Message[]>([]);

/**
 * Write-only atom to add a message
 */
export const addMessageAtom = atom(
  null,
  (get, set, input: AddMessageInput) => {
    const newMessage: Message = {
      id: crypto.randomUUID(),
      type: input.type,
      text: input.text,
      timestamp: Date.now(),
    };
    set(messagesAtom, [...get(messagesAtom), newMessage]);
  }
);

/**
 * Write-only atom to clear all messages
 */
export const clearMessagesAtom = atom(
  null,
  (_get, set) => {
    set(messagesAtom, []);
  }
);

/**
 * Write-only atom to remove a specific message by ID
 */
export const removeMessageAtom = atom(
  null,
  (get, set, messageId: string) => {
    set(messagesAtom, get(messagesAtom).filter(m => m.id !== messageId));
  }
);
