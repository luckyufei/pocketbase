/**
 * fexpr 解析器 — 与 Go 版 github.com/ganigeorgiev/fexpr 对齐
 *
 * 递归下降解析器，产出 Expr / ExprGroup AST
 *
 * 语法:
 *   Filter     := ExprGroup ( JoinOp ExprGroup )*
 *   ExprGroup  := Expr | "(" Filter ")"
 *   Expr       := Operand SignOp Operand
 *   Operand    := Identifier | Text | Number | Function
 */

import { Scanner, type Token, type SignOp, type JoinOp, JoinAnd } from "./scanner";

// ─── AST 节点 ───

export interface Expr {
  left: Token;
  op: SignOp;
  right: Token;
}

export interface ExprGroup {
  item: Expr | ExprGroup[];
  join: JoinOp;
}

// ─── 错误 ───

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

// ─── 解析器 ───

const enum Step {
  BeforeSign = 0,
  Sign = 1,
  AfterSign = 2,
  Join = 3,
}

/**
 * 解析 filter 表达式为 ExprGroup 数组
 * 与 Go 版 fexpr.Parse() 对齐
 */
export function parse(raw: string): ExprGroup[] {
  const trimmed = raw.trim();
  if (trimmed === "") {
    throw new ParseError("empty filter expression");
  }

  const scanner = new Scanner(trimmed);
  const result: ExprGroup[] = [];

  let step: Step = Step.BeforeSign;
  let left: Token | null = null;
  let op: SignOp | null = null;
  let join: JoinOp = JoinAnd; // 首个默认 AND

  while (true) {
    const token = scanner.scan();

    // 跳过空白和注释
    if (token.type === "whitespace" || token.type === "comment") {
      continue;
    }

    if (token.type === "eof") {
      break;
    }

    switch (step) {
      case Step.BeforeSign: {
        if (token.type === "group") {
          // 递归解析括号内的表达式
          if (token.literal.trim() === "") {
            // 空括号 — 跳过
            continue;
          }
          const nested = parse(token.literal);
          if (nested.length > 0) {
            result.push({ item: nested, join });
            join = JoinAnd;
            step = Step.Join;
          }
          continue;
        }

        if (
          token.type === "identifier" ||
          token.type === "text" ||
          token.type === "number" ||
          token.type === "function"
        ) {
          left = token;
          step = Step.Sign;
          continue;
        }

        throw new ParseError("invalid or incomplete filter expression");
      }

      case Step.Sign: {
        if (token.type === "sign") {
          op = token.literal as SignOp;
          step = Step.AfterSign;
          continue;
        }
        throw new ParseError("invalid or incomplete filter expression");
      }

      case Step.AfterSign: {
        if (
          token.type === "identifier" ||
          token.type === "text" ||
          token.type === "number" ||
          token.type === "function"
        ) {
          result.push({
            item: { left: left!, op: op!, right: token },
            join,
          });
          join = JoinAnd;
          step = Step.Join;
          continue;
        }
        throw new ParseError("invalid or incomplete filter expression");
      }

      case Step.Join: {
        if (token.type === "join") {
          join = token.literal as JoinOp;
          step = Step.BeforeSign;
          continue;
        }

        if (token.type === "group") {
          // 隐式 AND
          if (token.literal.trim() === "") continue;
          const nested = parse(token.literal);
          if (nested.length > 0) {
            result.push({ item: nested, join });
            join = JoinAnd;
          }
          continue;
        }

        throw new ParseError("invalid or incomplete filter expression");
      }
    }
  }

  // 必须在 Join 状态结束（说明至少有一个完整表达式）
  if (step !== Step.Join) {
    throw new ParseError("invalid or incomplete filter expression");
  }

  return result;
}

/** 检查是否为 Expr（而非 ExprGroup[]） */
export function isExpr(item: Expr | ExprGroup[]): item is Expr {
  return "left" in item && "op" in item && "right" in item;
}
