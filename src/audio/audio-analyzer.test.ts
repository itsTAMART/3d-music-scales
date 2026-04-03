/**
 * Tests for the audio analyzer module — verifies UI creation
 * and control logic. Full audio playback requires a real AudioContext
 * and is tested manually.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createAudioControls } from "./audio-analyzer";

describe("createAudioControls", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("creates the controls wrapper", () => {
    createAudioControls(container);
    const wrapper = container.querySelector(".audio-controls");
    expect(wrapper).not.toBeNull();
  });

  it("includes a file input for audio", () => {
    createAudioControls(container);
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.accept).toBe("audio/*");
  });

  it("includes an upload label", () => {
    createAudioControls(container);
    const label = container.querySelector(".audio-upload-label");
    expect(label).not.toBeNull();
    expect(label?.textContent).toContain("Upload Audio");
  });

  it("includes an experimental badge", () => {
    createAudioControls(container);
    const badge = container.querySelector(".experimental-badge");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe("experimental");
  });

  it("includes a disabled play button initially", () => {
    createAudioControls(container);
    const btn = container.querySelector(
      ".audio-play-btn"
    ) as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(true);
  });

  it("includes a status element", () => {
    createAudioControls(container);
    const status = container.querySelector(".audio-status");
    expect(status).not.toBeNull();
  });
});
