/**
 * Excerpt 修饰符 — 从 HTML 提取纯文本摘要
 * 与 Go 版 tools/picker/excerpt_modifier.go 对齐
 */

/**
 * 从 HTML 字符串提取纯文本摘要
 *
 * @param value - 输入值（通常是 HTML 字符串）
 * @param maxLength - 最大字符数（默认 100）
 * @param withEllipsis - 超长时是否添加省略号（默认 true）
 * @returns 纯文本摘要
 */
export function excerpt(value: unknown, maxLength: number = 100, withEllipsis: boolean = true): string {
  if (value === null || value === undefined) return "";

  const str = String(value);

  // 去除 HTML 标签
  const text = stripHtmlTags(str)
    // 压缩多余空白
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength);

  // 尝试在最后一个完整单词处截断
  const lastSpace = truncated.lastIndexOf(" ");
  const clean = lastSpace > maxLength * 0.3 ? truncated.slice(0, lastSpace) : truncated;

  return withEllipsis ? clean + "..." : clean;
}

/**
 * 去除 HTML 标签
 */
function stripHtmlTags(html: string): string {
  // 移除 style 和 script 标签及其内容
  let text = html.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, "");

  // 将 <br> 和 </p> 等替换为空格
  text = text.replace(/<\/(p|div|br|li|h[1-6])>/gi, " ");
  text = text.replace(/<br\s*\/?>/gi, " ");

  // 移除所有剩余 HTML 标签
  text = text.replace(/<[^>]+>/g, "");

  // 解码常见 HTML 实体
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  return text;
}
