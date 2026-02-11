/**
 * Mailer 测试 — 对照 Go 版 tools/mailer 测试
 * 覆盖: Message, Mailer interface, SMTPClient, Sendmail, html2Text
 */

import { describe, test, expect } from "bun:test";
import {
  type MailMessage,
  type Mailer,
  SMTPClient,
  Sendmail,
  html2Text,
  SMTPAuthPlain,
  SMTPAuthLogin,
} from "./mailer";

// ==================== MailMessage 测试 ====================

describe("MailMessage", () => {
  test("basic message structure", () => {
    const msg: MailMessage = {
      from: { name: "PocketBase", address: "noreply@example.com" },
      to: [{ name: "User", address: "user@example.com" }],
      subject: "Test Email",
      html: "<h1>Hello</h1>",
    };

    expect(msg.from.address).toBe("noreply@example.com");
    expect(msg.to.length).toBe(1);
    expect(msg.subject).toBe("Test Email");
    expect(msg.html).toBe("<h1>Hello</h1>");
  });

  test("message with optional fields", () => {
    const msg: MailMessage = {
      from: { name: "", address: "noreply@example.com" },
      to: [{ name: "", address: "user@example.com" }],
      cc: [{ name: "", address: "cc@example.com" }],
      bcc: [{ name: "", address: "bcc@example.com" }],
      subject: "Test",
      html: "<p>body</p>",
      text: "body",
      headers: { "X-Custom": "value" },
    };

    expect(msg.cc?.length).toBe(1);
    expect(msg.bcc?.length).toBe(1);
    expect(msg.text).toBe("body");
    expect(msg.headers?.["X-Custom"]).toBe("value");
  });
});

// ==================== SMTPClient 测试 ====================

describe("SMTPClient", () => {
  test("constructor with config", () => {
    const client = new SMTPClient({
      host: "smtp.example.com",
      port: 587,
      username: "user",
      password: "pass",
      tls: true,
    });

    expect(client.host).toBe("smtp.example.com");
    expect(client.port).toBe(587);
    expect(client.username).toBe("user");
    expect(client.tls).toBe(true);
    expect(client.authMethod).toBe(SMTPAuthPlain);
  });

  test("default auth method is PLAIN", () => {
    const client = new SMTPClient({
      host: "smtp.example.com",
      port: 587,
    });

    expect(client.authMethod).toBe(SMTPAuthPlain);
  });

  test("supports LOGIN auth method", () => {
    const client = new SMTPClient({
      host: "smtp.example.com",
      port: 587,
      authMethod: SMTPAuthLogin,
    });

    expect(client.authMethod).toBe(SMTPAuthLogin);
  });

  test("implements Mailer interface", () => {
    const client = new SMTPClient({
      host: "smtp.example.com",
      port: 587,
    });

    // send 方法存在
    expect(typeof client.send).toBe("function");
  });

  test("send rejects with invalid config", async () => {
    const client = new SMTPClient({
      host: "", // 无效
      port: 587,
    });

    const msg: MailMessage = {
      from: { name: "", address: "from@example.com" },
      to: [{ name: "", address: "to@example.com" }],
      subject: "Test",
      html: "<p>test</p>",
    };

    try {
      await client.send(msg);
      expect(true).toBe(false); // 不应到达
    } catch (err: any) {
      expect(err).toBeDefined();
    }
  });

  test("localName defaults to localhost", () => {
    const client = new SMTPClient({
      host: "smtp.example.com",
      port: 587,
    });

    expect(client.localName).toBe("localhost");
  });
});

// ==================== Sendmail 测试 ====================

describe("Sendmail", () => {
  test("implements Mailer interface", () => {
    const sendmail = new Sendmail();
    expect(typeof sendmail.send).toBe("function");
  });

  test("custom binary path", () => {
    const sendmail = new Sendmail("/custom/sendmail");
    expect(sendmail.binaryPath).toBe("/custom/sendmail");
  });

  test("default binary path", () => {
    const sendmail = new Sendmail();
    expect(sendmail.binaryPath).toBe("sendmail");
  });
});

// ==================== html2Text 测试 ====================

describe("html2Text", () => {
  test("empty input", () => {
    expect(html2Text("")).toBe("");
  });

  test("plain text passthrough", () => {
    expect(html2Text("Hello World")).toBe("Hello World");
  });

  test("strips HTML tags", () => {
    const result = html2Text("<p>Hello</p><p>World</p>");
    expect(result).toContain("Hello");
    expect(result).toContain("World");
    expect(result).not.toContain("<p>");
  });

  test("converts links to markdown", () => {
    const result = html2Text('<a href="https://example.com">Click here</a>');
    expect(result).toContain("[Click here](https://example.com)");
  });

  test("handles br tags", () => {
    const result = html2Text("Hello<br>World");
    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });

  test("strips style tags", () => {
    const result = html2Text("<style>body { color: red; }</style>Hello");
    expect(result).not.toContain("color");
    expect(result).toContain("Hello");
  });

  test("strips script tags", () => {
    const result = html2Text('<script>alert("xss")</script>Hello');
    expect(result).not.toContain("alert");
    expect(result).toContain("Hello");
  });

  test("handles inline elements", () => {
    const result = html2Text("Hello <strong>World</strong>!");
    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });

  test("handles list items", () => {
    const result = html2Text("<ul><li>Item 1</li><li>Item 2</li></ul>");
    expect(result).toContain("- Item 1");
    expect(result).toContain("- Item 2");
  });

  test("link without href", () => {
    const result = html2Text("<a>Click here</a>");
    expect(result).toContain("Click here");
  });

  test("complex HTML email template", () => {
    const html = `
      <html>
        <head><style>body { font-family: sans-serif; }</style></head>
        <body>
          <h1>Welcome</h1>
          <p>Hello <strong>User</strong>,</p>
          <p>Click <a href="https://example.com/verify">here</a> to verify.</p>
          <ul>
            <li>Step 1</li>
            <li>Step 2</li>
          </ul>
        </body>
      </html>
    `;
    const result = html2Text(html);
    expect(result).toContain("Welcome");
    expect(result).toContain("Hello");
    expect(result).toContain("User");
    expect(result).toContain("[here](https://example.com/verify)");
    expect(result).toContain("- Step 1");
    expect(result).toContain("- Step 2");
    expect(result).not.toContain("font-family");
  });

  test("strips form elements", () => {
    const result = html2Text('<form><input type="text"><button>Submit</button></form>Content');
    expect(result).not.toContain("Submit");
    expect(result).toContain("Content");
  });
});
