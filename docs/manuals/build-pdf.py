"""
Build PDF versions of the user manuals (task 74).

    python docs/manuals/build-pdf.py

Converts each manual's Markdown to HTML (a small converter covering what the manuals use:
headings, paragraphs, lists, tables, images, bold and inline code), then prints it to PDF with
headless Microsoft Edge or Google Chrome. Output: docs/manuals/pdf/<manual>.pdf
"""
import html
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "pdf"
MANUALS = ["administrator", "staff", "student"]

BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]

CSS = """
@page { size: A4; margin: 16mm 15mm; }
body { font-family: "Segoe UI", Arial, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #111827; }
h1 { font-size: 20pt; border-bottom: 3px solid #f97316; padding-bottom: 6px; margin-top: 0; }
h2 { font-size: 14pt; margin-top: 22px; color: #0f172a; page-break-after: avoid; }
h3 { font-size: 11.5pt; margin-top: 16px; page-break-after: avoid; }
p, li { margin: 4px 0; }
img { display: block; max-width: 100%; margin: 10px auto 14px; border: 1px solid #d1d5db; border-radius: 6px;
      page-break-inside: avoid; }
table { border-collapse: collapse; width: 100%; margin: 8px 0 12px; page-break-inside: avoid; font-size: 9.5pt; }
th, td { border: 1px solid #d1d5db; padding: 5px 7px; text-align: left; vertical-align: top; }
th { background: #f3f4f6; }
code { background: #f3f4f6; padding: 0 3px; border-radius: 3px; font-size: 9.5pt; }
.footer { margin-top: 24px; font-size: 8.5pt; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 6px; }
"""


def inline(text: str) -> str:
    text = html.escape(text, quote=False)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    return text


def to_html(md: str) -> str:
    out, para, lst = [], [], None  # lst: (tag, items)
    lines = md.splitlines()
    i = 0

    def flush_para():
        if para:
            out.append("<p>" + inline(" ".join(para)) + "</p>")
            para.clear()

    def flush_list():
        nonlocal lst
        if lst:
            tag, items = lst
            out.append(f"<{tag}>" + "".join(f"<li>{inline(it)}</li>" for it in items) + f"</{tag}>")
            lst = None

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        img = re.fullmatch(r"!\[([^\]]*)\]\(([^)]+)\)", stripped)
        heading = re.match(r"^(#{1,3}) (.*)", line)
        bullet = re.match(r"^- (.*)", line)
        number = re.match(r"^\d+\. (.*)", line)
        if not stripped:
            flush_para(); flush_list()
        elif heading:
            flush_para(); flush_list()
            n = len(heading.group(1))
            out.append(f"<h{n}>{inline(heading.group(2))}</h{n}>")
        elif img:
            flush_para(); flush_list()
            src = (HERE / img.group(2)).as_uri()
            out.append(f'<img src="{src}" alt="{html.escape(img.group(1))}">')
        elif stripped.startswith("|"):
            flush_para(); flush_list()
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{3,}:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            head, body = rows[0], rows[1:]
            out.append("<table><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr>"
                       + "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body)
                       + "</table>")
            continue
        elif bullet or number:
            flush_para()
            tag = "ul" if bullet else "ol"
            if not lst or lst[0] != tag:
                flush_list()
                lst = (tag, [])
            lst[1].append((bullet or number).group(1))
        elif lst and line.startswith("   "):
            lst[1][-1] += " " + stripped  # continuation of a list item
        else:
            flush_list()
            para.append(stripped)
        i += 1
    flush_para(); flush_list()
    return "\n".join(out)


def find_browser() -> str:
    for b in BROWSERS:
        if os.path.exists(b):
            return b
    for name in ("msedge", "google-chrome", "chromium", "chrome"):
        found = shutil.which(name)
        if found:
            return found
    sys.exit("No Edge or Chrome found: install one, or open the HTML files in docs/manuals/pdf and print to PDF.")


def main():
    OUT.mkdir(exist_ok=True)
    browser = find_browser()
    for name in MANUALS:
        md = (HERE / f"{name}.md").read_text(encoding="utf-8")
        title = md.splitlines()[0].lstrip("# ").strip()
        page = (f"<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'><title>{html.escape(title)}</title>"
                f"<style>{CSS}</style></head><body>{to_html(md)}"
                f"<div class='footer'>TAXBROS LMS user documentation. Screens may differ slightly from the "
                f"current version.</div></body></html>")
        html_path = OUT / f"{name}.html"
        html_path.write_text(page, encoding="utf-8")
        pdf_path = OUT / f"{name}.pdf"
        subprocess.run([browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                        f"--print-to-pdf={pdf_path}", html_path.as_uri()],
                       check=True, capture_output=True, timeout=120)
        html_path.unlink()
        print(f"{pdf_path.relative_to(HERE.parent.parent)}  ({pdf_path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
