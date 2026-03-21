/**
 * fexpr 词法扫描器 — 与 Go 版 github.com/ganigeorgiev/fexpr 对齐
 *
 * Token 类型:
 *   identifier, text, number, function, sign, join, group, comment, whitespace, eof, unexpected
 *
 * 支持 16 种比较运算符（8 标准 + 8 Any 变体）
 */

// ─── Token 类型 ───

export type TokenType =
  | "unexpected"
  | "eof"
  | "whitespace"
  | "join"
  | "sign"
  | "identifier"
  | "function"
  | "number"
  | "text"
  | "group"
  | "comment";

/** Join 运算符 */
export const JoinAnd = "&&";
export const JoinOr = "||";
export type JoinOp = typeof JoinAnd | typeof JoinOr;

/** 比较运算符 (Sign) — 16 种 */
export type SignOp =
  | "="
  | "!="
  | "~"
  | "!~"
  | "<"
  | "<="
  | ">"
  | ">="
  | "?="
  | "?!="
  | "?~"
  | "?!~"
  | "?<"
  | "?<="
  | "?>"
  | "?>=";

export interface Token {
  type: TokenType;
  literal: string;
  /** 对于 function 类型，meta 存储参数 Token 数组 */
  meta?: Token[];
}

// ─── 字符分类 ───

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function isLetter(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isTextStart(ch: string): boolean {
  return ch === "'" || ch === '"';
}

function isNumberStart(ch: string): boolean {
  return ch === "-" || isDigit(ch);
}

function isSignStart(ch: string): boolean {
  return ch === "=" || ch === "?" || ch === "!" || ch === ">" || ch === "<" || ch === "~";
}

function isJoinStart(ch: string): boolean {
  return ch === "&" || ch === "|";
}

function isGroupStart(ch: string): boolean {
  return ch === "(";
}

function isCommentStart(ch: string): boolean {
  return ch === "/";
}

function isIdentifierStart(ch: string): boolean {
  return isLetter(ch) || ch === "@" || ch === "_" || ch === "#";
}

function isIdentifierCombine(ch: string): boolean {
  return ch === "." || ch === ":";
}

// ─── Scanner ───

export class Scanner {
  private input: string;
  private pos: number = 0;

  constructor(input: string) {
    this.input = input;
  }

  private peek(): string {
    if (this.pos >= this.input.length) return "";
    return this.input[this.pos];
  }

  private read(): string {
    if (this.pos >= this.input.length) return "";
    return this.input[this.pos++];
  }

  private unread(): void {
    if (this.pos > 0) this.pos--;
  }

  /** 扫描下一个 Token */
  scan(): Token {
    const ch = this.peek();

    if (ch === "") {
      return { type: "eof", literal: "" };
    }

    if (isWhitespace(ch)) {
      return this.scanWhitespace();
    }

    if (isGroupStart(ch)) {
      return this.scanGroup();
    }

    if (isIdentifierStart(ch)) {
      return this.scanIdentifier(3);
    }

    if (isNumberStart(ch)) {
      return this.scanNumber();
    }

    if (isTextStart(ch)) {
      return this.scanText();
    }

    if (isSignStart(ch)) {
      return this.scanSign();
    }

    if (isJoinStart(ch)) {
      return this.scanJoin();
    }

    if (isCommentStart(ch)) {
      return this.scanComment();
    }

    this.read();
    return { type: "unexpected", literal: ch };
  }

  /** 扫描所有 Token（排除空白和注释） */
  scanAll(): Token[] {
    const tokens: Token[] = [];
    while (true) {
      const t = this.scan();
      if (t.type === "eof") break;
      if (t.type === "whitespace" || t.type === "comment") continue;
      tokens.push(t);
    }
    return tokens;
  }

  // ─── 内部扫描方法 ───

  private scanWhitespace(): Token {
    let lit = "";
    while (this.pos < this.input.length && isWhitespace(this.peek())) {
      lit += this.read();
    }
    return { type: "whitespace", literal: lit };
  }

  private scanGroup(): Token {
    // 跳过 '('
    this.read();
    let depth = 1;
    let lit = "";
    let inQuote = false;
    let quoteChar = "";

    while (this.pos < this.input.length && depth > 0) {
      const ch = this.read();

      if (inQuote) {
        lit += ch;
        if (ch === "\\" && this.pos < this.input.length) {
          lit += this.read();
          continue;
        }
        if (ch === quoteChar) {
          inQuote = false;
        }
        continue;
      }

      if (isTextStart(ch)) {
        inQuote = true;
        quoteChar = ch;
        lit += ch;
        continue;
      }

      if (ch === "(") {
        depth++;
        lit += ch;
      } else if (ch === ")") {
        depth--;
        if (depth > 0) {
          lit += ch;
        }
      } else {
        lit += ch;
      }
    }

    return { type: "group", literal: lit };
  }

  private scanIdentifier(maxFuncDepth: number): Token {
    let lit = "";

    while (this.pos < this.input.length) {
      const ch = this.peek();
      if (isLetter(ch) || isDigit(ch) || ch === "_" || isIdentifierCombine(ch) || ch === "@" || ch === "#") {
        lit += this.read();
      } else {
        break;
      }
    }

    // 不能以 . 或 : 结尾
    while (lit.length > 0 && (lit.endsWith(".") || lit.endsWith(":"))) {
      lit = lit.slice(0, -1);
      this.unread();
    }

    // 检测是否为函数调用
    if (this.peek() === "(" && maxFuncDepth > 0) {
      this.read(); // 跳过 '('
      const args = this.scanFunctionArgs(maxFuncDepth - 1);
      return { type: "function", literal: lit, meta: args };
    }

    return { type: "identifier", literal: lit };
  }

  private scanFunctionArgs(maxFuncDepth: number): Token[] {
    const args: Token[] = [];
    let expectComma = false;

    while (this.pos < this.input.length) {
      const ch = this.peek();

      if (ch === ")") {
        this.read();
        break;
      }

      if (isWhitespace(ch)) {
        this.read();
        continue;
      }

      if (ch === "/") {
        this.scanComment();
        continue;
      }

      if (ch === ",") {
        this.read();
        expectComma = false;
        continue;
      }

      if (expectComma) {
        // 期望逗号但没有找到，跳过这个字符
        break;
      }

      // 扫描参数
      if (isIdentifierStart(ch)) {
        args.push(this.scanIdentifier(maxFuncDepth));
        expectComma = true;
      } else if (isNumberStart(ch)) {
        args.push(this.scanNumber());
        expectComma = true;
      } else if (isTextStart(ch)) {
        args.push(this.scanText());
        expectComma = true;
      } else {
        args.push({ type: "unexpected", literal: this.read() });
        break;
      }
    }

    return args;
  }

  private scanNumber(): Token {
    let lit = "";
    let hasDot = false;

    // 可选负号
    if (this.peek() === "-") {
      lit += this.read();
    }

    while (this.pos < this.input.length) {
      const ch = this.peek();
      if (isDigit(ch)) {
        lit += this.read();
      } else if (ch === "." && !hasDot) {
        hasDot = true;
        lit += this.read();
      } else {
        break;
      }
    }

    // 只有 "-" 不是数字
    if (lit === "-") {
      return { type: "unexpected", literal: lit };
    }

    return { type: "number", literal: lit };
  }

  private scanText(): Token {
    const quote = this.read();
    let lit = "";

    while (this.pos < this.input.length) {
      const ch = this.read();
      if (ch === "\\") {
        const next = this.peek();
        if (next === quote) {
          lit += this.read();
          continue;
        }
        lit += ch;
        continue;
      }
      if (ch === quote) {
        return { type: "text", literal: lit };
      }
      lit += ch;
    }

    // 未闭合的引号
    return { type: "text", literal: lit };
  }

  private scanSign(): Token {
    let lit = this.read();

    // "?" 前缀的 Any 变体
    if (lit === "?") {
      const next = this.peek();
      if (next === "=" || next === "!" || next === "~" || next === "<" || next === ">") {
        lit += this.read();
        if ((lit === "?!" || lit === "?<" || lit === "?>") && this.peek() === "=") {
          lit += this.read();
        }
        if (lit === "?!" && this.peek() === "~") {
          lit += this.read();
        }
        return { type: "sign", literal: lit };
      }
      return { type: "unexpected", literal: lit };
    }

    // 标准运算符
    if (lit === "!" && (this.peek() === "=" || this.peek() === "~")) {
      lit += this.read();
    } else if (lit === "<" && this.peek() === "=") {
      lit += this.read();
    } else if (lit === ">" && this.peek() === "=") {
      lit += this.read();
    }

    return { type: "sign", literal: lit };
  }

  private scanJoin(): Token {
    const first = this.read();
    const second = this.peek();

    if (first === "&" && second === "&") {
      this.read();
      return { type: "join", literal: JoinAnd };
    }

    if (first === "|" && second === "|") {
      this.read();
      return { type: "join", literal: JoinOr };
    }

    return { type: "unexpected", literal: first };
  }

  private scanComment(): Token {
    if (this.peek() !== "/") {
      return { type: "unexpected", literal: this.read() };
    }
    this.read(); // 第一个 /
    if (this.peek() !== "/") {
      return { type: "unexpected", literal: "/" };
    }
    this.read(); // 第二个 /

    let lit = "";
    while (this.pos < this.input.length) {
      const ch = this.peek();
      if (ch === "\n") break;
      lit += this.read();
    }

    return { type: "comment", literal: lit };
  }
}
