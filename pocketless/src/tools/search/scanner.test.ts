/**
 * Scanner 测试 — 对照 Go 版 fexpr scanner 行为
 * 覆盖所有 Token 类型及边界情况
 */

import { describe, test, expect } from "bun:test";
import { Scanner, type Token, type TokenType, JoinAnd, JoinOr } from "./scanner";

// ─── 辅助函数 ───

function scanAll(input: string): Token[] {
  return new Scanner(input).scanAll();
}

function expectToken(token: Token, type: TokenType, literal: string) {
  expect(token.type).toBe(type);
  expect(token.literal).toBe(literal);
}

// ─── EOF / 空输入 ───

describe("Scanner: EOF", () => {
  test("空输入返回 eof", () => {
    const s = new Scanner("");
    const t = s.scan();
    expectToken(t, "eof", "");
  });

  test("连续 scan 都返回 eof", () => {
    const s = new Scanner("");
    s.scan();
    expectToken(s.scan(), "eof", "");
  });
});

// ─── 空白 ───

describe("Scanner: whitespace", () => {
  test("空格", () => {
    const s = new Scanner("   ");
    const t = s.scan();
    expectToken(t, "whitespace", "   ");
  });

  test("tab 和换行", () => {
    const s = new Scanner("\t\n\r ");
    const t = s.scan();
    expectToken(t, "whitespace", "\t\n\r ");
  });

  test("scanAll 跳过空白", () => {
    const tokens = scanAll("   ");
    expect(tokens).toHaveLength(0);
  });
});

// ─── 标识符 ───

describe("Scanner: identifiers", () => {
  test("简单标识符", () => {
    const tokens = scanAll("test");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "identifier", "test");
  });

  test("带下划线", () => {
    const tokens = scanAll("test_field");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "identifier", "test_field");
  });

  test("带数字", () => {
    const tokens = scanAll("test123");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "identifier", "test123");
  });

  test("@ 前缀", () => {
    const tokens = scanAll("@now");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "identifier", "@now");
  });

  test("# 前缀", () => {
    const tokens = scanAll("#tag");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "identifier", "#tag");
  });

  test("带点分隔的路径", () => {
    const tokens = scanAll("data.field.sub");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "identifier", "data.field.sub");
  });

  test("带冒号分隔的路径", () => {
    const tokens = scanAll("field:length");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "identifier", "field:length");
  });

  test("尾部点被截断，剩余字符独立扫描", () => {
    const tokens = scanAll("test.");
    // 尾部点被截断 => "test" + "." (unexpected)
    expect(tokens).toHaveLength(2);
    expectToken(tokens[0], "identifier", "test");
    expectToken(tokens[1], "unexpected", ".");
  });

  test("尾部冒号被截断，剩余字符独立扫描", () => {
    const tokens = scanAll("test:");
    // 尾部冒号被截断 => "test" + ":" (unexpected)
    expect(tokens).toHaveLength(2);
    expectToken(tokens[0], "identifier", "test");
    expectToken(tokens[1], "unexpected", ":");
  });

  test("@request.auth.id 路径", () => {
    const tokens = scanAll("@request.auth.id");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "identifier", "@request.auth.id");
  });

  test("@collection.users.name 路径", () => {
    const tokens = scanAll("@collection.users.name");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "identifier", "@collection.users.name");
  });
});

// ─── 数字 ───

describe("Scanner: numbers", () => {
  test("整数", () => {
    const tokens = scanAll("123");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "number", "123");
  });

  test("小数", () => {
    const tokens = scanAll("3.14");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "number", "3.14");
  });

  test("负数", () => {
    const tokens = scanAll("-42");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "number", "-42");
  });

  test("负小数", () => {
    const tokens = scanAll("-3.14");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "number", "-3.14");
  });

  test("零", () => {
    const tokens = scanAll("0");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "number", "0");
  });

  test("仅负号是 unexpected", () => {
    const s = new Scanner("-");
    // 先跳过空白扫描
    const t = s.scan();
    expectToken(t, "unexpected", "-");
  });
});

// ─── 文本 ───

describe("Scanner: text", () => {
  test("单引号文本", () => {
    const tokens = scanAll("'hello'");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "text", "hello");
  });

  test("双引号文本", () => {
    const tokens = scanAll('"world"');
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "text", "world");
  });

  test("空文本", () => {
    const tokens = scanAll("''");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "text", "");
  });

  test("转义引号", () => {
    const tokens = scanAll("'it\\'s'");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "text", "it's");
  });

  test("双引号中的转义", () => {
    const tokens = scanAll('"say\\"hi"');
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "text", 'say"hi');
  });

  test("反斜杠不转义非引号字符", () => {
    const tokens = scanAll("'test\\nvalue'");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "text", "test\\nvalue");
  });

  test("未闭合的引号仍返回 text", () => {
    const tokens = scanAll("'unclosed");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "text", "unclosed");
  });
});

// ─── Sign (比较运算符) ───

describe("Scanner: signs", () => {
  const signCases: Array<[string, string]> = [
    ["=", "="],
    ["!=", "!="],
    ["~", "~"],
    ["!~", "!~"],
    ["<", "<"],
    ["<=", "<="],
    [">", ">"],
    [">=", ">="],
    ["?=", "?="],
    ["?!=", "?!="],
    ["?~", "?~"],
    ["?!~", "?!~"],
    ["?<", "?<"],
    ["?<=", "?<="],
    ["?>", "?>"],
    ["?>=", "?>="],
  ];

  for (const [input, expected] of signCases) {
    test(`运算符: ${input}`, () => {
      const tokens = scanAll(input);
      expect(tokens).toHaveLength(1);
      expectToken(tokens[0], "sign", expected);
    });
  }

  test("? 单独是 unexpected", () => {
    const s = new Scanner("? ");
    const t = s.scan();
    expectToken(t, "unexpected", "?");
  });
});

