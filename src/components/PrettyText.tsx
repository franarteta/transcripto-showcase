import React from 'react';

export function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return <code key={idx} className="inline-code">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export interface PrettyTextProps {
  text: string;
}

export function PrettyText({ text }: PrettyTextProps) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      elements.push(<hr key={`hr-${i}`} className="summary-hr" />);
      i++;
      continue;
    }

    if (/^#{1,3}\s+/.test(trimmed)) {
      const level = (trimmed.match(/^#+/) || [''])[0].length;
      const title = trimmed.replace(/^#+\s*/, '');
      if (level === 1) {
        elements.push(<h2 key={`h-${i}`} className="summary-h1">{renderInline(title)}</h2>);
      } else if (level === 2) {
        elements.push(<h2 key={`h-${i}`} className="summary-h2">{renderInline(title)}</h2>);
      } else {
        elements.push(<h3 key={`h-${i}`} className="summary-h3">{renderInline(title)}</h3>);
      }
      i++;
      continue;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|') && i + 1 < lines.length && /\|[\s\-:]+\|/.test(lines[i + 1])) {
      const headerCells = trimmed.split('|').slice(1, -1).map(c => c.trim());
      i += 2;
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const rowCells = lines[i].trim().split('|').slice(1, -1).map(c => c.trim());
        tableRows.push(rowCells);
        i++;
      }
      elements.push(
        <div key={`table-${i}`} className="table-responsive">
          <table className="summary-table">
            <thead>
              <tr>
                {headerCells.map((h, hIdx) => (
                  <th key={hIdx}>{renderInline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''));
        i++;
      }
      elements.push(
        <blockquote key={`quote-${i}`} className="summary-quote">
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx}>{renderInline(ql)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const listItems: { indent: number; text: string }[] = [];
      while (i < lines.length) {
        const rawLine = lines[i];
        const rawTrim = rawLine.trim();
        if (/^[-*•]\s+/.test(rawTrim)) {
          const indent = rawLine.search(/\S/);
          listItems.push({ indent, text: rawTrim.replace(/^[-*•]\s+/, '') });
          i++;
        } else if (listItems.length > 0 && (rawLine.startsWith('  ') || rawLine.startsWith('\t')) && rawTrim) {
          listItems.push({ indent: 4, text: rawTrim.replace(/^[-*•]\s*/, '') });
          i++;
        } else {
          break;
        }
      }
      elements.push(
        <ul key={`ul-${i}`} className="summary-list">
          {listItems.map((item, idx) => (
            <li key={idx} style={{ marginLeft: item.indent >= 2 ? 18 : 0 }}>
              {renderInline(item.text)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length) {
      const curTrim = lines[i].trim();
      if (!curTrim || /^#{1,3}\s+/.test(curTrim) || /^(\-{3,}|\*{3,}|_{3,})$/.test(curTrim) || (curTrim.startsWith('|') && curTrim.endsWith('|')) || curTrim.startsWith('>') || /^[-*•]\s+/.test(curTrim)) {
        break;
      }
      paraLines.push(curTrim);
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(
        <p key={`p-${i}`} className="summary-paragraph">
          {renderInline(paraLines.join(' '))}
        </p>
      );
    }
  }

  return <div className="pretty-markdown">{elements}</div>;
}

export default PrettyText;
