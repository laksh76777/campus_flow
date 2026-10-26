/*
  Pure Markdown parsing for chat replies (no React), kept separate so it can be
  unit-checked in isolation. Every loop advances its index on each iteration.
*/

const INLINE_SOURCE =
  /(`[^`\n]+`)|(\*\*(?!\s)[^*\n]+?\*\*|(?<!\w)__[^_\n]+__(?!\w))|(\*(?![\s*])[^*\n]+?(?<!\s)\*|(?<!\w)_(?!\s)[^_\n]+?(?<!\s)_(?!\w))|(\[[^\]\n]+\]\((https?:\/\/[^\s)]+)\))/
    .source;

/** Split a line into inline tokens: text, code, strong, em, link. */
export function tokenizeInline(text) {
  const tokens = [];
  const pattern = new RegExp(INLINE_SOURCE, "g");
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) tokens.push({ type: "text", text: text.slice(lastIndex, match.index) });
    const [token] = match;
    if (match[1]) tokens.push({ type: "code", text: token.slice(1, -1) });
    else if (match[2]) tokens.push({ type: "strong", children: tokenizeInline(token.slice(2, -2)) });
    else if (match[3]) tokens.push({ type: "em", children: tokenizeInline(token.slice(1, -1)) });
    else if (match[4]) tokens.push({ type: "link", href: match[5], text: token.slice(1, token.indexOf("](")) });
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) tokens.push({ type: "text", text: text.slice(lastIndex) });
  return tokens;
}

const BULLET = /^\s*(?:[-*+•])\s+(.*)$/;
const ORDERED = /^\s*(\d+)[.)]\s+(.*)$/;
const HEADING = /^(#{1,4})\s+(.*)$/;
const FENCE = /^\s*```/;
const QUOTE = /^\s*>/;
const RULE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const splitRow = (row) =>
  row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

const startsBlock = (line) =>
  HEADING.test(line) || FENCE.test(line) || BULLET.test(line) || ORDERED.test(line) || QUOTE.test(line) || RULE.test(line);

/** Parse Markdown source into a flat list of block descriptors. */
export function parseBlocks(source) {
  const lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    if (FENCE.test(line)) {
      const code = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) code.push(lines[i++]);
      i++; // closing fence (or past the end)
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1])) {
      const header = splitRow(line);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(splitRow(lines[i++]));
      blocks.push({ type: "table", header, rows });
      continue;
    }

    if (QUOTE.test(line)) {
      const quote = [];
      while (i < lines.length && QUOTE.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push({ type: "quote", lines: quote });
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = !BULLET.test(line);
      const pattern = ordered ? ORDERED : BULLET;
      const items = [];
      const start = ordered ? Number(line.match(ORDERED)[1]) : undefined;
      while (i < lines.length && lines[i].trim()) {
        const m = lines[i].match(pattern);
        if (m) {
          items.push([ordered ? m[2] : m[1]]);
        } else if (items.length && /^\s{2,}\S/.test(lines[i]) && !startsBlock(lines[i])) {
          items[items.length - 1].push(lines[i].trim());
        } else {
          break;
        }
        i++;
      }
      blocks.push({ type: ordered ? "ol" : "ul", items, start });
      continue;
    }

    // Paragraph: always consumes at least the current line.
    const paragraph = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) paragraph.push(lines[i++]);
    blocks.push({ type: "p", lines: paragraph });
  }

  return blocks;
}
