const ARABIC_FONT_FAMILY = "'Noto Naskh Arabic','Amiri','Tahoma','Arial',sans-serif";
const ENGLISH_FONT_FAMILY = "'Inter','Segoe UI','Arial',sans-serif";
const MATH_FONT_FAMILY = "'Cambria Math','STIX Two Math','Times New Roman',serif";

export const hasArabicText = (value) => /[\u0600-\u06FF]/.test(String(value || ''));

const superscriptMap = {
  0: '⁰',
  1: '¹',
  2: '²',
  3: '³',
  4: '⁴',
  5: '⁵',
  6: '⁶',
  7: '⁷',
  8: '⁸',
  9: '⁹',
  '+': '⁺',
  '-': '⁻',
  n: 'ⁿ',
};

const toSuperscript = (value) =>
  String(value || '')
    .split('')
    .map((char) => superscriptMap[char] || char)
    .join('');

const isMathLikeLine = (line) =>
  /(?:\\frac|\\sqrt|sqrt\s*\(|\^|[=±≤≥<>]|[a-zA-Z]\d|\d\s*[-+*/]\s*\d|[-+*/]\s*[a-zA-Z])/u.test(
    line
  );

const prettifyMathLine = (line) => {
  let next = String(line || '');

  next = next
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1) / ($2)')
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, '√($1)')
    .replace(/\bsqrt\s*\(([^)]+)\)/gi, '√($1)')
    .replace(/\bDelta\b/g, 'Δ')
    .replace(/\bdelta\b/g, 'Δ')
    .replace(/\bdiscriminant\b/gi, 'discriminant Δ')
    .replace(/\+-/g, '±')
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/!=/g, '≠')
    .replace(/\*/g, '×');

  next = next.replace(/\^([+-]?\d+|[n])/gi, (_, power) =>
    toSuperscript(power)
  );

  next = next.replace(/([A-Za-z])([2-9])\b/g, (_, variable, power) =>
    `${variable}${toSuperscript(power)}`
  );

  next = next.replace(/\s*([=±≤≥<>+*/])\s*/g, ' $1 ');
  next = next.replace(/\s*-\s*/g, ' - ');
  next = next.replace(/\s{2,}/g, ' ').trim();

  return next;
};

export const prepareFeedbackForPdf = (feedback, fallback = 'No feedback provided.') => {
  const text = String(feedback || fallback)
    .replace(/\r\n/g, '\n')
    .replace(/\s+(Correct:)/g, '\n$1')
    .replace(/\s+(Explanation:)/g, '\n$1')
    .replace(/\s+(Wrong:)/g, '\n$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text
    .split('\n')
    .map((line) => (isMathLikeLine(line) ? prettifyMathLine(line) : line.trimEnd()))
    .join('\n');
};

const wrapPlainLine = (ctx, line, maxWidthPx, isMathLine) => {
  const source = String(line || '');
  if (!source.trim()) return [''];

  const pieces = isMathLine
    ? source.match(/\s+|[=±≤≥<>+*/(),-]|[^=±≤≥<>+*/(),\s-]+/gu) || []
    : source.split(/(\s+)/).filter(Boolean);

  const lines = [];
  let current = '';

  pieces.forEach((piece) => {
    const test = current ? `${current}${piece}` : piece.trimStart();
    if (!current || ctx.measureText(test).width <= maxWidthPx) {
      current = test;
      return;
    }

    lines.push(current.trimEnd());
    current = piece.trimStart();
  });

  if (current) {
    lines.push(current.trimEnd());
  }

  return lines.length ? lines : [''];
};

const buildWrappedLines = ({
  text,
  maxTextWidthPx,
  baseFontPx,
  fontFamily,
  isArabic,
}) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const rows = [];

  String(text || '')
    .split('\n')
    .forEach((rawLine) => {
      const line = rawLine.trimEnd();
      const isHeading =
        !isArabic &&
        /^(Question Breakdown|Overall Summary|Major Mistakes|How To Improve|Feedback Summary):?$/i.test(
          line.trim()
        );
      const isLabel =
        !isArabic && /^(Wrong|Correct|Explanation|Reason|Max Marks|Your Marks|Marks Lost):/i.test(line.trim());
      const isMathLine = !isArabic && isMathLikeLine(line);

      ctx.font = `${isHeading || isLabel ? '700 ' : ''}${
        isMathLine ? baseFontPx + 2 : baseFontPx
      }px ${isMathLine ? MATH_FONT_FAMILY : fontFamily}`;

      wrapPlainLine(ctx, line, maxTextWidthPx, isMathLine).forEach((wrapped, index) => {
        rows.push({
          text: wrapped,
          isHeading,
          isLabel,
          isMathLine,
          indent: index > 0 && isMathLine ? 34 : 0,
        });
      });
    });

  return rows;
};

export const drawFeedbackTextToPdf = ({
  doc,
  text,
  x,
  y,
  width,
  pageHeight,
  margin,
  addPageFrame,
}) => {
  const preparedText = prepareFeedbackForPdf(text);
  const isArabic = hasArabicText(preparedText);
  const contentWidthMm = width;
  const canvasWidthPx = 1800;
  const horizontalPaddingPx = 42;
  const maxTextWidthPx = canvasWidthPx - horizontalPaddingPx * 2;
  const baseFontPx = isArabic ? 34 : 32;
  const lineHeightPx = isArabic ? 48 : 46;
  const fontFamily = isArabic ? ARABIC_FONT_FAMILY : ENGLISH_FONT_FAMILY;
  const rows = buildWrappedLines({
    text: preparedText,
    maxTextWidthPx,
    baseFontPx,
    fontFamily,
    isArabic,
  });
  const estimatedLineHeightMm = (lineHeightPx * contentWidthMm) / canvasWidthPx;
  let rowIndex = 0;
  let nextY = y;

  while (rowIndex < rows.length) {
    const availableHeightMm = pageHeight - margin - nextY;
    const rowsPerPage = Math.max(1, Math.floor(availableHeightMm / estimatedLineHeightMm));
    const pageRows = rows.slice(rowIndex, rowIndex + rowsPerPage);
    rowIndex += pageRows.length;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidthPx;
    canvas.height = Math.max(130, pageRows.length * lineHeightPx + 28);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.direction = isArabic ? 'rtl' : 'ltr';
    ctx.textAlign = isArabic ? 'right' : 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#111827';

    let py = 14;
    pageRows.forEach((row) => {
      const fontWeight = row.isHeading || row.isLabel ? '700 ' : '';
      const fontSize = row.isMathLine ? baseFontPx + 4 : baseFontPx;
      ctx.font = `${fontWeight}${fontSize}px ${row.isMathLine ? MATH_FONT_FAMILY : fontFamily}`;
      ctx.fillStyle = row.isMathLine ? '#0f172a' : '#111827';

      const drawX = isArabic
        ? canvas.width - horizontalPaddingPx
        : horizontalPaddingPx + row.indent;
      ctx.fillText(row.text, drawX, py);
      py += row.text ? lineHeightPx : Math.round(lineHeightPx * 0.55);
    });

    const img = canvas.toDataURL('image/png');
    const imgHeightMm = (canvas.height * contentWidthMm) / canvas.width;
    doc.addImage(img, 'PNG', x, nextY, contentWidthMm, imgHeightMm);
    nextY += imgHeightMm;

    if (rowIndex < rows.length) {
      doc.addPage();
      if (addPageFrame) addPageFrame();
      nextY = margin + 8;
    }
  }

  return nextY;
};
