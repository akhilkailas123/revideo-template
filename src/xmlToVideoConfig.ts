/**
 * xmlToVideoConfig.ts
 *
 * Converts WeVideo XML timeline → video.config.json for project.tsx (Revideo)
 *
 * ══ THREE CRITICAL WEVIDEO XML FIXES ═════════════════════════════════════════
 *
 *  1. DOUBLE-QUOTED XML ATTRIBUTES
 *     WeVideo writes =""value"" instead of ="value".
 *     Fix: iterative regex replace on the raw XML before parsing.
 *
 *  2. <layers> vs <layer> COLLISION
 *     Regex uses /<layer(?!s)/ (negative lookahead) to skip <layers> wrapper.
 *
 *  3. DOUBLE-QUOTED INLINE HTML STYLES
 *     HTML blobs inside <text> nodes also use style=""font-size:52px;"".
 *     After entity-decoding those become literal "" — same fix applied to HTML.
 *
 * ══ TEXT EXTRACTION RULES ════════════════════════════════════════════════════
 *
 *  Plain text node  (e.g. "Birthdays")
 *    → use the visible text directly
 *
 *  Placeholder text  (e.g. {{September}})
 *    → extract the value inside {{…}} → "September"
 *
 *  Scroll-text lines  (each <div> in a kenBurns text)
 *    → if the line is a {{…}} placeholder  → "" (empty slot for user to fill)
 *    → if the line has real text           → use the text
 *    → blank/empty <div>                  → "" (spacer)
 *
 * ══ FULL MAPPING REFERENCE ═══════════════════════════════════════════════════
 *
 *  Layer order → zIndex
 *    XML lists layers front-to-back (index 0 = topmost).
 *    Reversed → index 0 = background = zIndex 0.
 *
 *  Timing  (all XML values in milliseconds, ÷1000 for seconds)
 *    begin → start,  duration → duration
 *
 *  Position  (1920×1080 canvas, pixel → normalised centre)
 *    position.x = (left + width/2)  / 1920
 *    position.y = (top  + height/2) / 1080
 *    Full-screen (w ≥ 90% canvas, h ≥ 90% canvas) → {x:0.5, y:0.5}
 *
 *  Types
 *    <video>                       → "video"
 *    <image>                       → "image"
 *    <text>  (no kenBurns filter)  → "text"
 *    <text>  + kenBurns filter     → "scroll-text"
 *
 *  Transition mapping (layer-level <transition> applies to every element)
 *    crossFade + video  → transition: { type:"fade",            duration:N }
 *    crossFade + image  → animation:  { fadeIn:      { time:N } }
 *    crossFade + text   → animation:  { fadeIn:      { time:N } }
 *    wipeRight + text   → animation:  { wipeRight:   { time:N } }
 *    slideLeft + text   → animation:  { slideInLeft: { time:N } }
 *    swipeLeft + video  → transition: { type:"swipe-left-blur", duration:N }
 *
 *  scroll-text (kenBurns detected)
 *    scrollArea.x      = (kenBurns.startLeft + textNode.width/2) / 1920
 *    scrollArea.y      = 0.5
 *    scrollArea.width  = textNode.width / 1920
 *    scrollArea.height = 0.8
 *    fontSize          = font-size:Npx  from inline style
 *    lineHeight        = fontSize × lineHeightPercent/100
 *    color             = rgb(r,g,b) → #hex  from inline style
 *    lines[]           = one entry per <div>/<br>:
 *                          {{placeholder}} → ""   (empty slot)
 *                          real text       → text value
 */

import * as fs   from "fs";
import * as path from "path";
import { XMLParser } from "fast-xml-parser";

const W = 1920;
const H = 1080;

