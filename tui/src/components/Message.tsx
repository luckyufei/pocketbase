/**
 * Message Component
 * 
 * Displays success, error, warning, info messages
 */

import React from "react";
import { Box, Text } from "ink";
import type { MessageType } from "../store/appAtoms.js";

export interface MessageProps {
  type: MessageType;
  text: string;
}

/**
 * Message type colors
 */
const typeColors: Record<MessageType, string> = {
  success: "green",
  error: "red",
  warning: "yellow",
  info: "blue",
};

/**
 * Message type symbols
 */
const typeSymbols: Record<MessageType, string> = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
};

/**
 * Message component for notifications
 */
export function Message({ type, text }: MessageProps): React.ReactElement {
  const color = typeColors[type];
  const symbol = typeSymbols[type];

  return (
    <Box>
      <Text color={color} bold>{symbol}</Text>
      <Text> {text}</Text>
    </Box>
  );
}

/**
 * MessageList component for multiple messages
 */
export interface MessageListProps {
  messages: Array<{ id: string; type: MessageType; text: string }>;
}

export function MessageList({ messages }: MessageListProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      {messages.map((msg) => (
        <Message key={msg.id} type={msg.type} text={msg.text} />
      ))}
    </Box>
  );
}
