/**
 * App Component Tests - TDD Red/Green
 */

import { describe, test, expect } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../src/app.js";

describe("App", () => {
  test("should render app title", () => {
    const { lastFrame } = render(<App url="http://localhost:8090" />);
    expect(lastFrame()).toContain("PocketBase TUI");
  });

  test("should display server URL", () => {
    const { lastFrame } = render(<App url="http://example.com:8090" />);
    expect(lastFrame()).toContain("http://example.com:8090");
  });

  test("should display help hint", () => {
    const { lastFrame } = render(<App url="http://localhost:8090" />);
    expect(lastFrame()).toContain("/help");
  });

  test("should show masked token indicator when token provided", () => {
    const { lastFrame } = render(
      <App url="http://localhost:8090" token="secret_token" />
    );
    expect(lastFrame()).toContain("****");
  });

  test("should not show token indicator when no token", () => {
    const { lastFrame } = render(<App url="http://localhost:8090" />);
    // Token indicator should not appear
    const frame = lastFrame();
    expect(frame).not.toContain("Token:");
  });
});
