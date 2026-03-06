// config_types.ts — Revideo VideoConfig types
// Use wevideo_to_json.py to auto-convert WeVideo XML → JSON

export type AnimationType = 'scale' | 'rotation' | 'opacity' | 'position';

export interface Animation {
  type: AnimationType;
  to?: number | { x: number; y: number };
  from?: number | { x: number; y: number };
  duration: number;
  delay?: number;
}

export interface OpacityKeyframe {
  time: number;   // seconds from element start
  value: number;  // 0–1
}

export type TransitionType = 'crossFade' | 'wipeRight' | 'wipeLeft' | 'wipeUp' | 'wipeDown' | 'none';
export interface Transition {
  type: TransitionType;
  duration: number;   // seconds
  delay?: number;     // seconds before transition starts
}

// kenBurns values in WeVideo top-left pixel space:
// On TEXT:  startTop/endTop = text element TOP animates from start→end (scroll effect)
// On IMAGE: bounding box pan/zoom
export interface KenBurnsFilter {
  startTop: number;    startLeft: number;
  startWidth: number;  startHeight: number;
  endTop: number;      endLeft: number;
  endWidth: number;    endHeight: number;
}

export interface BaseItem {
  id: string;
  type: string;
  startTime: number;
  duration: number;
  zIndex?: number;
  transition?: Transition;
  opacityKeyframes?: OpacityKeyframe[];
}

export interface VideoItem extends BaseItem {
  type: 'video';
  src: string;
  position: { x: number; y: number };
  size: { width: number | string; height?: number | string };
  opacity: number;
  loop?: boolean;
  play?: boolean;
  volume?: number;
  animations?: Animation[];
}

export interface AudioItem extends BaseItem {
  type: 'audio';
  src: string;
  audioStartTime?: number;
  play?: boolean;
  volume?: number;
}

export interface ImageItem extends BaseItem {
  type: 'image';
  src: string;
  position: { x: number; y: number };
  size: { width: number | string; height?: number | string };
  opacity?: number;
  rotation?: number;
  animations?: Animation[];
  kenBurns?: KenBurnsFilter;
}

export interface TextItem extends BaseItem {
  type: 'text';
  text: string;
  position: { x: number; y: number };
  size?: { width?: number | string; height?: number | string };
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  opacity?: number;
  rotation?: number;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  letterSpacing?: number;
  animations?: Animation[];
  kenBurns?: KenBurnsFilter;
  // Precomputed scroll values (set by wevideo_to_json.py, used by runScrollText)
  scrollStartY?: number;   // Revideo centre-Y at start (text enters from below)
  scrollEndY?: number;     // Revideo centre-Y at end   (text exits above)
  scrollBlockH?: number;   // total pixel height of text block
}

export interface RectItem extends BaseItem {
  type: 'rect';
  position: { x: number; y: number };
  size: { width: number | string; height: number | string };
  fill?: string;
  opacity?: number;
  rotation?: number;
  animations?: Animation[];
}

export type TimelineItem = VideoItem | AudioItem | ImageItem | TextItem | RectItem;

export interface VideoConfig {
  settings: {
    size: { x: number; y: number };
    background?: string;
  };
  timeline: TimelineItem[];
}