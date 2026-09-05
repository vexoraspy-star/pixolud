export const PLATEFORME_WIDTH = 10;
export const PLATEFORME_HEIGHT = 8;
export const PLATEFORME_WIDTH_MAX = 16;
export const PLATEFORME_HEIGHT_MAX = 11;

export interface PlateformeData {
  width: number;
  height: number;
  platforms: [number, number][];
  start: [number, number] | null;
  end: [number, number] | null;
}

export function emptyPlateforme(big = false): PlateformeData {
  return {
    width: big ? PLATEFORME_WIDTH_MAX : PLATEFORME_WIDTH,
    height: big ? PLATEFORME_HEIGHT_MAX : PLATEFORME_HEIGHT,
    platforms: [],
    start: null,
    end: null,
  };
}

export function isPlateformePlayable(data: PlateformeData): boolean {
  return (
    data?.start != null && data?.end != null && Array.isArray(data.platforms) && data.platforms.length > 0
  );
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}
