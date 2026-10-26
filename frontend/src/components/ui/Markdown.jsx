import { Fragment, memo, useMemo } from "react";
import { parseBlocks, tokenizeInline } from "./markdownParser";

/*
  Lightweight, dependency-free Markdown renderer for AI chat replies.
  Produces React elements only (never innerHTML), so model output cannot
  inject markup. Supports headings, paragraphs, bullet/numbered lists
  (including "•" bullets), blockquotes, fenced code, horizontal rules,
  GitHub-style tables, and inline bold / italic / code / http(s) links.
*/

function renderTokens(tokens, keyPrefix) {
  return tokens.map((token, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (token.type) {
      case "code":
        return <code key={key}>{token.text}</code>;
      case "strong":
        return <strong key={key}>{renderTokens(token.children, key)}</strong>;
      case "em":
        return <em key={key}>{renderTokens(token.children, key)}</em>;
      case "link":
        return (
          <a key={key} href={token.href} target="_blank" rel="noopener noreferrer">
            {token.text}
          </a>
        );
      default:
        return <Fragment key={key}>{token.text}</Fragment>;
    }
  });
}

const renderInline = (text, keyPrefix) => renderTokens(tokenizeInline(text), keyPrefix);

function renderLines(lines, keyPrefix) {
  return lines.map((line, idx) => (
    <Fragment key={`${keyPrefix}-l${idx}`}>
      {idx > 0 && <br />}
      {renderInline(line, `${keyPrefix}-l${idx}`)}
    </Fragment>
  ));
}

function Markdown({ content, invert = false, className = "" }) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div className={`cf-prose ${invert ? "cf-prose-invert" : ""} ${className}`}>
      {blocks.map((block, idx) => {
        const key = `b${idx}`;
        switch (block.type) {
          case "heading": {
            const Tag = `h${Math.min(block.level + 1, 4)}`;
            return <Tag key={key}>{renderInline(block.text, key)}</Tag>;
          }
          case "code":
            return (
              <pre key={key}>
                <code>{block.text}</code>
              </pre>
            );
          case "hr":
            return <hr key={key} />;
          case "quote":
            return <blockquote key={key}>{renderLines(block.lines, key)}</blockquote>;
          case "table":
            return (
              <div key={key} className="cf-prose-table">
                <table>
                  <thead>
                    <tr>
                      {block.header.map((cell, c) => (
                        <th key={c} scope="col">
                          {renderInline(cell, `${key}-h${c}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r}>
                        {block.header.map((_, c) => (
                          <td key={c}>{renderInline(row[c] || "", `${key}-${r}-${c}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "ul":
          case "ol": {
            const Tag = block.type;
            return (
              <Tag key={key} start={block.start && block.start !== 1 ? block.start : undefined}>
                {block.items.map((item, n) => (
                  <li key={n}>{renderLines(item, `${key}-${n}`)}</li>
                ))}
              </Tag>
            );
          }
          default:
            return <p key={key}>{renderLines(block.lines, key)}</p>;
        }
      })}
    </div>
  );
}

export default memo(Markdown);
