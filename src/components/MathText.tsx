import { useEffect, useMemo, useRef } from 'react';
import katex from 'katex';

interface MathSegment {
  type: 'text' | 'inline' | 'block';
  value: string;
}

/**
 * Splits a string containing plain text and LaTeX math delimiters
 * ($$...$$, \[...\], \(...\), and $...$) into typed segments while
 * avoiding false positives on currency amounts like "$150" or "$150 - $120".
 */
function parseMathSegments(input: string): MathSegment[] {
  if (!input) return [];

  const segments: MathSegment[] = [];
  let textBuffer = '';
  let i = 0;

  const flushText = () => {
    if (textBuffer.length > 0) {
      segments.push({ type: 'text', value: textBuffer });
      textBuffer = '';
    }
  };

  while (i < input.length) {
    // Escaped dollar sign: \$ -> literal $
    if (input[i] === '\\' && input[i + 1] === '$') {
      textBuffer += '$';
      i += 2;
      continue;
    }

    // Block math: $$...$$
    if (input[i] === '$' && input[i + 1] === '$') {
      const endIdx = input.indexOf('$$', i + 2);
      if (endIdx !== -1) {
        const expr = input.slice(i + 2, endIdx).trim();
        if (expr.length > 0) {
          flushText();
          segments.push({ type: 'block', value: expr });
          i = endIdx + 2;
          continue;
        }
      }
      textBuffer += '$$';
      i += 2;
      continue;
    }

    // Block math: \[...\]
    if (input[i] === '\\' && input[i + 1] === '[') {
      const endIdx = input.indexOf('\\]', i + 2);
      if (endIdx !== -1) {
        const expr = input.slice(i + 2, endIdx).trim();
        if (expr.length > 0) {
          flushText();
          segments.push({ type: 'block', value: expr });
          i = endIdx + 2;
          continue;
        }
      }
    }

    // Inline math: \(...\)
    if (input[i] === '\\' && input[i + 1] === '(') {
      const endIdx = input.indexOf('\\)', i + 2);
      if (endIdx !== -1) {
        const expr = input.slice(i + 2, endIdx).trim();
        if (expr.length > 0) {
          flushText();
          segments.push({ type: 'inline', value: expr });
          i = endIdx + 2;
          continue;
        }
      }
    }

    // Inline math: $...$
    if (input[i] === '$') {
      const nextChar = input[i + 1];
      // Standard LaTeX inline rule: opening $ cannot be followed by whitespace
      if (nextChar !== undefined && !/\s/.test(nextChar)) {
        let searchPos = i + 1;
        let matchedEnd = -1;

        while (searchPos < input.length) {
          const ch = input[searchPos];
          if (ch === '\n') break;
          if (ch === '\\' && input[searchPos + 1] === '$') {
            searchPos += 2;
            continue;
          }
          if (ch === '$') {
            const prevChar = input[searchPos - 1];
            const afterChar = input[searchPos + 1];
            // Closing $ cannot be preceded by whitespace or followed by a digit/dollar
            if (!/\s/.test(prevChar) && afterChar !== '$' && !/\d/.test(afterChar ?? '')) {
              matchedEnd = searchPos;
              break;
            }
            break;
          }
          searchPos++;
        }

        if (matchedEnd !== -1) {
          const expr = input.slice(i + 1, matchedEnd).replace(/\\\$/g, '$').trim();
          if (expr.length > 0) {
            flushText();
            segments.push({ type: 'inline', value: expr });
            i = matchedEnd + 1;
            continue;
          }
        }
      }
    }

    textBuffer += input[i];
    i++;
  }

  flushText();
  return segments;
}

interface KatexSpanProps {
  expr: string;
  displayMode: boolean;
}

function KatexSpan({ expr, displayMode }: KatexSpanProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    katex.render(expr, containerRef.current, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
    });
  }, [expr, displayMode]);

  return (
    <span
      ref={containerRef}
      className={
        displayMode
          ? 'block my-2 overflow-x-auto max-w-full'
          : 'inline-block align-baseline max-w-full'
      }
    />
  );
}

interface MathTextProps {
  text: string;
  className?: string;
}

export function hasMathMarkup(text: string): boolean {
  return /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$(?!\s)[^$\n]+?(?<!\s)\$(?!\d))/.test(
    text
  );
}

export function MathText({ text, className }: MathTextProps) {
  const segments = useMemo(() => parseMathSegments(text), [text]);

  if (segments.length === 0) {
    return null;
  }

  return (
    <span className={className}>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          return <span key={idx}>{seg.value}</span>;
        }
        return (
          <KatexSpan
            key={idx}
            expr={seg.value}
            displayMode={seg.type === 'block'}
          />
        );
      })}
    </span>
  );
}
