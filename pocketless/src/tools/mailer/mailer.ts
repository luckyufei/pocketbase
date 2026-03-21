/**
 * Mailer — 邮件发送抽象和实现
 * 与 Go 版 tools/mailer 对齐
 * - Mailer 接口
 * - SMTPClient（基于 nodemailer）
 * - Sendmail（基于系统 sendmail 命令）
 * - html2Text 转换器
 */

import type { Transporter } from "nodemailer";

// ==================== Constants ====================

export const SMTPAuthPlain = "PLAIN";
export const SMTPAuthLogin = "LOGIN";

// ==================== Types ====================

/** 邮件地址 */
export interface MailAddress {
  name: string;
  address: string;
}

/** 邮件消息 */
export interface MailMessage {
  from: MailAddress;
  to: MailAddress[];
  cc?: MailAddress[];
  bcc?: MailAddress[];
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
  attachments?: Record<string, Blob | ReadableStream>;
  inlineAttachments?: Record<string, Blob | ReadableStream>;
}

/** Mailer 接口 */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

// ==================== SMTPClient ====================

export interface SMTPConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: boolean;
  authMethod?: string;
  localName?: string;
}

/**
 * SMTPClient — 基于 nodemailer 的 SMTP 客户端
 * 对齐 Go 版 mailer.SMTPClient
 */
export class SMTPClient implements Mailer {
  host: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
  authMethod: string;
  localName: string;

  constructor(config: SMTPConfig) {
    this.host = config.host;
    this.port = config.port;
    this.username = config.username ?? "";
    this.password = config.password ?? "";
    this.tls = config.tls ?? false;
    this.authMethod = config.authMethod ?? SMTPAuthPlain;
    this.localName = config.localName ?? "localhost";
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.host) {
      throw new Error("SMTP host is required");
    }

    // 延迟导入 nodemailer（避免未安装时报错）
    const nodemailer = await import("nodemailer");

    const transportConfig: any = {
      host: this.host,
      port: this.port,
      secure: this.tls,
      name: this.localName,
    };

    if (this.username) {
      transportConfig.auth = {
        user: this.username,
        pass: this.password,
      };

      if (this.authMethod === SMTPAuthLogin) {
        transportConfig.authMethod = "LOGIN";
      }
    }

    const transporter: Transporter = nodemailer.createTransport(transportConfig);

    // 构建邮件
    const mailOptions: any = {
      from: formatAddress(message.from),
      to: message.to.map(formatAddress).join(", "),
      subject: message.subject,
      html: message.html,
      text: message.text || html2Text(message.html),
    };

    if (message.cc?.length) {
      mailOptions.cc = message.cc.map(formatAddress).join(", ");
    }

    if (message.bcc?.length) {
      mailOptions.bcc = message.bcc.map(formatAddress).join(", ");
    }

    if (message.headers) {
      mailOptions.headers = message.headers;
    }

    await transporter.sendMail(mailOptions);
  }
}

// ==================== Sendmail ====================

/**
 * Sendmail — 基于系统 sendmail 命令的邮件发送
 * 对齐 Go 版 mailer.Sendmail（开发/测试用）
 */
export class Sendmail implements Mailer {
  binaryPath: string;

  constructor(binaryPath?: string) {
    this.binaryPath = binaryPath ?? "sendmail";
  }

  async send(message: MailMessage): Promise<void> {
    const recipients = message.to.map((a) => a.address);
    if (message.cc) {
      recipients.push(...message.cc.map((a) => a.address));
    }
    if (message.bcc) {
      recipients.push(...message.bcc.map((a) => a.address));
    }

    // 构建邮件原始内容
    const lines: string[] = [];
    lines.push(`From: ${formatAddress(message.from)}`);
    lines.push(`To: ${message.to.map(formatAddress).join(", ")}`);
    lines.push(`Subject: ${message.subject}`);
    lines.push(`MIME-Version: 1.0`);
    lines.push(`Content-Type: text/html; charset="UTF-8"`);

    if (message.headers) {
      for (const [key, value] of Object.entries(message.headers)) {
        lines.push(`${key}: ${value}`);
      }
    }

    lines.push("");
    lines.push(message.html);

    const rawMessage = lines.join("\r\n");

    // 使用 Bun.spawn 执行 sendmail
    const proc = Bun.spawn([this.binaryPath, "-t", "-oi", ...recipients], {
      stdin: "pipe",
    });

    proc.stdin.write(rawMessage);
    proc.stdin.end();

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`sendmail exited with code ${exitCode}`);
    }
  }
}

// ==================== html2Text ====================

/** 需要跳过的标签 */
const SKIP_TAGS = new Set([
  "style", "script", "iframe", "button", "form",
  "textarea", "input", "select", "option", "template",
  "svg", "img", "applet", "object",
]);

/** 内联标签（不换行） */
const INLINE_TAGS = new Set([
  "a", "span", "small", "strong", "em", "b", "u", "i",
  "code", "abbr", "sub", "sup", "mark", "del", "ins",
]);

/**
 * html2Text — 简易 HTML 转纯文本
 * 对齐 Go 版 mailer.html2Text
 */
export function html2Text(htmlDocument: string): string {
  if (!htmlDocument) return "";

  let result = htmlDocument;

  // 移除需跳过的标签及其内容
  for (const tag of SKIP_TAGS) {
    const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "gi");
    result = result.replace(regex, "");
    // 自闭合标签
    const selfClose = new RegExp(`<${tag}[^>]*/?>`, "gi");
    result = result.replace(selfClose, "");
  }

  // 转换 <br> 为换行
  result = result.replace(/<br\s*\/?>/gi, "\n");

  // 转换 <li> 为 "- "
  result = result.replace(/<li[^>]*>/gi, "\n- ");

  // 转换链接 <a href="url">text</a> → [text](url)
  result = result.replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, url, text) => {
    const cleanText = text.replace(/<[^>]*>/g, "").trim();
    return url ? `[${cleanText}](${url})` : cleanText;
  });

  // 转换无 href 的链接 <a>text</a>
  result = result.replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, (_, text) => {
    return text.replace(/<[^>]*>/g, "").trim();
  });

  // 块级元素前添加换行
  result = result.replace(/<\/(p|div|h[1-6]|blockquote|pre|ul|ol|table|tr)>/gi, "\n");
  result = result.replace(/<(p|div|h[1-6]|blockquote|pre|ul|ol|table|tr)[^>]*>/gi, "\n");

  // 移除剩余标签
  result = result.replace(/<[^>]*>/g, "");

  // 解码常见 HTML 实体
  result = result.replace(/&amp;/g, "&");
  result = result.replace(/&lt;/g, "<");
  result = result.replace(/&gt;/g, ">");
  result = result.replace(/&quot;/g, '"');
  result = result.replace(/&#39;/g, "'");
  result = result.replace(/&nbsp;/g, " ");

  // 合并多余空白
  result = result.replace(/[ \t]+/g, " ");
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

// ==================== Helpers ====================

function formatAddress(addr: MailAddress): string {
  if (addr.name) {
    return `"${addr.name}" <${addr.address}>`;
  }
  return addr.address;
}
