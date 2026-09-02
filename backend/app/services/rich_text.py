from __future__ import annotations

from dataclasses import dataclass
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlsplit


ALLOWED_TAGS = {"p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "ul", "ol", "li", "blockquote", "a"}
BLOCK_TAGS = {"p", "h2", "h3", "li", "blockquote"}
SUPPRESSED_TAGS = {"script", "style", "iframe", "object", "embed", "svg", "math", "template"}
TAG_ALIASES = {"div": "p", "strike": "s"}


def _safe_href(value: str) -> str | None:
    href = value.strip()
    if not href:
        return None
    parsed = urlsplit(href)
    if parsed.scheme.lower() in {"http", "https", "mailto"}:
        return href
    if not parsed.scheme and (href.startswith("/") or href.startswith("#")):
        return href
    return None


class _Sanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.stack: list[str] = []
        self.suppressed_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = TAG_ALIASES.get(tag.lower(), tag.lower())
        if self.suppressed_depth:
            if tag in SUPPRESSED_TAGS:
                self.suppressed_depth += 1
            return
        if tag in SUPPRESSED_TAGS:
            self.suppressed_depth = 1
            return
        if tag not in ALLOWED_TAGS:
            return
        if tag == "br":
            self.parts.append("<br>")
            return
        if tag == "a":
            href = next((value for name, value in attrs if name.lower() == "href" and value), "")
            safe_href = _safe_href(href or "")
            if safe_href:
                self.parts.append(f'<a href="{escape(safe_href, quote=True)}">')
                self.stack.append("a")
            return
        self.parts.append(f"<{tag}>")
        self.stack.append(tag)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        tag = TAG_ALIASES.get(tag.lower(), tag.lower())
        if self.suppressed_depth:
            if tag in SUPPRESSED_TAGS:
                self.suppressed_depth -= 1
            return
        if tag == "br" or tag not in self.stack:
            return
        while self.stack:
            opened = self.stack.pop()
            self.parts.append(f"</{opened}>")
            if opened == tag:
                break

    def handle_data(self, data: str) -> None:
        if not self.suppressed_depth:
            self.parts.append(escape(data))

    def finish(self) -> str:
        while self.stack:
            self.parts.append(f"</{self.stack.pop()}>")
        return "".join(self.parts).strip()


@dataclass
class RichTextRun:
    text: str
    bold: bool = False
    italic: bool = False
    underline: bool = False
    strike: bool = False
    href: str | None = None


@dataclass
class RichTextBlock:
    kind: str
    runs: list[RichTextRun]
    ordinal: int | None = None


class _BlockParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.blocks: list[RichTextBlock] = []
        self.current: RichTextBlock | None = None
        self.styles = {"bold": 0, "italic": 0, "underline": 0, "strike": 0}
        self.href_stack: list[str | None] = []
        self.list_stack: list[dict[str, int | str]] = []

    def _begin(self, kind: str, ordinal: int | None = None) -> None:
        self._flush()
        self.current = RichTextBlock(kind=kind, runs=[], ordinal=ordinal)

    def _flush(self) -> None:
        if self.current and any(run.text for run in self.current.runs):
            self.blocks.append(self.current)
        self.current = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in {"ul", "ol"}:
            self.list_stack.append({"type": tag, "counter": 0})
        elif tag == "li":
            ordinal = None
            kind = "bullet"
            if self.list_stack and self.list_stack[-1]["type"] == "ol":
                self.list_stack[-1]["counter"] = int(self.list_stack[-1]["counter"]) + 1
                ordinal = int(self.list_stack[-1]["counter"])
                kind = "number"
            self._begin(kind, ordinal)
        elif tag in BLOCK_TAGS:
            self._begin("heading" if tag in {"h2", "h3"} else "quote" if tag == "blockquote" else "paragraph")
        elif tag in {"strong", "b"}:
            self.styles["bold"] += 1
        elif tag in {"em", "i"}:
            self.styles["italic"] += 1
        elif tag == "u":
            self.styles["underline"] += 1
        elif tag == "s":
            self.styles["strike"] += 1
        elif tag == "a":
            self.href_stack.append(next((value for name, value in attrs if name == "href"), None))
        elif tag == "br":
            self.handle_data("\n")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in BLOCK_TAGS:
            self._flush()
        elif tag in {"ul", "ol"}:
            if self.list_stack:
                self.list_stack.pop()
        elif tag in {"strong", "b"}:
            self.styles["bold"] = max(0, self.styles["bold"] - 1)
        elif tag in {"em", "i"}:
            self.styles["italic"] = max(0, self.styles["italic"] - 1)
        elif tag == "u":
            self.styles["underline"] = max(0, self.styles["underline"] - 1)
        elif tag == "s":
            self.styles["strike"] = max(0, self.styles["strike"] - 1)
        elif tag == "a" and self.href_stack:
            self.href_stack.pop()

    def handle_data(self, data: str) -> None:
        if not data:
            return
        if self.current is None:
            self.current = RichTextBlock(kind="paragraph", runs=[])
        self.current.runs.append(RichTextRun(
            text=data,
            bold=bool(self.styles["bold"]), italic=bool(self.styles["italic"]),
            underline=bool(self.styles["underline"]), strike=bool(self.styles["strike"]),
            href=self.href_stack[-1] if self.href_stack else None,
        ))

    def finish(self) -> list[RichTextBlock]:
        self._flush()
        return self.blocks


def sanitize_rich_text(value: str) -> str:
    parser = _Sanitizer()
    parser.feed(value or "")
    parser.close()
    sanitized = parser.finish()
    return sanitized if rich_text_plain(sanitized) else ""


def rich_text_blocks(value: str) -> list[RichTextBlock]:
    parser = _BlockParser()
    parser.feed(sanitize_rich_text(value))
    parser.close()
    return parser.finish()


def rich_text_plain(value: str) -> str:
    blocks = _BlockParser()
    blocks.feed(value or "")
    blocks.close()
    lines = ["".join(run.text for run in block.runs).strip() for block in blocks.finish()]
    return "\n".join(line for line in lines if line).strip()


def rich_text_markdown(value: str) -> str:
    lines: list[str] = []
    for block in rich_text_blocks(value):
        rendered: list[str] = []
        for run in block.runs:
            text = run.text.replace("\\", "\\\\").replace("*", "\\*")
            if run.href:
                text = f"[{text}]({run.href})"
            if run.bold:
                text = f"**{text}**"
            if run.italic:
                text = f"*{text}*"
            if run.underline:
                text = f"<u>{text}</u>"
            if run.strike:
                text = f"~~{text}~~"
            rendered.append(text)
        body = "".join(rendered).strip()
        if not body:
            continue
        if block.kind == "heading":
            body = f"### {body}"
        elif block.kind == "bullet":
            body = f"- {body}"
        elif block.kind == "number":
            body = f"{block.ordinal or 1}. {body}"
        elif block.kind == "quote":
            body = "\n".join(f"> {line}" for line in body.splitlines())
        lines.append(body)
    return "\n\n".join(lines).strip()
