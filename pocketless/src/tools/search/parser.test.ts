/**
 * Parser 测试 — 对照 Go 版 fexpr parser 行为
 * 覆盖递归下降解析器的所有分支
 */

import { describe, test, expect } from "bun:test";
import { parse, isExpr, ParseError, type Expr, type ExprGroup } from "./parser";

// ─── 辅助函数 ───

/** 将 ExprGroup[] 序列化为简洁字符串以便比较 */
function stringifyGroups(groups: ExprGroup[]): string {
  return groups.map(stringifyGroup).join(" ");
}

function stringifyGroup(g: ExprGroup): string {
  const joinStr = g.join === "&&" ? "AND" : "OR";
  if (isExpr(g.item)) {
    const e = g.item;
    const left = e.left.type === "function" ? `${e.left.literal}(...)` : e.left.literal;
    const right = e.right.type === "function" ? `${e.right.literal}(...)` : e.right.literal;
    return `[${joinStr}: ${left} ${e.op} ${right}]`;
  }
  // 嵌套
  const nested = g.item.map(stringifyGroup).join(" ");
  return `[${joinStr}: (${nested})]`;
}

// ─── 错误情况 ───

describe("Parser: errors", () => {
  test("空字符串", () => {
    expect(() => parse("")).toThrow(ParseError);
  });

  test("只有空格", () => {
    expect(() => parse("   ")).toThrow(ParseError);
  });

  test("不完整表达式 — 只有左操作数", () => {
    expect(() => parse("test")).toThrow(ParseError);
  });

  test("不完整表达式 — 缺少右操作数", () => {
    expect(() => parse("test =")).toThrow(ParseError);
  });

  test("不完整表达式 — 缺少运算符", () => {
    expect(() => parse("test test2")).toThrow(ParseError);
  });

  test("未闭合的括号 — scanner 贪婪读取不抛出", () => {
    // scanner 对未闭合括号贪婪读取到末尾，解析为有效的 group
    const groups = parse("(test = 1");
    expect(groups).toHaveLength(1);
  });

  test("不完整的 join", () => {
    expect(() => parse("a = 1 &&")).toThrow(ParseError);
  });

  test("无效运算符", () => {
    expect(() => parse("test + 1")).toThrow(ParseError);
  });
});

// ─── 简单表达式 ───

describe("Parser: simple expressions", () => {
  test("简单等于", () => {
    const groups = parse("a = 1");
    expect(groups).toHaveLength(1);
    expect(isExpr(groups[0].item)).toBe(true);
    const expr = groups[0].item as Expr;
    expect(expr.left.literal).toBe("a");
    expect(expr.op).toBe("=");
    expect(expr.right.literal).toBe("1");
  });

  test("不等于", () => {
    const groups = parse("a != 'b'");
    expect(groups).toHaveLength(1);
    const expr = groups[0].item as Expr;
    expect(expr.op).toBe("!=");
    expect(expr.right.literal).toBe("b");
    expect(expr.right.type).toBe("text");
  });

  test("所有 8 种标准运算符", () => {
    const ops = ["=", "!=", "~", "!~", "<", "<=", ">", ">="] as const;
    for (const op of ops) {
      const groups = parse(`a ${op} b`);
      expect(groups).toHaveLength(1);
      expect((groups[0].item as Expr).op).toBe(op);
    }
  });

  test("所有 8 种 Any 运算符", () => {
    const ops = ["?=", "?!=", "?~", "?!~", "?<", "?<=", "?>", "?>="] as const;
    for (const op of ops) {
      const groups = parse(`a ${op} b`);
      expect(groups).toHaveLength(1);
      expect((groups[0].item as Expr).op).toBe(op);
    }
  });
});

// ─── 操作数类型 ───

describe("Parser: operand types", () => {
  test("text 操作数", () => {
    const groups = parse("a = 'hello'");
    const expr = groups[0].item as Expr;
    expect(expr.right.type).toBe("text");
    expect(expr.right.literal).toBe("hello");
  });

  test("number 操作数", () => {
    const groups = parse("a > 42");
    const expr = groups[0].item as Expr;
    expect(expr.right.type).toBe("number");
    expect(expr.right.literal).toBe("42");
  });

  test("identifier 操作数", () => {
    const groups = parse("a = b");
    const expr = groups[0].item as Expr;
    expect(expr.right.type).toBe("identifier");
    expect(expr.right.literal).toBe("b");
  });

  test("function 操作数", () => {
    const groups = parse("geoDistance(1,2,3,4) < 100");
    const expr = groups[0].item as Expr;
    expect(expr.left.type).toBe("function");
    expect(expr.left.literal).toBe("geoDistance");
    expect(expr.left.meta).toHaveLength(4);
  });
});