// ─── Fix 1 & 3: WeVideo double-quoted attributes ──────────────────────────────
/** Replace =""value"" with ="value" iteratively until stable */
function fixDoubleQuotes(s: string): string {
  let prev: string;
  do { prev = s; s = s.replace(/=""([^""]*)""([\s/>])/g, '="$1"$2'); } while (s !== prev);
  return s;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const sec = (v: any): number => Math.round(Number(v ?? 0) / 10) / 100;
const r4  = (n: number)       => parseFloat(n.toFixed(4));

const normPos = (l: number, t: number, w: number, h: number) => ({
  x: r4((l + w / 2) / W),
  y: r4((t + h / 2) / H),
});

const isFullscreen = (w: number, h: number) => w >= W * 0.9 && h >= H * 0.9;

/** Read a CSS property value from an inline-style HTML string */
function cssVal(html: string, prop: string): string | null {
  const m = html.match(new RegExp(prop + "\\s*:\\s*([^;\"'<>]+)", "i"));
  return m ? m[1].trim() : null;
}

/** "rgb(r,g,b)" → "#rrggbb" */
function rgb2hex(v: string): string {
  if (v.startsWith("#")) return v;
  const m = v.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/i);
  if (!m) return "#ffffff";
  return "#" + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, "0")).join("");
}

const getFontSize     = (h: string) => { const m = h.match(/font-size\s*:\s*([\d.]+)\s*px/i); return m ? Math.round(Number(m[1])) : 60; };
const getLineHeightMult = (h: string) => { const m = h.match(/line-height\s*:\s*([\d.]+)%/i);  return m ? Number(m[1]) / 100 : 1.6; };

/**
 * Decode HTML entities + fix inner double-quoted styles.
 * Returns clean HTML ready for CSS extraction and text reading.
 */
function prepHtml(raw: string): string {
  const decoded = raw
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&nbsp;|&#160;/g, " ");
  return fixDoubleQuotes(decoded);
}

/**
 * Extract the display text from a plain/animated text node:
 *  - Real text            → use as-is
 *  - {{September}}        → "September"   (extract placeholder value)
 *  - {{Month/Day - Name}} → ""            (generic slot descriptor = empty)
 */
function htmlToText(raw: string): string {
  const html     = prepHtml(raw);
  const stripped = html.replace(/<[^>]+>/g, "").trim();

  // Contains only a {{…}} placeholder
  const phM = stripped.match(/^\s*\{\{([^}]+)\}\}\s*$/);
  if (phM) {
    const inner = phM[1].trim();
    // Generic field descriptors like "Month/Day - Name" → treat as empty
    if (/[\/\-]/.test(inner)) return "";
    return inner;
  }

  // Mixed or plain text — strip any remaining {{}} markers
  return stripped.replace(/\{\{[^}]*\}\}/g, "").trim();
}

/**
 * For scroll-text: split HTML into one line per <div>/<br>.
 *  - Real text line         → the text string
 *  - {{placeholder}} line   → "" (empty slot for user to fill in)
 *  - Empty / blank line     → "" (spacer)
 * Trailing empty lines are removed.
 */
function htmlToLines(raw: string): string[] {
  const html   = prepHtml(raw);
  const lines: string[] = [];

  for (const block of html.split(/<\/div>|<br\s*\/?>/gi)) {
    const stripped = block.replace(/<[^>]+>/g, "").trim();

    // Any {{…}} placeholder in this line → empty slot
    if (/\{\{[^}]+\}\}/.test(stripped)) {
      lines.push("");
      continue;
    }

    lines.push(stripped);
  }

  // Drop trailing empty strings
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function decodeTitle(t: string): string {
  try { return decodeURIComponent(t ?? "").replace(/\s*\{.*\}$/, "").trim(); }
  catch { return t ?? ""; }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "layer";
}

/** Parse key="value" pairs from a raw XML attribute string */
function parseAttrs(str: string): Record<string, string> {
  const a: Record<string, string> = {};
  for (const m of str.matchAll(/(\w+)="([^"]*)"/g)) a[m[1]] = m[2];
  return a;
}

// ─── Transition helpers ───────────────────────────────────────────────────────

interface Tr { type: string; dur: number; }

const videoTr = (tr: Tr | null) => {
  if (!tr) return null;
  if (tr.type === "crossFade") return { type: "fade",            duration: tr.dur };
  if (tr.type === "swipeLeft") return { type: "swipe-left-blur", duration: tr.dur };
  return null;
};

const imageAnim = (tr: Tr | null) =>
  tr?.type === "crossFade" ? { fadeIn: { time: tr.dur } } : null;

