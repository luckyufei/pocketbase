import { describe, test, expect } from "bun:test";
import { formatSSE, type Message } from "./message";

describe("Message", () => {
  test("formatSSE — 标准 SSE 格式输出", () => {
    const msg: Message = {
      name: "test_name",
      data: "test_data",
    };

    const result = formatSSE(msg, "test_id");
    const expected = "id:test_id\nevent:test_name\ndata:test_data\n\n";

    expect(result).toBe(expected);
  });
});
