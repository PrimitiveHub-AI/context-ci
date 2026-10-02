#!/usr/bin/env python3
"""Reformat the pandoc-converted docx into IEEE conference layout.

Input : ieee_base.docx   (pandoc main.tex --citeproc --csl ieee.csl)
Output: main-ieee.docx

Applies: US-Letter + IEEE margins; full-width title block above a
two-column body (continuous section break); Times New Roman 10 pt
justified body; 24 pt centered title; 9 pt Abstract/Index-Terms; roman-
numeral centered Section heads; lettered italic subsections; 8 pt
hanging-indent references. Not a byte-clone of IEEE's official template,
but genuine two-column IEEE styling rather than a single-column article.
"""
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

DOC = Document("ieee_base.docx")
TNR = "Times New Roman"


def roman(n):
    vals = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"),
            (90, "XC"), (50, "L"), (40, "XL"), (10, "X"), (9, "IX"),
            (5, "V"), (4, "IV"), (1, "I")]
    out = ""
    for v, s in vals:
        while n >= v:
            out += s
            n -= v
    return out


def set_font(p, size, *, bold=False, italic=False, smallcaps=False,
             name=TNR):
    for r in p.runs:
        r.font.name = name
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.italic = italic
        r.font.color.rgb = RGBColor(0, 0, 0)
        rpr = r._element.get_or_add_rPr()
        rpr.rFonts.set(qn("w:cs"), name) if rpr.find(qn("w:rFonts")) is not None else None
        if smallcaps:
            sc = OxmlElement("w:smallCaps")
            rpr.append(sc)


def prefix(p, text):
    if p.runs:
        p.runs[0].text = text + p.runs[0].text
    else:
        p.add_run(text)


def make_sectpr(cols, *, continuous):
    sp = OxmlElement("w:sectPr")
    if continuous:
        t = OxmlElement("w:type"); t.set(qn("w:val"), "continuous"); sp.append(t)
    pg = OxmlElement("w:pgSz"); pg.set(qn("w:w"), "12240"); pg.set(qn("w:h"), "15840")
    sp.append(pg)
    mar = OxmlElement("w:pgMar")
    for k, v in (("top", "1080"), ("bottom", "1440"), ("left", "900"),
                 ("right", "900"), ("header", "720"), ("footer", "720"),
                 ("gutter", "0")):
        mar.set(qn("w:" + k), v)
    sp.append(mar)
    c = OxmlElement("w:cols")
    c.set(qn("w:num"), str(cols))
    c.set(qn("w:space"), "360")
    if cols > 1:
        c.set(qn("w:equalWidth"), "1")
    sp.append(c)
    return sp


# --- base Normal style: Times 10 ---
normal = DOC.styles["Normal"]
normal.font.name = TNR
normal.font.size = Pt(10)

paras = DOC.paragraphs

# locate landmark paragraphs
abstract_i = title_i = author_i = keywords_i = first_h1_i = None
for i, p in enumerate(paras):
    s = p.style.name
    if s == "Title" and title_i is None:
        title_i = i
    elif s == "Author" and author_i is None:
        author_i = i
    elif s == "Abstract" and abstract_i is None:
        abstract_i = i
    elif s == "Heading 1" and first_h1_i is None:
        first_h1_i = i
if abstract_i is not None:
    keywords_i = abstract_i + 1  # pandoc puts IEEEkeywords right after

# --- title ---
if title_i is not None:
    p = paras[title_i]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(p, 24)
    p.paragraph_format.space_after = Pt(6)

# --- author block (pandoc leaves it empty; set it) ---
if author_i is not None:
    p = paras[author_i]
    for r in list(p.runs):
        r.text = ""
    lines = ["CyberOrca Labs", "PrimitiveHub Project",
             "Correspondence: security@primitivehub.ai"]
    run = p.add_run(lines[0]);
    for ln in lines[1:]:
        run = p.add_run()
        run.add_break()
        run.text = ln
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(p, 11)
    p.paragraph_format.space_after = Pt(10)

