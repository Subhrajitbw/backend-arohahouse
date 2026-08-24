#!/usr/bin/env python3
"""
Generate Sanity NDJSON for 15 products in Medusa that are missing from Sanity.
Properly parses structured HTML descriptions using ________ as section delimiters.
"""
import re, json, uuid, time, html
from pathlib import Path

ROOT         = Path(__file__).parent.parent
NDJSON_PATH  = ROOT / "data.ndjson"
SQL_PATH     = ROOT / "aroha-full-20260822.sql"
OUTPUT_PATH  = ROOT / "missing_products_sanity.ndjson"

SKIP_HANDLES = {'t-shirt','sweatshirt','shorts','sweatpants','test'}
SKIP_TITLE   = ['medusa', 'test']

# ── text utils ────────────────────────────────────────────────────────────────

def strip_html(raw: str) -> str:
    text = html.unescape(raw or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[\r\n]+", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()

def extract_bullets(block: str) -> list:
    """Extract bullet-point lines (•, ✔, -, *) from a text block."""
    lines = [l.strip() for l in block.split("\n") if l.strip()]
    bullets = []
    for line in lines:
        m = re.match(r"^[•✔\-\*]\s+(.+)", line)
        if m:
            bullets.append(m.group(1).strip())
    return bullets

def extract_spec_table(block: str) -> list:
    """Extract tab-separated Attribute/Specification rows."""
    specs = []
    seen = {"Attribute", "Specification", "Field", "Details"}
    for line in block.split("\n"):
        parts = re.split(r"\t", line.strip(), maxsplit=1)
        if len(parts) == 2:
            label, value = parts[0].strip(), parts[1].strip()
            if label and value and label not in seen and value not in seen:
                specs.append({"label": label, "value": value})
    return specs

def split_sections(plain: str) -> dict:
    """
    Split the plain-text description on ________ dividers and return
    a dict keyed by normalised section name.
    """
    # Use the horizontal rule as a reliable delimiter
    chunks = re.split(r"_{8,}", plain)
    sections = {}
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        # First non-empty line is the section header
        lines = chunk.split("\n")
        header = lines[0].strip().lower()
        body = "\n".join(lines[1:]).strip()
        # Normalise common headers
        if re.search(r"product overview", header):
            sections["overview"] = body
        elif re.search(r"key features", header):
            sections["key_features"] = body
        elif re.search(r"product details", header):
            sections["specs"] = body
        elif re.search(r"warranty", header):
            sections["warranty"] = body
        elif re.search(r"disclaimer", header):
            sections["disclaimer"] = body
        elif re.search(r"care instructions", header):
            sections["care"] = body
        elif re.search(r"brand|manufacturing", header):
            sections["brand"] = body
        elif re.search(r"shipping", header):
            sections["shipping"] = body
        elif re.search(r"why aroha", header):
            sections["why"] = body
        elif re.search(r"need help", header):
            sections["cta_help"] = body
        else:
            # Could be the final SEO tail paragraph
            if "aroha house" in chunk.lower() and "—" in chunk:
                sections["seo_tail"] = chunk
    return sections

def parse_overview(raw: str) -> tuple:
    """
    Returns (main_para, search_tags_list).
    The overview sometimes ends with 'This product matches search patterns for:\n...'
    """
    # Strip out search tag paragraph
    tag_m = re.search(
        r"(?:search patterns for|searching for|searches like)[:\s]*\n(.*?)$",
        raw, re.DOTALL | re.IGNORECASE
    )
    tags = []
    if tag_m:
        raw_tags = tag_m.group(1)
        tags = [t.strip() for t in re.split(r"[•\n]", raw_tags) if t.strip() and len(t.strip()) > 3]
        main = raw[:tag_m.start()].strip()
    else:
        main = raw.strip()
    return main, tags[:10]

def parse_care(raw: str) -> list:
    """
    Care section has sub-headings like 'Upholstery' / 'Frame / Legs'.
    Extract all bullets across both sub-sections.
    """
    return extract_bullets(raw)

# ── doc builders ─────────────────────────────────────────────────────────────

def make_key(prefix="k"):
    return prefix + uuid.uuid4().hex[:24]

def portable_text_blocks(paragraphs: list) -> list:
    blocks = []
    for i, para in enumerate(paragraphs):
        para = para.strip()
        if not para:
            continue
        ts = int(time.time() * 1000)
        blocks.append({
            "_key": f"block-{ts}-{i}",
            "_type": "block",
            "children": [{"_key": f"span-{ts}-{i}", "_type": "span", "marks": [], "text": para}],
            "markDefs": [],
            "style": "normal"
        })
    return blocks

def infer_material(title: str, subtitle: str) -> str:
    c = (title + " " + subtitle).lower()
    if "leather" in c: return "Premium Leather"
    if "velvet" in c:  return "Premium Velvet Upholstery"
    if "bouclé" in c or "boucle" in c: return "Bouclé Fabric Upholstery"
    if "rattan" in c:  return "Natural Rattan + Solid Wood"
    return "Solid / Engineered Wood Frame + Premium Upholstery"

def infer_category(title: str, subtitle: str) -> str:
    c = (title + " " + subtitle).lower()
    if "chesterfield" in c or "wingback" in c: return "Classic Heritage Chairs"
    if "swivel" in c:  return "Swivel Lounge Chairs"
    if "chaise" in c:  return "Chaise Lounge Chairs"
    if "sofa" in c:    return "Sofas"
    return "Lounge & Accent Chairs"

def make_faqs(title: str, material: str) -> list:
    return [
        {
            "_key": make_key("faq"),
            "question": f"Can I customise the upholstery of the {title}?",
            "answer": (
                f"Yes. The {title} is fully customisable — choose from our curated range of "
                "fabric, velvet, bouclé, and leather options. Contact our design team for "
                "swatches and bespoke finish recommendations."
            )
        },
        {
            "_key": make_key("faq"),
            "question": "What is the delivery timeline?",
            "answer": (
                "All Aroha House pieces are made-to-order with a standard delivery window of "
                "30–35 days. Express timelines may be available — please reach out to confirm."
            )
        },
        {
            "_key": make_key("faq"),
            "question": f"Is the {title} suitable for commercial or hospitality use?",
            "answer": (
                f"Absolutely. The {title} is built to contract-grade specifications, making it "
                "ideal for hotel lobbies, boutique cafés, co-working lounges, and luxury retail interiors."
            )
        },
        {
            "_key": make_key("faq"),
            "question": "What warranty does the product carry?",
            "answer": (
                "Aroha House provides a 12-month structural warranty on all handcrafted pieces. "
                "Each chair is individually inspected before dispatch."
            )
        }
    ]

def build_doc(prod: dict) -> dict:
    pid       = prod["id"]
    title     = prod["title"]
    handle    = prod["handle"]
    subtitle  = prod.get("subtitle", "") or ""
    raw_desc  = prod.get("description", "") or ""
    thumbnail = prod.get("thumbnail", "") or ""
    created_at = prod.get("created_at", "2025-11-25T00:00:00Z") or "2025-11-25T00:00:00Z"
    created_at = re.sub(r"(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\.\d+\+\d+:\d+", r"\1T\2Z", created_at)

    plain    = strip_html(raw_desc).replace("\\n", "\n").replace("\\t", "\t")
    sec      = split_sections(plain)
    material = infer_material(title, subtitle)
    category = infer_category(title, subtitle)

    # --- overview + search tags ---
    raw_overview = sec.get("overview", "")
    overview_main, search_tags = parse_overview(raw_overview)

    # --- short intro ---
    if subtitle and len(subtitle) > 20:
        part1 = subtitle.split("•")[0].strip()
        short_intro = f"The {title} — {part1}. A statement piece by Aroha House, crafted for discerning interiors."
    elif overview_main:
        short_intro = overview_main[:220].strip().rstrip(".") + "."
    else:
        short_intro = f"The {title} is a premium handcrafted piece by Aroha House, designed for luxury homes, boutique hotels, and curated interior spaces."

    # --- description blocks ---
    desc_paragraphs = []
    if overview_main:
        # Split overview into natural paragraphs
        paras = [p.strip() for p in overview_main.split("\n") if p.strip()]
        desc_paragraphs.extend(paras)
    why_bullets = extract_bullets(sec.get("why", ""))
    if why_bullets:
        desc_paragraphs.append("Why choose this piece: " + " • ".join(why_bullets))

    # --- key features ---
    key_features = extract_bullets(sec.get("key_features", ""))
    if not key_features:
        key_features = [
            "Handcrafted solid wood / engineered wood internal frame",
            "High-density cushions with premium upholstery fabric",
            "Fully customisable upholstery, colours & finishes",
            "Durable joinery & artisan craftsmanship",
            "Designed for both residential and hospitality use"
        ]

    # --- additional specs ---
    raw_specs = extract_spec_table(sec.get("specs", ""))
    additional_specs = [
        {"_key": make_key("spec"), "label": s["label"], "value": s["value"]}
        for s in raw_specs
    ]
    if not additional_specs:
        additional_specs = [
            {"_key": make_key("spec"), "label": "Style",    "value": category},
            {"_key": make_key("spec"), "label": "Assembly", "value": "Fully assembled – no installation needed"},
            {"_key": make_key("spec"), "label": "Origin",   "value": "India"},
        ]

    # --- care instructions ---
    care = parse_care(sec.get("care", ""))
    if not care:
        care = [
            "Vacuum upholstery regularly with a soft brush attachment.",
            "Blot spills immediately with a clean dry cloth.",
            "Wipe frame / legs with a soft damp cloth; avoid harsh chemicals.",
            "Keep away from direct sunlight and heat sources.",
            "Professional upholstery cleaning recommended annually."
        ]

    # --- why this product ---
    why_this = why_bullets or [
        "Premium handcrafted quality with artisan attention to detail",
        "Fully customisable upholstery, colour, and finish",
        "Contract-grade durability for residential and hospitality use",
        "Design-led silhouette that acts as a statement piece"
    ]

    # --- comparison / SEO tags ---
    comparison_tags = search_tags or [
        f"{category} India",
        f"premium handcrafted {category.lower()}",
        "Aroha House luxury furniture",
        "designer accent chair India",
        "bespoke handcrafted seating"
    ]

    # --- perfect for ---
    perfect_for = []
    sub_lc = subtitle.lower()
    if "hotel" in sub_lc or "hospitality" in sub_lc: perfect_for.append("Luxury hotel suites, boutique lobbies & hospitality spaces")
    if "café" in sub_lc or "cafe" in sub_lc:         perfect_for.append("Boutique cafés, co-working lounges & creative studios")
    if "living" in sub_lc:                            perfect_for.append("Premium living rooms, reading corners & family lounges")
    if "office" in sub_lc:                            perfect_for.append("Executive offices, boardrooms & waiting areas")
    if "library" in sub_lc or "lounge" in sub_lc:    perfect_for.append("Curated reading nooks, lounges & home libraries")
    if not perfect_for:
        perfect_for = [
            "Premium living rooms and reading corners",
            "Boutique hotel suites and lobby seating",
            "Co-working lounges and creative studios",
            "Statement accent piece in curated interiors"
        ]

    # --- SEO ---
    seo_title = f"{title} | Premium Handcrafted Chair | Aroha House"
    seo_desc  = (
        f"Discover the {title} by Aroha House"
        + (f" — {subtitle[:110]}" if subtitle else "")
        + ". Made-to-order, fully customisable. Enquire now."
    )
    ai_summary = (overview_main[:300] if overview_main else f"{title} by Aroha House. {subtitle[:200]}")

    # --- gallery ---
    gallery_r2 = [{"_key": make_key("img"), "url": thumbnail}] if thumbnail else []

    return {
        "_id":        pid,
        "_type":      "product",
        "_createdAt": created_at,
        "_updatedAt": created_at,
        "_rev":       make_key("rev"),
        "medusaId":   pid,
        "medusaType": None,
        "title":      title,
        "handle":     handle,
        "shortIntro": short_intro,
        "description":       portable_text_blocks(desc_paragraphs),
        "primaryMaterial":   material,
        "secondaryMaterials": [
            "Non-toxic, low-VOC lacquered finish",
            "Precision-cut high-density foam cushioning"
        ],
        "keyFeatures":       key_features,
        "careInstructions":  care,
        "comparisonTags":    comparison_tags,
        "additionalSpecs":   additional_specs,
        "perfectFor":        perfect_for,
        "whyThisProduct":    why_this,
        "useCaseScenarios": [
            f"A homeowner placing the {title} as a focal accent in their living room beside a floor lamp and curated books.",
            f"A boutique hotel sourcing the {title} for suite seating that impresses guests from the moment they enter.",
            f"An interior designer pairing the {title} with a side table and artwork to complete a curated lounge vignette."
        ],
        "faqs": make_faqs(title, material),
        "seo": {
            "metaTitle":       seo_title,
            "metaDescription": seo_desc,
            "aiSummary":       ai_summary
        },
        "thumbnailR2": {"url": thumbnail} if thumbnail else None,
        "galleryR2":   gallery_r2,
        "dimensions":  {"unit": "inch", "width": None, "depth": None, "height": None},
        "cta":         {"primary": "Enquire Now", "secondary": "Book a Consultation"}
    }

# ── main ─────────────────────────────────────────────────────────────────────

def main():
    print("Loading Sanity index ...")
    sanity_handles, sanity_ids = set(), set()
    with open(NDJSON_PATH) as f:
        for line in f:
            try:
                doc = json.loads(line)
                if doc.get("_type") == "product":
                    h   = doc.get("handle")
                    mid = doc.get("medusaId") or doc.get("_id","").replace("drafts.","")
                    if h:   sanity_handles.add(h)
                    if mid: sanity_ids.add(mid)
            except: pass
    print(f"  {len(sanity_ids)} products already in Sanity")

    print("Parsing SQL dump ...")
    content = SQL_PATH.read_text()
    block   = re.search(r"COPY public\.product \((.+?)\) FROM stdin;\n(.*?)\\.", content, re.DOTALL)
    cols    = [c.strip() for c in block.group(1).split(",")]
    rows    = block.group(2).strip().split("\n")

    missing = []
    for row in rows:
        fields = row.split("\t")
        if len(fields) < len(cols): continue
        prod   = dict(zip(cols, fields))
        pid    = prod.get("id","")
        handle = prod.get("handle","")
        title  = prod.get("title","")
        status = prod.get("status","")
        if handle in SKIP_HANDLES:                       continue
        if any(p in title.lower() for p in SKIP_TITLE): continue
        if status == "deleted":                          continue
        if pid in sanity_ids or handle in sanity_handles: continue
        missing.append(prod)

    print(f"  {len(missing)} products to generate ...")
    with open(OUTPUT_PATH, "w") as out:
        for prod in missing:
            doc = build_doc(prod)
            out.write(json.dumps(doc, ensure_ascii=False) + "\n")
            print(f"  [OK] {prod['title']}")

    print(f"\nDone -> {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
