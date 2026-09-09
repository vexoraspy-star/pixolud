export type Layout3D = "azerty" | "qwerty";

const LAYOUT_KEY = "pixolud-3d-layout";
const BRIGHTNESS_KEY = "pixolud-3d-brightness";
const SENSITIVITY_KEY = "pixolud-3d-sensitivity";

export const BRIGHTNESS_MIN = 0.5;
export const BRIGHTNESS_MAX = 1.8;
export const SENSITIVITY_MIN = 0.4;
export const SENSITIVITY_MAX = 3;

export function loadLayout3D(): Layout3D {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "qwerty" ? "qwerty" : "azerty";
  } catch {
    return "azerty";
  }
}

export function saveLayout3D(value: Layout3D) {
  try {
    localStorage.setItem(LAYOUT_KEY, value);
  } catch {
    // ignore
  }
}

export function loadBrightness3D(): number {
  try {
    const v = Number(localStorage.getItem(BRIGHTNESS_KEY));
    return v >= BRIGHTNESS_MIN && v <= BRIGHTNESS_MAX ? v : 1;
  } catch {
    return 1;
  }
}

export function saveBrightness3D(value: number) {
  try {
    localStorage.setItem(BRIGHTNESS_KEY, String(value));
  } catch {
    // ignore
  }
}

export function loadSensitivity3D(): number {
  try {
    const v = Number(localStorage.getItem(SENSITIVITY_KEY));
    return v >= SENSITIVITY_MIN && v <= SENSITIVITY_MAX ? v : 1.5;
  } catch {
    return 1.5;
  }
}

export function saveSensitivity3D(value: number) {
  try {
    localStorage.setItem(SENSITIVITY_KEY, String(value));
  } catch {
    // ignore
  }
}
