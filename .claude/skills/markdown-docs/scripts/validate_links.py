#!/usr/bin/env python3
"""Validate all cross-document links in a markdown corpus.

Usage:
    python validate_links.py <docs-directory>
    python validate_links.py mddocs/

Checks:
    - Linked files exist
    - Fragment anchors point to existing headings
    - Reports duplicate heading slugs (ambiguous anchors)

Requirements:
    pip install markdown-it-py
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

try:
    from markdown_it import MarkdownIt
except ImportError:
    print(
        "Error: markdown-it-py is required. Install with: pip install markdown-it-py",
        file=sys.stderr,
    )
    sys.exit(1)


@dataclass
class LinkError:
    """Represents a validation error for a link."""

    source_file: Path
    line_number: int
    link_text: str
    target: str
    error: str


@dataclass
class Warning:
    """Represents a validation warning."""

    file: Path
    message: str


@dataclass
class Heading:
    """Represents a heading in a document."""

    level: int
    text: str
    slug: str
    line: int


@dataclass
class Link:
    """Represents a link found in a document."""

    text: str
    target: str
    line: int


@dataclass
class DocumentInfo:
    """Cached information about a markdown document."""

    path: Path
    headings: list[Heading] = field(default_factory=list)
    links: list[Link] = field(default_factory=list)
    heading_slugs: set[str] = field(default_factory=set)
    duplicate_slugs: list[str] = field(default_factory=list)


def strip_frontmatter(content: str) -> tuple[str, int]:
    """Strip YAML frontmatter from markdown content.

    Returns:
        Tuple of (content without frontmatter, number of lines stripped)
    """
    lines = content.split("\n")

    if not lines or lines[0].strip() != "---":
        return content, 0

    # Find closing ---
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            remaining_lines = lines[i + 1 :]
            return "\n".join(remaining_lines), i + 1

    return content, 0


def slugify(text: str) -> str:
    """Convert heading text to anchor slug (GitHub-Flavored Markdown style)."""
    slug = text.lower()
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"[^a-z0-9\-]", "", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def parse_document(path: Path) -> DocumentInfo:
    """Parse a markdown document to extract headings and links."""
    raw_content = path.read_text(encoding="utf-8")
    content, frontmatter_lines = strip_frontmatter(raw_content)
    md = MarkdownIt()
    tokens = md.parse(content)

    doc = DocumentInfo(path=path)
    slug_counts: dict[str, int] = {}

    i = 0
    while i < len(tokens):
        token = tokens[i]

        # Extract headings
        if token.type == "heading_open":
            level = int(token.tag[1])
            # Adjust line number: +1 for 1-based, + frontmatter_lines for offset
            line = (token.map[0] + 1 if token.map else 0) + frontmatter_lines

            if i + 1 < len(tokens) and tokens[i + 1].type == "inline":
                text = tokens[i + 1].content
            else:
                text = ""

            slug = slugify(text)
            doc.headings.append(Heading(level=level, text=text, slug=slug, line=line))
            doc.heading_slugs.add(slug)
            slug_counts[slug] = slug_counts.get(slug, 0) + 1

        # Extract links from inline content
        if token.type == "inline" and token.children:
            line = (token.map[0] + 1 if token.map else 0) + frontmatter_lines

            for child in token.children:
                if child.type == "link_open":
                    href = child.attrGet("href") or ""
                    # Find the link text in subsequent tokens
                    text = ""
                    j = token.children.index(child) + 1
                    while j < len(token.children):
                        if token.children[j].type == "link_close":
                            break
                        if token.children[j].type == "text":
                            text += token.children[j].content
                        j += 1

                    if href:
                        doc.links.append(Link(text=text, target=href, line=line))

        i += 1

    # Identify duplicate slugs
    doc.duplicate_slugs = [slug for slug, count in slug_counts.items() if count > 1]

    return doc


def resolve_heading_path(headings: list[Heading], path: str) -> bool:
    """Check if a hierarchical heading path exists.

    Args:
        headings: List of headings in the document
        path: Anchor path like "user-auth" or "user-auth/requirements"

    Returns:
        True if the path resolves to a valid heading
    """
    path = path.lstrip("#")
    parts = path.split("/")

    if not parts:
        return False

    # Simple anchor - just check if slug exists
    if len(parts) == 1:
        return any(h.slug == parts[0] for h in headings)

    # Hierarchical path - walk down the tree
    current_idx = 0
    current_level = 0

    for part in parts:
        found = False

        for i in range(current_idx, len(headings)):
            h = headings[i]

            if h.level <= current_level and current_level > 0:
                # Exited parent scope
                break

            if h.slug == part and h.level > current_level:
                current_level = h.level
                current_idx = i + 1
                found = True
                break

        if not found:
            return False

    return True


def validate_corpus(docs_dir: Path) -> tuple[list[LinkError], list[Warning]]:
    """Validate all links in markdown files under docs_dir."""
    errors: list[LinkError] = []
    warnings: list[Warning] = []

    md_files = list(docs_dir.rglob("*.md"))

    if not md_files:
        warnings.append(Warning(file=docs_dir, message="No markdown files found"))
        return errors, warnings

    # Parse all documents
    documents: dict[Path, DocumentInfo] = {}
    for md_file in md_files:
        try:
            documents[md_file.resolve()] = parse_document(md_file)
        except Exception as e:
            errors.append(
                LinkError(
                    source_file=md_file,
                    line_number=0,
                    link_text="",
                    target="",
                    error=f"Failed to parse document: {e}",
                )
            )

    # Check for duplicate slugs (warnings)
    for doc in documents.values():
        if doc.duplicate_slugs:
            warnings.append(
                Warning(
                    file=doc.path,
                    message=f"Duplicate heading slugs (use hierarchical paths): {doc.duplicate_slugs}",
                )
            )

    # Validate each link
    for doc in documents.values():
        for link in doc.links:
            # Skip external links
            if link.target.startswith(("http://", "https://", "mailto:", "tel:")):
                continue

            # Skip anchor-only links to same document
            if link.target.startswith("#"):
                fragment = link.target[1:]
                if not resolve_heading_path(doc.headings, fragment):
                    errors.append(
                        LinkError(
                            source_file=doc.path,
                            line_number=link.line,
                            link_text=link.text,
                            target=link.target,
                            error=f"Heading '#{fragment}' not found in this document",
                        )
                    )
                continue

            # Parse file path and fragment
            if "#" in link.target:
                file_part, fragment = link.target.split("#", 1)
            else:
                file_part, fragment = link.target, None

            # Resolve relative path
            target_path = (doc.path.parent / file_part).resolve()

            # Check file exists
            if not target_path.exists():
                errors.append(
                    LinkError(
                        source_file=doc.path,
                        line_number=link.line,
                        link_text=link.text,
                        target=link.target,
                        error=f"File not found: {file_part}",
                    )
                )
                continue

            # Skip non-markdown files (can't validate fragments)
            if not target_path.suffix.lower() == ".md":
                continue

            # Check fragment if present
            if fragment:
                target_doc = documents.get(target_path)
                if target_doc is None:
                    # Document outside the corpus, can't validate
                    continue

                if not resolve_heading_path(target_doc.headings, fragment):
                    available = ", ".join(sorted(target_doc.heading_slugs)[:5])
                    if len(target_doc.heading_slugs) > 5:
                        available += "..."
                    errors.append(
                        LinkError(
                            source_file=doc.path,
                            line_number=link.line,
                            link_text=link.text,
                            target=link.target,
                            error=f"Heading '#{fragment}' not found in {target_path.name}. Available: {available}",
                        )
                    )

    return errors, warnings


def format_path(path: Path, base_dir: Path) -> str:
    """Format a path relative to base directory for display."""
    try:
        return str(path.relative_to(base_dir))
    except ValueError:
        return str(path)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Validate markdown cross-document links",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Validate all links in mddocs/
    python validate_links.py mddocs/

    # Strict mode: treat warnings as errors
    python validate_links.py mddocs/ --strict

    # Show detailed output
    python validate_links.py mddocs/ --verbose
        """,
    )
    parser.add_argument("directory", help="Documentation directory to validate")
    parser.add_argument(
        "--strict", action="store_true", help="Treat warnings as errors"
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Show detailed output"
    )

    args = parser.parse_args()

    docs_dir = Path(args.directory).resolve()
    if not docs_dir.is_dir():
        print(f"Error: Not a directory: {docs_dir}", file=sys.stderr)
        sys.exit(1)

    if args.verbose:
        print(f"Validating markdown links in: {docs_dir}")

    errors, warnings = validate_corpus(docs_dir)

    # Print warnings
    for w in warnings:
        rel_path = format_path(w.file, docs_dir)
        print(f"  {rel_path}: {w.message}")

    if warnings:
        print()

    # Print errors
    for e in errors:
        rel_path = format_path(e.source_file, docs_dir)
        print(f"  {rel_path}:{e.line_number}")
        print(f"   Link: [{e.link_text}]({e.target})")
        print(f"   {e.error}")
        print()

    # Summary
    total_warnings = len(warnings)
    total_errors = len(errors)

    if total_warnings > 0:
        print(f"{total_warnings} warning(s)")

    if total_errors > 0:
        print(f"{total_errors} error(s)")
        sys.exit(1)

    if args.strict and total_warnings > 0:
        print("Failing due to --strict mode")
        sys.exit(1)

    if total_errors == 0 and total_warnings == 0:
        md_count = len(list(docs_dir.rglob("*.md")))
        print(f"All links valid ({md_count} files checked)")


if __name__ == "__main__":
    main()