// ─── Join ───

describe("Scanner: joins", () => {
  test("&&", () => {
    const tokens = scanAll("&&");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "join", JoinAnd);
  });

  test("||", () => {
    const tokens = scanAll("||");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "join", JoinOr);
  });

  test("& 单独是 unexpected", () => {
    const s = new Scanner("& ");
    const t = s.scan();
    expectToken(t, "unexpected", "&");
  });

  test("| 单独是 unexpected", () => {
    const s = new Scanner("| ");
    const t = s.scan();
    expectToken(t, "unexpected", "|");
  });
});

// ─── Group (括号) ───

describe("Scanner: groups", () => {
  test("简单分组", () => {
    const tokens = scanAll("(test = 1)");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "group", "test = 1");
  });

  test("嵌套分组", () => {
    const tokens = scanAll("((a = 1))");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "group", "(a = 1)");
  });

  test("分组中包含引号", () => {
    const tokens = scanAll("(name = 'te)(st')");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "group", "name = 'te)(st'");
  });

  test("空分组", () => {
    const tokens = scanAll("()");
    expect(tokens).toHaveLength(1);
    expectToken(tokens[0], "group", "");
  });
});

// ─── Comment ───

describe("Scanner: comments", () => {
  test("行注释", () => {
    const s = new Scanner("// this is a comment\ntest");
    const t1 = s.scan();
    expectToken(t1, "comment", " this is a comment");
    // 接下来是换行（空白）
    s.scan(); // whitespace
    const t2 = s.scan();
    expectToken(t2, "identifier", "test");
  });

  test("scanAll 跳过注释", () => {
    const tokens = scanAll("// comment\ntest = 1");
    expect(tokens).toHaveLength(3);
    expectToken(tokens[0], "identifier", "test");
    expectToken(tokens[1], "sign", "=");
    expectToken(tokens[2], "number", "1");
  });

  test("单个 / 是 unexpected", () => {
    const s = new Scanner("/x");
    const t = s.scan();
    expectToken(t, "unexpected", "/");
  });
});

// ─── Function ───

describe("Scanner: functions", () => {
  test("无参函数", () => {
    const tokens = scanAll("test()");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe("function");
    expect(tokens[0].literal).toBe("test");
    expect(tokens[0].meta).toHaveLength(0);
  });

  test("带参数的函数", () => {
    const tokens = scanAll("geoDistance(1, 2, 3, 4)");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe("function");
    expect(tokens[0].literal).toBe("geoDistance");
    expect(tokens[0].meta).toHaveLength(4);
    expectToken(tokens[0].meta![0], "number", "1");
    expectToken(tokens[0].meta![1], "number", "2");
    expectToken(tokens[0].meta![2], "number", "3");
    expectToken(tokens[0].meta![3], "number", "4");
  });

  test("混合类型参数", () => {
    const tokens = scanAll("fn(abc, 123, 'text')");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe("function");
    expect(tokens[0].meta).toHaveLength(3);
    expectToken(tokens[0].meta![0], "identifier", "abc");
    expectToken(tokens[0].meta![1], "number", "123");
    expectToken(tokens[0].meta![2], "text", "text");
  });

  test("嵌套函数参数", () => {
    const tokens = scanAll("outer(inner(1, 2), 3)");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe("function");
    expect(tokens[0].meta).toHaveLength(2);
    expect(tokens[0].meta![0].type).toBe("function");
    expect(tokens[0].meta![0].literal).toBe("inner");
    expectToken(tokens[0].meta![1], "number", "3");
  });
});

// ─── 复合表达式 ───

describe("Scanner: complex expressions", () => {
  test("完整过滤表达式", () => {
    const tokens = scanAll("name = 'test' && age > 18");
    expect(tokens).toHaveLength(7);
    expectToken(tokens[0], "identifier", "name");
    expectToken(tokens[1], "sign", "=");
    expectToken(tokens[2], "text", "test");
    expectToken(tokens[3], "join", "&&");
    expectToken(tokens[4], "identifier", "age");
    expectToken(tokens[5], "sign", ">");
    expectToken(tokens[6], "number", "18");
  });

  test("带括号的复合表达式", () => {
    const tokens = scanAll("(a = 1) || b != 'x'");
    expect(tokens).toHaveLength(5);
    expectToken(tokens[0], "group", "a = 1");
    expectToken(tokens[1], "join", "||");
    expectToken(tokens[2], "identifier", "b");
    expectToken(tokens[3], "sign", "!=");
    expectToken(tokens[4], "text", "x");
  });

  test("带宏和修饰符的表达式", () => {
    const tokens = scanAll("created > @now && name:lower ~ 'test'");
    expect(tokens).toHaveLength(7);
    expectToken(tokens[0], "identifier", "created");
    expectToken(tokens[1], "sign", ">");
    expectToken(tokens[2], "identifier", "@now");
    expectToken(tokens[3], "join", "&&");
    expectToken(tokens[4], "identifier", "name:lower");
    expectToken(tokens[5], "sign", "~");
    expectToken(tokens[6], "text", "test");
  });

  test("geoDistance 在表达式中", () => {
    const tokens = scanAll("geoDistance(1,2,3,4) < 567");
    expect(tokens).toHaveLength(3);
    expect(tokens[0].type).toBe("function");
    expect(tokens[0].literal).toBe("geoDistance");
    expectToken(tokens[1], "sign", "<");
    expectToken(tokens[2], "number", "567");
  });
});
