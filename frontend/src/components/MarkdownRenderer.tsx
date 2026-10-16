import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

/**
 * Safe, pure React Markdown Renderer
 * Parses common Markdown structures directly into typed React virtual DOM elements.
 * Strictly avoids `dangerouslySetInnerHTML` to prevent XSS, script injection, and event execution.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  // Split content into major block tokens
  const lines = content.split(/\r?\n/);
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' = 'ul';
  let listItems: React.ReactNode[] = [];
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];

  const flushList = (key: string) => {
    if (inList && listItems.length > 0) {
      if (listType === 'ul') {
        elements.push(
          <ul
            key={key}
            style={{
              paddingLeft: '22px',
              marginBottom: '12px',
              lineHeight: '1.65',
              listStyleType: 'disc'
            }}
          >
            {listItems}
          </ul>
        );
      } else {
        elements.push(
          <ol
            key={key}
            style={{
              paddingLeft: '22px',
              marginBottom: '12px',
              lineHeight: '1.65',
              listStyleType: 'decimal'
            }}
          >
            {listItems}
          </ol>
        );
      }
      listItems = [];
      inList = false;
    }
  };

  const flushTable = (key: string) => {
    if (inTable) {
      elements.push(
        <div
          key={key}
          style={{
            overflowX: 'auto',
            margin: '14px 0',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-surface)'
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
            {tableHeaders.length > 0 && (
              <thead style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                <tr>
                  {tableHeaders.map((th, idx) => (
                    <th key={idx} style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-white)' }}>
                      {renderInlineFormatting(th.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tableRows.map((tr, rIdx) => (
                <tr
                  key={rIdx}
                  style={{
                    borderBottom: rIdx === tableRows.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                    backgroundColor: rIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)'
                  }}
                >
                  {tr.map((td, cIdx) => (
                    <td key={cIdx} style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                      {renderInlineFormatting(td.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 1. Fenced Code Block handling (``` or ~~~)
    if (line.startsWith('```') || line.startsWith('~~~')) {
      flushList(`list_pre_${i}`);
      flushTable(`table_pre_${i}`);
      if (inCodeBlock) {
        // End code block
        elements.push(
          <div
            key={`code_${i}`}
            style={{
              margin: '12px 0',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)',
              overflow: 'hidden'
            }}
          >
            {codeBlockLang && (
              <div
                style={{
                  padding: '4px 12px',
                  backgroundColor: 'var(--bg-elevated)',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: '10px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-orange)',
                  textTransform: 'uppercase'
                }}
              >
                {codeBlockLang}
              </div>
            )}
            <pre
              style={{
                padding: '12px 14px',
                margin: 0,
                overflowX: 'auto',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-white)',
                lineHeight: '1.5'
              }}
            >
              <code>{codeBlockLines.join('\n')}</code>
            </pre>
          </div>
        );
        codeBlockLines = [];
        codeBlockLang = '';
        inCodeBlock = false;
      } else {
        // Start code block
        inCodeBlock = true;
        codeBlockLang = line.replace(/^[~`]+/, '').trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // 2. Table row handling
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList(`list_table_${i}`);
      const columns = line
        .slice(1, -1)
        .split('|')
        .map(c => c.trim());

      // Check if separator row (e.g. |---|:---|)
      const isSeparator = columns.every(c => /^:?-+:?$/.test(c));
      if (isSeparator) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeaders = columns;
      } else {
        tableRows.push(columns);
      }
      continue;
    } else if (inTable) {
      flushTable(`table_end_${i}`);
    }

    // 3. Headings (#, ##, ###, ####)
    if (line.startsWith('#')) {
      flushList(`list_hd_${i}`);
      flushTable(`table_hd_${i}`);

      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];

        if (level === 1) {
          elements.push(
            <h1
              key={`h1_${i}`}
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: 'var(--text-white)',
                letterSpacing: '-0.02em',
                margin: '18px 0 8px',
                lineHeight: '1.3'
              }}
            >
              {renderInlineFormatting(text)}
            </h1>
          );
        } else if (level === 2) {
          elements.push(
            <h2
              key={`h2_${i}`}
              style={{
                fontSize: '17px',
                fontWeight: 800,
                color: 'var(--text-white)',
                letterSpacing: '-0.015em',
                margin: '16px 0 8px',
                lineHeight: '1.3'
              }}
            >
              {renderInlineFormatting(text)}
            </h2>
          );
        } else if (level === 3) {
          elements.push(
            <h3
              key={`h3_${i}`}
              style={{
                fontSize: '14.5px',
                fontWeight: 700,
                color: 'var(--accent-orange)',
                letterSpacing: '-0.01em',
                margin: '14px 0 6px',
                lineHeight: '1.35'
              }}
            >
              {renderInlineFormatting(text)}
            </h3>
          );
        } else {
          elements.push(
            <h4
              key={`h4_${i}`}
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-white)',
                margin: '12px 0 6px',
                lineHeight: '1.35'
              }}
            >
              {renderInlineFormatting(text)}
            </h4>
          );
        }
        continue;
      }
    }

    // 4. Horizontal Rule (---, ***, ___)
    if (/^([-*_]){3,}$/.test(line)) {
      flushList(`list_hr_${i}`);
      flushTable(`table_hr_${i}`);
      elements.push(
        <hr
          key={`hr_${i}`}
          style={{
            border: 'none',
            borderTop: '1px solid var(--border-subtle)',
            margin: '16px 0'
          }}
        />
      );
      continue;
    }

    // 5. Blockquotes (> text)
    if (line.startsWith('>')) {
      flushList(`list_bq_${i}`);
      flushTable(`table_bq_${i}`);
      const bqText = line.replace(/^>\s*/, '');
      elements.push(
        <blockquote
          key={`bq_${i}`}
          style={{
            borderLeft: '3px solid var(--accent-orange)',
            backgroundColor: 'rgba(255, 94, 30, 0.04)',
            padding: '8px 14px',
            margin: '10px 0',
            borderRadius: '0 var(--radius-xs) var(--radius-xs) 0',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            fontSize: '13px'
          }}
        >
          {renderInlineFormatting(bqText)}
        </blockquote>
      );
      continue;
    }

    // 6. Unordered List Items (- item, * item, • item)
    const ulMatch = line.match(/^[-*•]\s+(.*)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        flushList(`list_switch_${i}`);
        inList = true;
        listType = 'ul';
      }
      const rawIndent = Math.max(0, rawLine.search(/\S/));
      const indentLevel = Math.min(4, Math.floor(rawIndent / 2));
      listItems.push(
        <li
          key={`li_${i}`}
          style={{
            marginBottom: '4px',
            color: 'var(--text-white)',
            marginLeft: indentLevel > 0 ? `${indentLevel * 16}px` : undefined,
            listStyleType: indentLevel > 0 ? 'circle' : 'disc'
          }}
        >
          {renderInlineFormatting(ulMatch[1])}
        </li>
      );
      continue;
    }

    // 7. Ordered List Items (1. item, 2. item)
    const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        flushList(`list_switch_ol_${i}`);
        inList = true;
        listType = 'ol';
      }
      const rawIndent = Math.max(0, rawLine.search(/\S/));
      const indentLevel = Math.min(4, Math.floor(rawIndent / 2));
      listItems.push(
        <li
          key={`oli_${i}`}
          style={{
            marginBottom: '4px',
            color: 'var(--text-white)',
            marginLeft: indentLevel > 0 ? `${indentLevel * 16}px` : undefined
          }}
        >
          {renderInlineFormatting(olMatch[2])}
        </li>
      );
      continue;
    }

    // 8. Empty lines
    if (!line) {
      flushList(`list_blank_${i}`);
      flushTable(`table_blank_${i}`);
      continue;
    }

    // 9. Standard Paragraph
    flushList(`list_p_${i}`);
    flushTable(`table_p_${i}`);
    elements.push(
      <p
        key={`p_${i}`}
        style={{
          margin: '0 0 10px',
          lineHeight: '1.65',
          color: 'var(--text-white)',
          fontSize: '13px'
        }}
      >
        {renderInlineFormatting(line)}
      </p>
    );
  }

  // Flush any remaining active containers
  flushList('list_final');
  flushTable('table_final');

  return <div className="markdown-body" style={{ color: 'var(--text-white)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{elements}</div>;
};

/**
 * Safely parses and renders inline formatting:
 * - Bold: **text** or __text__
 * - Italic: *text* or _text_
 * - Inline code: `code`
 * - Links: [label](url)
 */
function renderInlineFormatting(text: string): React.ReactNode {
  if (!text) return null;

  // Regex tokenizer covering inline code, links, bold, and italic
  const tokenRegex = /(`[^`]+`|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|(?:\*([^*]+)\*|_([^_]+)_))/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    const fullToken = match[0];

    // Case 1: Inline Code `code`
    if (fullToken.startsWith('`') && fullToken.endsWith('`')) {
      const codeText = fullToken.slice(1, -1);
      parts.push(
        <code
          key={`code_${matchIndex}`}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11.5px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '3px',
            padding: '1.5px 5px',
            color: 'var(--accent-orange)'
          }}
        >
          {codeText}
        </code>
      );
    }
    // Case 2: Link [label](url)
    else if (match[2] && match[3]) {
      const label = match[2];
      const url = match[3].trim();
      const isSafe = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/') || url.startsWith('#') || url.startsWith('mailto:');
      parts.push(
        <a
          key={`link_${matchIndex}`}
          href={isSafe ? url : '#'}
          target={url.startsWith('http://') || url.startsWith('https://') ? '_blank' : undefined}
          rel={url.startsWith('http://') || url.startsWith('https://') ? 'noopener noreferrer' : undefined}
          style={{
            color: 'var(--accent-orange)',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
            fontWeight: 600
          }}
        >
          {label}
        </a>
      );
    }
    // Case 3: Bold **text** or __text__
    else if (match[4] || match[5]) {
      const boldText = match[4] || match[5];
      parts.push(
        <strong key={`b_${matchIndex}`} style={{ fontWeight: 700, color: '#FFFFFF' }}>
          {boldText}
        </strong>
      );
    }
    // Case 4: Italic *text* or _text_
    else if (match[6] || match[7]) {
      const italicText = match[6] || match[7];
      parts.push(
        <em key={`i_${matchIndex}`} style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
          {italicText}
        </em>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <React.Fragment>{parts}</React.Fragment>;
}