const textAnim = (tr: Tr | null) => {
  if (!tr) return null;
  if (tr.type === "wipeRight") return { wipeRight:   { time: tr.dur } };
  if (tr.type === "slideLeft") return { slideInLeft: { time: tr.dur } };
  if (tr.type === "crossFade") return { fadeIn:      { time: tr.dur } };
  return null;
};

// ─── Layer parser ─────────────────────────────────────────────────────────────

function parseLayers(xml: string) {
  // Fix 2: layer(?!s) avoids matching the <layers> container tag
  return [...xml.matchAll(/<layer(?!s)([^>]*)>([\s\S]*?)<\/layer>/g)].map(m => {
    const attrs   = parseAttrs(m[1]);
    const content = m[2];

    const trM  = content.match(/<transition([^>]*)\/>/);
    const trA  = trM ? parseAttrs(trM[1]) : null;
    const transition: Tr | null = trA ? { type: String(trA.type ?? ""), dur: sec(trA.duration) } : null;

    const videos = [...content.matchAll(/<video([^>]*)>/g)].map(v => parseAttrs(v[1]));
    const images = [...content.matchAll(/<image([^>]*)>/g)].map(v => parseAttrs(v[1]));

    const texts = [...content.matchAll(/<text([^>]*)>([\s\S]*?)<\/text>/g)].map(v => {
      const ta  = parseAttrs(v[1]);
      const tc  = v[2];
      const kbM = tc.match(/<filter([^>]*)\/>/);
      const fa  = kbM ? parseAttrs(kbM[1]) : null;
      return { attrs: ta, content: tc, kenBurns: fa?.type === "kenBurns" ? fa : null };
    });

    return { attrs, transition, videos, images, texts };
  });
}

// ─── Main converter ───────────────────────────────────────────────────────────

export interface ConverterOptions {
  audioSrc?:    string;   // inject a background-music audio entry
  audioOffset?: number;   // audio offset in ms
}

