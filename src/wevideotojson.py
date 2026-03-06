#!/usr/bin/env python3
"""
wevideo_to_json.py  —  WeVideo XML → Revideo JSON converter

COORDINATE RULES
----------------
WeVideo uses top-left origin (pixels) and milliseconds.
Revideo uses centre origin (pixels) and seconds.

For regular elements:
    pos_x = left + width/2  - canvasW/2
    pos_y = top  + height/2 - canvasH/2

kenBurns on TEXT (scrolling list):
    WeVideo animates the TEXT ELEMENT's top position:
      startTop → the element's top at t=0  (usually below canvas, e.g. 850)
      endTop   → the element's top at t=end (usually far above canvas, e.g. -8700)
    The converter stores startTop/endTop in kenBurns so project.tsx can
    animate from:
      startY = startTop + height/2 - CH/2
      endY   = endTop   + height/2 - CH/2

kenBurns on IMAGE (pan/zoom):
    Same principle — image position animates from start → end bounding box centre.

Usage
-----
# Single XML file
python3 wevideo_to_json.py input.xml output.json

# All templates from CSV
python3 wevideo_to_json.py --csv templates.csv --out-dir ./configs/
"""

import sys, os, csv, json, re, xml.etree.ElementTree as ET
from html import unescape

csv.field_size_limit(10_000_000)


def ms_to_sec(v) -> float:
    return float(v) / 1000.0


def parse_opacity_keyframes(elem):
    kfs = [
        {"time": ms_to_sec(e.get('time')), "value": float(e.get('value'))}
        for e in elem.findall('./opacity/entry')
    ]
    return kfs if kfs else None


def parse_kenburns(elem):
    f = elem.find('filter[@type="kenBurns"]')
    if f is None:
        return None
    keys = ['startTop','startLeft','startWidth','startHeight',
            'endTop',  'endLeft',  'endWidth',  'endHeight']
    return {k: round(float(f.get(k, 0))) for k in keys}


def extract_text_style(raw_html: str) -> dict:
    txt = unescape(raw_html or '')
    # Strip HTML tags, preserve line breaks at </div>
    text_only = re.sub(r'</div>', '\n', txt)
    text_only = re.sub(r'<[^>]+>', '', text_only)
    text_only = re.sub(r'\n{2,}', '\n', text_only).strip()
    fs  = re.search(r'font-size:\s*([\d.]+)px',                 txt)
    col = re.search(r'color:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)',txt)
    ff  = re.search(r'font-family:\s*([^;\"<]+)',               txt)
    lh  = re.search(r'line-height:\s*([\d.]+)%',                txt)
    ls  = re.search(r'letter-spacing:\s*([-\d.]+)px',           txt)
    ta  = re.search(r'text-align:\s*(\w+)',                     txt)
    return {
        "text":          text_only,
        "fontSize":      float(fs.group(1)) if fs else 46.0,
        "fill":          '#{:02x}{:02x}{:02x}'.format(
                             int(col.group(1)),int(col.group(2)),int(col.group(3))
                         ) if col else '#ffffff',
        "fontFamily":    ff.group(1).strip() if ff else 'Arial',
        "lineHeight":    float(lh.group(1)) / 100.0 if lh else 1.2,
        "letterSpacing": float(ls.group(1)) if ls else 0.0,
        "textAlign":     ta.group(1) if ta else 'left',
    }


