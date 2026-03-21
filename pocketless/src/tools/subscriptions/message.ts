/**
 * Message — SSE 消息类型
 * 与 Go 版 subscriptions.Message 对齐
 */

export interface Message {
  name: string;
  data: string;
}

/**
 * 将消息格式化为 SSE 标准格式
 * 格式: id:<eventId>\nevent:<name>\ndata:<data>\n\n
 */
export function formatSSE(msg: Message, eventId: string): string {
  return `id:${eventId}\nevent:${msg.name}\ndata:${msg.data}\n\n`;
}