// ─── 逻辑运算 ───

describe("Parser: logical operators", () => {
  test("AND (&&)", () => {
    const groups = parse("a = 1 && b = 2");
    expect(groups).toHaveLength(2);
    expect(groups[0].join).toBe("&&");
    expect(groups[1].join).toBe("&&");
  });

  test("OR (||)", () => {
    const groups = parse("a = 1 || b = 2");
    expect(groups).toHaveLength(2);
    expect(groups[0].join).toBe("&&"); // 首个默认 AND
    expect(groups[1].join).toBe("||");
  });

  test("混合 AND/OR", () => {
    const groups = parse("a = 1 && b = 2 || c = 3");
    expect(groups).toHaveLength(3);
    expect(groups[1].join).toBe("&&");
    expect(groups[2].join).toBe("||");
  });
});

// ─── 括号分组 ───

describe("Parser: parentheses grouping", () => {
  test("简单括号", () => {
    const groups = parse("(a = 1)");
    expect(groups).toHaveLength(1);
    // 括号内的表达式被解析为嵌套 ExprGroup[]
    expect(isExpr(groups[0].item)).toBe(false);
    const nested = groups[0].item as ExprGroup[];
    expect(nested).toHaveLength(1);
    expect(isExpr(nested[0].item)).toBe(true);
  });

  test("括号中的 OR", () => {
    const groups = parse("(a = 1 || b = 2) && c = 3");
    expect(groups).toHaveLength(2);
    // 第一个是嵌套组
    expect(isExpr(groups[0].item)).toBe(false);
    const nested = groups[0].item as ExprGroup[];
    expect(nested).toHaveLength(2);
    // 第二个是简单表达式
    expect(isExpr(groups[1].item)).toBe(true);
    expect((groups[1].item as Expr).left.literal).toBe("c");
  });

  test("嵌套括号", () => {
    const groups = parse("((a = 1))");
    expect(groups).toHaveLength(1);
    expect(isExpr(groups[0].item)).toBe(false);
    const outer = groups[0].item as ExprGroup[];
    expect(outer).toHaveLength(1);
    expect(isExpr(outer[0].item)).toBe(false);
    const inner = outer[0].item as ExprGroup[];
    expect(inner).toHaveLength(1);
    expect(isExpr(inner[0].item)).toBe(true);
  });

  test("空括号跳过", () => {
    // 空括号 "()" 应在 BeforeSign 时被跳过（literal 为空）
    const groups = parse("() a = 1");
    expect(groups).toHaveLength(1);
    expect(isExpr(groups[0].item)).toBe(true);
  });
});

// ─── 复杂表达式 ───

describe("Parser: complex expressions", () => {
  test("多层嵌套", () => {
    const groups = parse("((a = 1) || (b = 2)) && c = 3");
    expect(groups).toHaveLength(2);
    // 第一个是嵌套组（包含两个子组）
    const nested = groups[0].item as ExprGroup[];
    expect(nested).toHaveLength(2);
  });

  test("带宏的表达式", () => {
    const groups = parse("created > @now");
    expect(groups).toHaveLength(1);
    const expr = groups[0].item as Expr;
    expect(expr.left.literal).toBe("created");
    expect(expr.right.type).toBe("identifier");
    expect(expr.right.literal).toBe("@now");
  });

  test("带转义引号的文本", () => {
    const groups = parse("name = 'it\\'s a test'");
    expect(groups).toHaveLength(1);
    const expr = groups[0].item as Expr;
    expect(expr.right.literal).toBe("it's a test");
  });

  test("null/true/false 作为标识符", () => {
    const groups = parse("a = null && b = true && c = false");
    expect(groups).toHaveLength(3);
    expect((groups[0].item as Expr).right.type).toBe("identifier");
    expect((groups[0].item as Expr).right.literal).toBe("null");
    expect((groups[1].item as Expr).right.literal).toBe("true");
    expect((groups[2].item as Expr).right.literal).toBe("false");
  });

  test("Go 版经典测试: 所有运算符组合", () => {
    const groups = parse(
      "(a = b || b != c) && (d ~ 'example' || e !~ '%%abc') && f > 1 && g >= 0 && h <= 4 && 2 < 5",
    );
    expect(groups).toHaveLength(6);
  });
});

// ─── isExpr ───

describe("isExpr", () => {
  test("Expr 返回 true", () => {
    expect(isExpr({ left: { type: "identifier", literal: "a" }, op: "=", right: { type: "number", literal: "1" } })).toBe(true);
  });

  test("ExprGroup[] 返回 false", () => {
    expect(isExpr([])).toBe(false);
  });
});