def xml_to_json(xml_str: str, W: int = 1920, H: int = 1080) -> dict:
    root  = ET.fromstring(xml_str)
    items = []
    z     = 0

    for layer in root.findall('.//layer'):
        trans_obj = None
        trans = layer.find('transition')
        if trans is not None:
            trans_obj = {
                "type":     trans.get('type'),
                "duration": ms_to_sec(trans.get('duration', '0')),
                "delay":    ms_to_sec(trans.get('begin',    '0')),
            }

        for elem in layer:
            if elem.tag == 'transition':
                continue

            tag      = elem.tag
            begin    = ms_to_sec(elem.get('begin',    '0'))
            duration = ms_to_sec(elem.get('duration', '0'))
            left     = round(float(elem.get('left',   '0')))
            top      = round(float(elem.get('top',    '0')))
            width    = round(float(elem.get('width',  '0')))
            height   = round(float(elem.get('height', '0')))
            src      = elem.get('src', '')
            rot_raw  = round(float(elem.get('rotation', '0')))
            rot_deg  = rot_raw if rot_raw <= 180 else rot_raw - 360
            valign   = elem.get('valign', 'top')
            volume   = float(elem.get('volume', '1.0'))

            # Revideo centre coords from element's own top/left
            pos_x = left + width  / 2.0 - W / 2.0
            pos_y = top  + height / 2.0 - H / 2.0

            op_kfs = parse_opacity_keyframes(elem)
            kb     = parse_kenburns(elem)

            item = {
                "id":        f"{tag}-{z}",
                "zIndex":    z,
                "startTime": begin,
                "duration":  duration,
            }
            if trans_obj: item["transition"]       = trans_obj
            if op_kfs:    item["opacityKeyframes"] = op_kfs

            if tag == 'video':
                item.update({
                    "type":     "video",
                    "src":      src,
                    "position": {"x": pos_x, "y": pos_y},
                    "size":     {"width": width, "height": height},
                    "opacity":  1, "loop": False, "play": True, "volume": volume,
                })

            elif tag == 'image':
                item.update({
                    "type":     "image",
                    "src":      src,
                    "position": {"x": pos_x, "y": pos_y},
                    "size":     {"width": width, "height": height},
                    "opacity":  1, "rotation": rot_deg,
                })
                if kb: item["kenBurns"] = kb

            elif tag == 'audio':
                item.update({
                    "type":           "audio",
                    "src":            src,
                    "audioStartTime": ms_to_sec(elem.get('audioStartTime', '0')),
                    "play": True, "volume": volume,
                })

            elif tag == 'text':
                style = extract_text_style(elem.text or '')
                item.update({
                    "type":          "text",
                    "text":          style["text"],
                    # pos_x/pos_y from element's own left/top (used for non-scroll text)
                    "position":      {"x": pos_x, "y": pos_y},
                    "size":          {"width": width, "height": height},
                    "fontSize":      style["fontSize"],
                    "fontFamily":    style["fontFamily"],
                    "fill":          style["fill"],
                    "opacity":       1,
                    "rotation":      rot_deg,
                    "textAlign":     style["textAlign"],
                    "lineHeight":    style["lineHeight"],
                    "letterSpacing": style["letterSpacing"],
                    "verticalAlign": valign,
                })
                # kenBurns on text = scroll animation
                # project.tsx uses kb.startTop/endTop to compute startY/endY
                if kb: item["kenBurns"] = kb

            else:
                z += 1
                continue

            items.append(item)
            z += 1

    return {
        "settings": {"size": {"x": W, "y": H}, "background": "#000000"},
        "timeline": items,
    }


def convert_csv(csv_path: str, out_dir: str):
    os.makedirs(out_dir, exist_ok=True)
    converted = errors = 0
    with open(csv_path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            if not row.get('template', '').strip():
                continue
            try:
                config    = xml_to_json(row['template'])
                safe_name = re.sub(r'[^\w\-]', '_', row.get('name', row['id']))
                out_path  = os.path.join(out_dir, f"{row['id']}_{safe_name}.json")
                with open(out_path, 'w', encoding='utf-8') as out:
                    json.dump(config, out, indent=2)
                converted += 1
            except Exception as e:
                print(f"  ERROR id={row.get('id')} {row.get('name')}: {e}", file=sys.stderr)
                errors += 1
    print(f"Converted: {converted}  Errors: {errors}")


if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('input',    nargs='?', help='Single XML file')
    p.add_argument('output',   nargs='?', help='Output JSON (default: stdout)')
    p.add_argument('--csv',    help='CSV with multiple templates')
    p.add_argument('--out-dir',default='./json_configs')
    args = p.parse_args()
    if args.csv:
        convert_csv(args.csv, args.out_dir)
    elif args.input:
        result = xml_to_json(open(args.input).read())
        out    = json.dumps(result, indent=2)
        if args.output:
            open(args.output, 'w').write(out)
            print(f"Written to {args.output}")
        else:
            print(out)
    else:
        p.print_help()