# --- abstract: drop the "Abstract" heading, bold 9pt lead-in ---
for i, p in enumerate(paras):
    if p.style.name == "Abstract Title":
        p._element.getparent().remove(p._element)
        break
if abstract_i is not None:
    # index shifted by removal of Abstract Title (which was before abstract)
    p = next(x for x in DOC.paragraphs if x.style.name == "Abstract")
    prefix(p, "Abstract—")
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    set_font(p, 9, bold=True)

# --- keywords -> Index Terms (the para right after abstract) ---
ap = None
plist = DOC.paragraphs
for i, p in enumerate(plist):
    if p.style.name == "Abstract":
        ap = i
        break
if ap is not None and ap + 1 < len(plist):
    kp = plist[ap + 1]
    if kp.style.name not in ("Heading 1",):
        prefix(kp, "Index Terms—")
        kp.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        set_font(kp, 9, bold=True, italic=True)
        kp.paragraph_format.space_after = Pt(8)
        keyword_para = kp
    else:
        keyword_para = None
else:
    keyword_para = None

# --- headings + body ---
roman_n = 0
letter = 0
for p in DOC.paragraphs:
    s = p.style.name
    if s == "Heading 1":
        if p.text.strip().lower() == "references":
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            set_font(p, 10, smallcaps=True)
            continue
        roman_n += 1
        letter = 0
        prefix(p, f"{roman(roman_n)}. ")
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        set_font(p, 10, smallcaps=True)
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(3)
    elif s == "Heading 2":
        letter += 1
        prefix(p, f"{chr(64 + letter)}. ")
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        set_font(p, 10, italic=True)
        p.paragraph_format.space_before = Pt(6)
        p.paragraph_format.space_after = Pt(2)
    elif s in ("Heading 3", "Heading 4", "Heading 5"):
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        set_font(p, 10, italic=True)
        p.paragraph_format.space_before = Pt(4)
        p.paragraph_format.space_after = Pt(1)
    elif s in ("First Paragraph", "Body Text", "Normal", "Definition",
               "Definition Term", "Source Code", "Compact"):
        if p is (keyword_para if keyword_para else None):
            continue
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        set_font(p, 10)
        p.paragraph_format.line_spacing = 1.0
        p.paragraph_format.space_after = Pt(0)
        if s in ("First Paragraph", "Body Text", "Normal"):
            p.paragraph_format.first_line_indent = Inches(0.2)
    elif s == "Bibliography":
        set_font(p, 8)
        p.paragraph_format.space_after = Pt(2)
    elif s == "Table Caption":
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        set_font(p, 8)

# --- tables: 8pt ---
for t in DOC.tables:
    for row in t.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                for r in p.runs:
                    r.font.name = TNR
                    r.font.size = Pt(8)

# --- insert "References" heading if absent ---
has_ref_h = any(p.style.name == "Heading 1" and p.text.strip().lower() == "references"
                for p in DOC.paragraphs)
if not has_ref_h:
    bib = next((p for p in DOC.paragraphs if p.style.name == "Bibliography"), None)
    if bib is not None:
        new = bib.insert_paragraph_before("References", style="Heading 1")
        new.alignment = WD_ALIGN_PARAGRAPH.CENTER
        set_font(new, 10, smallcaps=True)

# --- two-column body with full-width title block ---
# Section 1 (title..keywords) = 1 column; embed its sectPr in the last
# para before the first Heading 1. Body sectPr (section 2) = 2 columns.
body = DOC.element.body
body_sectpr = body.find(qn("w:sectPr"))
if body_sectpr is not None:
    body.remove(body_sectpr)
body.append(make_sectpr(2, continuous=False))  # section 2 = two columns

# find last paragraph before first Heading 1 (the keywords para)
split_para = None
for p in DOC.paragraphs:
    if p.style.name == "Heading 1":
        break
    split_para = p
if split_para is not None:
    ppr = split_para._p.get_or_add_pPr()
    ppr.append(make_sectpr(1, continuous=True))  # section 1 = one column

DOC.save("main-ieee.docx")
print("wrote main-ieee.docx")
