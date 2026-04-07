// ─── Shared config type ───────────────────────────────────────────────────────
// Using a loose type so video.config.json can have any shape without TS errors.
export interface VideoConfig {
  settings: {
    size: { x: number; y: number };
    [key: string]: any;
  };
  timeline: any[];
  [key: string]: any;
}