export function convertXml(rawXml: string, opts: ConverterOptions = {}): object {

  // Apply all XML fixes before parsing
  const xml = fixDoubleQuotes(rawXml);

  // Reverse layers: XML[0] = frontmost → highest zIndex after reversal
  const layers = [...parseLayers(xml)].reverse();

  const timeline: any[]                 = [];
  const idCount: Record<string, number> = {};
  const uid = (base: string) => {
    idCount[base] = (idCount[base] ?? 0) + 1;
    return idCount[base] === 1 ? base : `${base}-${idCount[base]}`;
  };

  layers.forEach((layer, zIndex) => {
    const title = decodeTitle(layer.attrs.title ?? "");
    const id    = slug(title);
    const tr    = layer.transition;

    // ── VIDEO ──────────────────────────────────────────────────────────────
    for (const v of layer.videos) {
      const vw = Number(v.width ?? W), vh = Number(v.height ?? H);
      const vl = Number(v.left  ?? 0), vt = Number(v.top   ?? 0);

      const item: any = {
        id:       uid(id),
        type:     "video",
        src:      v.src ?? "",
        start:    sec(v.begin),
        duration: sec(v.duration),
        zIndex,
      };
      if (!isFullscreen(vw, vh)) { item.position = normPos(vl, vt, vw, vh); item.width = vw; }
      const t = videoTr(tr);
      if (t) item.transition = t;
      timeline.push(item);
    }

    // ── IMAGE ──────────────────────────────────────────────────────────────
    for (const img of layer.images) {
      const iw = Number(img.width ?? 400), ih = Number(img.height ?? iw);
      const il = Number(img.left  ?? 0),   it = Number(img.top    ?? 0);

      const item: any = {
        id:       uid(id),
        type:     "image",
        src:      img.src ?? "",
        start:    sec(img.begin),
        duration: sec(img.duration),
        zIndex,
      };
      if (isFullscreen(iw, ih)) { item.width = W;  item.position = { x: 0.5, y: 0.5 }; }
      else                      { item.width = iw; item.position = normPos(il, it, iw, ih); }
      const a = imageAnim(tr);
      if (a) item.animation = a;
      timeline.push(item);
    }

    // ── TEXT ───────────────────────────────────────────────────────────────
    for (const t of layer.texts) {
      const { attrs: ta, content: raw, kenBurns: kb } = t;
      const tw = Number(ta.width  ?? 400), tl = Number(ta.left ?? 0);
      const th = Number(ta.height ?? 200), tt = Number(ta.top  ?? 0);

      // Decode + fix inline styles once, reuse for CSS reading
      const html = prepHtml(raw);

      // ── scroll-text (kenBurns detected) ──────────────────────────────────
      if (kb) {
        const startLeft = Number(kb.startLeft ?? tl);
        const colW      = tw;

        const fs        = getFontSize(html);
        const lh        = Math.round(fs * getLineHeightMult(html));
        const colRaw    = cssVal(html, "color");
        const color     = colRaw ? rgb2hex(colRaw) : "#ffffff";
        const taRaw     = cssVal(html, "text-align") ?? "center";
        const textAlign = (["left", "right", "center"].includes(taRaw) ? taRaw : "center") as "left" | "right" | "center";

        timeline.push({
          id:         uid(id),
          type:       "scroll-text",
          textAlign,
          start:      sec(ta.begin),
          duration:   sec(ta.duration),
          fontSize:   fs,
          lineHeight: lh,
          color,
          zIndex,
          scrollArea: {
            x:      r4((startLeft + colW / 2) / W),
            y:      0.5,
            width:  r4(colW / W),
            height: 0.8,
          },
          lines: htmlToLines(raw),   // {{placeholders}} → "" empty slots
        });
        continue;
      }

      // ── plain / animated text ─────────────────────────────────────────────
      const text = htmlToText(raw);   // {{September}} → "September"
      if (!text) continue;

      const fs       = getFontSize(html);
      const colRaw   = cssVal(html, "color");
      const color    = colRaw ? rgb2hex(colRaw) : "#ffffff";
      const taRaw    = cssVal(html, "text-align") ?? "left";
      const textAlign = (["left", "right", "center"].includes(taRaw) ? taRaw : "left") as "left" | "right" | "center";

      const item: any = {
        id:        uid(id),
        type:      "text",
        textAlign,
        text,
        fontSize:  fs,
        color,
        start:     sec(ta.begin),
        duration:  sec(ta.duration),
        position:  normPos(tl, tt, tw, th),
        zIndex,
      };
      const a = textAnim(tr);
      if (a) item.animation = a;
      timeline.push(item);
    }
  });

  // ── Inject optional audio track ───────────────────────────────────────────
  if (opts.audioSrc) {
    const totalDur = timeline.reduce(
      (acc, i) => Math.max(acc, (i.start ?? 0) + (i.duration ?? 0)), 0
    );
    timeline.unshift({
      id:       "background-music",
      type:     "audio",
      src:      opts.audioSrc,
      start:    0,
      duration: totalDur,
      offset:   sec(opts.audioOffset ?? 0),
    });
  }

  // Sort by start time, then zIndex
  timeline.sort((a, b) => (a.start ?? 0) - (b.start ?? 0) || (a.zIndex ?? 0) - (b.zIndex ?? 0));

  return { settings: { size: { x: W, y: H }, background: "#000000" }, timeline };
}

// ─── CLI ──────────────────────────────────────────────────────────────────────
// Usage:
//   ts-node xmlToVideoConfig.ts <input.xml> [output.json]
//                               [--audio <url>] [--audio-offset <ms>]
//
// Example:
//   ts-node xmlToVideoConfig.ts src/birthday.xml video.config.json \
//     --audio https://example.com/music.mp3 --audio-offset 17000

if (require.main === module) {
  const args        = process.argv.slice(2);
  const xmlPath     = args[0] ?? "./src/sample.xml";
  const outputPath  = args[1] ?? "./video.config.json";

  const audioIdx    = args.indexOf("--audio");
  const audioSrc    = audioIdx    !== -1 ? args[audioIdx    + 1] : undefined;
  const audioOffIdx = args.indexOf("--audio-offset");
  const audioOffset = audioOffIdx !== -1 ? Number(args[audioOffIdx + 1]) : undefined;

  if (!fs.existsSync(xmlPath)) {
    console.error(`❌  XML not found: ${xmlPath}`);
    process.exit(1);
  }

  const result = convertXml(fs.readFileSync(xmlPath, "utf8"), { audioSrc, audioOffset });
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf8");
  console.log(`✅  Converted → ${outputPath}`);
  console.log(`   ${(result as any).timeline.length} timeline items`);
}