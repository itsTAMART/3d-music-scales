/**
 * MIDI input module — connects hardware MIDI devices to the application.
 *
 * Uses the Web MIDI API (`navigator.requestMIDIAccess`) to listen for
 * note-on/note-off messages from connected MIDI devices and dispatches
 * the same `piano:noteon` / `piano:noteoff` custom events used by
 * the piano keyboard module, so the highlighting pipeline is shared.
 *
 * Browser support: Chrome, Edge, Opera. Firefox/Safari do not support
 * Web MIDI — a fallback message is shown in unsupported browsers.
 *
 * @module audio/midi-input
 *
 * @example
 * ```ts
 * import { initMIDI, createMIDIButton } from "@/audio/midi-input";
 * const button = createMIDIButton(container);
 * ```
 */

import { NOTE_NAMES, type NoteName, type NoteEventDetail } from "../types";

/** MIDI status bytes. */
const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

/** Whether MIDI has been initialized. */
let midiInitialized = false;

/** Currently connected MIDI input device names. */
let connectedDevices: string[] = [];

/**
 * Checks if Web MIDI API is available in this browser.
 */
export function isMIDISupported(): boolean {
  return "requestMIDIAccess" in navigator;
}

/**
 * Initializes Web MIDI access and starts listening for note events.
 * Returns the names of connected input devices.
 *
 * @throws If MIDI access is denied or not supported.
 */
export async function initMIDI(): Promise<string[]> {
  if (!isMIDISupported()) {
    throw new Error("Web MIDI API is not supported in this browser");
  }

  const access = await navigator.requestMIDIAccess();

  connectedDevices = [];
  for (const input of access.inputs.values()) {
    connectedDevices.push(input.name ?? "Unknown device");
    input.onmidimessage = handleMIDIMessage;
  }

  // Listen for hot-plug events
  access.onstatechange = (e) => {
    const port = e.port;
    if (port.type === "input") {
      if (port.state === "connected") {
        (port as WebMidi.MIDIInput).onmidimessage = handleMIDIMessage;
        if (!connectedDevices.includes(port.name ?? "")) {
          connectedDevices.push(port.name ?? "Unknown device");
        }
      } else if (port.state === "disconnected") {
        connectedDevices = connectedDevices.filter(
          (d) => d !== (port.name ?? "")
        );
      }
      // Dispatch a status update event
      document.dispatchEvent(
        new CustomEvent("midi:status", {
          detail: { devices: [...connectedDevices] },
        })
      );
    }
  };

  midiInitialized = true;
  return connectedDevices;
}

/**
 * Returns the list of currently connected MIDI input device names.
 */
export function getConnectedDevices(): readonly string[] {
  return connectedDevices;
}

/**
 * Returns whether MIDI has been initialized.
 */
export function isMIDIInitialized(): boolean {
  return midiInitialized;
}

/**
 * Converts a MIDI note number (0-127) to a NoteName.
 */
export function midiNoteToName(midiNote: number): NoteName {
  return NOTE_NAMES[midiNote % 12];
}

/**
 * Parses a raw MIDI message and extracts note information.
 * Returns null if the message is not a note-on or note-off.
 */
export function parseMIDIMessage(data: Uint8Array): {
  type: "noteon" | "noteoff";
  note: NoteName;
  velocity: number;
  channel: number;
} | null {
  if (data.length < 3) return null;

  const status = data[0] & 0xf0;
  const channel = data[0] & 0x0f;
  const noteNumber = data[1];
  const velocity = data[2];

  if (status === NOTE_ON && velocity > 0) {
    return {
      type: "noteon",
      note: midiNoteToName(noteNumber),
      velocity,
      channel,
    };
  }

  // Note-off, or note-on with velocity 0 (common convention)
  if (status === NOTE_OFF || (status === NOTE_ON && velocity === 0)) {
    return {
      type: "noteoff",
      note: midiNoteToName(noteNumber),
      velocity: 0,
      channel,
    };
  }

  return null;
}

/**
 * Creates a "Connect MIDI" button with status display.
 * Appends it to the given container.
 */
export function createMIDIButton(container: HTMLElement): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "midi-controls";

  const button = document.createElement("button");
  button.className = "midi-button";
  button.textContent = "Connect MIDI";

  const status = document.createElement("div");
  status.className = "midi-status";

  if (!isMIDISupported()) {
    button.disabled = true;
    status.textContent = "MIDI not supported in this browser";
    status.classList.add("midi-status--error");
  } else {
    button.addEventListener("click", async () => {
      try {
        button.disabled = true;
        button.textContent = "Connecting...";
        const devices = await initMIDI();
        if (devices.length > 0) {
          status.textContent = `Connected: ${devices.join(", ")}`;
          status.classList.add("midi-status--connected");
          button.textContent = "MIDI Connected";
        } else {
          status.textContent = "No MIDI devices found";
          button.textContent = "Connect MIDI";
          button.disabled = false;
        }
      } catch (err) {
        status.textContent = `Error: ${(err as Error).message}`;
        status.classList.add("midi-status--error");
        button.textContent = "Connect MIDI";
        button.disabled = false;
      }
    });
  }

  // Listen for hot-plug status updates
  document.addEventListener("midi:status", ((e: CustomEvent) => {
    const devices = e.detail.devices as string[];
    if (devices.length > 0) {
      status.textContent = `Connected: ${devices.join(", ")}`;
      status.classList.remove("midi-status--error");
      status.classList.add("midi-status--connected");
    } else {
      status.textContent = "No MIDI devices connected";
      status.classList.remove("midi-status--connected");
      button.textContent = "Connect MIDI";
      button.disabled = false;
    }
  }) as EventListener);

  wrapper.appendChild(button);
  wrapper.appendChild(status);
  container.appendChild(wrapper);

  return wrapper;
}

/** Handles raw MIDI messages from input devices. */
function handleMIDIMessage(event: WebMidi.MIDIMessageEvent): void {
  const parsed = parseMIDIMessage(event.data);
  if (!parsed) return;

  const detail: NoteEventDetail = { note: parsed.note };
  const eventType =
    parsed.type === "noteon" ? "piano:noteon" : "piano:noteoff";

  document.dispatchEvent(new CustomEvent(eventType, { detail }));
}
