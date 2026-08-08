export interface MmlSourcePart {
  readonly label: string;
  readonly source: string;
}

export function mmlParts(source: string): readonly MmlSourcePart[] {
  const cleaned = cleanup(source);
  const labelled = labelledParts(cleaned);
  if (labelled.length) return labelled;

  return splitScore(rawScore(cleaned)).map((part, i) => ({
    label: `파트 ${i + 1}`,
    source: part,
  }));
}

function cleanup(source: string): string {
  return source
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/```[a-z]*|```/gi, '')
    .replace(/\r/g, '')
    .trim();
}

function labelledParts(source: string): MmlSourcePart[] {
  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines[0] && /^MML@/i.test(lines[0])) return [];

  const parts: MmlSourcePart[] = [];
  let label = '';
  let score = '';

  for (const line of lines) {
    if (/^mml$/i.test(line)) continue;
    if (startsScore(line)) {
      score += line;
      if (line.includes(';')) {
        pushPart(parts, label, score);
        score = '';
      }
      continue;
    }

    if (score) {
      pushPart(parts, label, score);
      score = '';
    }
    label = line;
  }

  if (score) pushPart(parts, label, score);
  return parts;
}

function pushPart(parts: MmlSourcePart[], label: string, score: string): void {
  const source = splitScore(rawScore(score))[0] ?? '';
  if (!source) return;
  parts.push({ label: label || `파트 ${parts.length + 1}`, source });
}

function rawScore(source: string): string {
  const marker = /\bMML@/i.exec(source);
  const body = marker ? source.slice(marker.index + marker[0].length) : source;
  const end = body.indexOf(';');
  return end >= 0 ? body.slice(0, end) : body;
}

function splitScore(score: string): string[] {
  return score.split(',').map((part) => part.trim()).filter(Boolean);
}

function startsScore(line: string): boolean {
  return /^MML@/i.test(line)
    || /^[tlo]\d/i.test(line)
    || /^v\d/i.test(line)
    || /^n\d/i.test(line)
    || /^[r<>a-g]/i.test(line);
}
