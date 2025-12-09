/**
 * MarkdownRenderer - Custom terminal markdown renderer with ANSI styling.
 *
 * Transforms markdown text to ANSI-styled terminal output without external dependencies.
 */

const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    italic: '\x1b[3m',
    underline: '\x1b[4m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    gray: '\x1b[90m',
};

/**
 * Process inline markdown elements (bold, italic, code, links).
 * @param {string} text - Text to process
 * @returns {string} - Text with ANSI styling
 */
function processInline(text) {
    // Inline code (must be before bold/italic to avoid conflicts)
    text = text.replace(/`([^`]+)`/g, `${ANSI.cyan}$1${ANSI.reset}`);

    // Bold **text**
    text = text.replace(/\*\*([^*]+)\*\*/g, `${ANSI.bold}$1${ANSI.reset}`);

    // Italic *text* (be careful not to match list bullets or bold markers)
    text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, `${ANSI.italic}$1${ANSI.reset}`);

    // Italic _text_
    text = text.replace(/(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g, `${ANSI.italic}$1${ANSI.reset}`);

    // Links [text](url)
    text = text.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        `${ANSI.underline}$1${ANSI.reset} ${ANSI.dim}($2)${ANSI.reset}`
    );

    return text;
}

/**
 * Process a single line of markdown (headers, lists, blockquotes, etc.).
 * @param {string} line - Line to process
 * @returns {string} - Line with ANSI styling
 */
function processLine(line) {
    // Headers (check longer prefixes first)
    if (line.startsWith('#### ')) {
        return `${ANSI.bold}${ANSI.blue}${line.slice(5)}${ANSI.reset}`;
    }
    if (line.startsWith('### ')) {
        return `${ANSI.bold}${ANSI.cyan}${line.slice(4)}${ANSI.reset}`;
    }
    if (line.startsWith('## ')) {
        return `${ANSI.bold}${ANSI.yellow}${line.slice(3)}${ANSI.reset}`;
    }
    if (line.startsWith('# ')) {
        return `${ANSI.bold}${ANSI.green}${line.slice(2)}${ANSI.reset}\n${'─'.repeat(40)}`;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim()) || /^_{3,}$/.test(line.trim())) {
        return `${ANSI.dim}${'─'.repeat(40)}${ANSI.reset}`;
    }

    // Blockquote
    if (line.startsWith('> ')) {
        return `${ANSI.dim}│ ${processInline(line.slice(2))}${ANSI.reset}`;
    }
    if (line === '>') {
        return `${ANSI.dim}│${ANSI.reset}`;
    }

    // Unordered lists (- or *)
    const unorderedMatch = line.match(/^(\s*)([-*])\s+(.*)$/);
    if (unorderedMatch) {
        const [, indent, , content] = unorderedMatch;
        return `${indent}  • ${processInline(content)}`;
    }

    // Ordered lists (1., 2., etc.)
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
        const [, indent, num, content] = orderedMatch;
        return `${indent}  ${num}. ${processInline(content)}`;
    }

    // Regular text - process inline elements
    return processInline(line);
}

/**
 * Parse a markdown table row into cells.
 * @param {string} row - Table row string
 * @returns {string[]} - Array of cell values (trimmed)
 */
function parseTableRow(row) {
    // Remove leading/trailing pipes and split by |
    const trimmed = row.trim().replace(/^\||\|$/g, '');
    return trimmed.split('|').map(cell => cell.trim());
}

/**
 * Check if a line is a table separator row (e.g., |---|---|)
 * @param {string} line - Line to check
 * @returns {boolean}
 */
function isTableSeparator(line) {
    const trimmed = line.trim();
    // Must have pipes and only contain |, -, :, and spaces
    return trimmed.includes('|') && /^[\s|:\-]+$/.test(trimmed);
}

/**
 * Check if a line looks like a table row.
 * @param {string} line - Line to check
 * @returns {boolean}
 */
function isTableRow(line) {
    const trimmed = line.trim();
    // Must start and end with | or have | somewhere in between
    return trimmed.includes('|') && !trimmed.startsWith('```');
}

/**
 * Format markdown tables with aligned columns.
 * @param {string} text - Full markdown text
 * @returns {string} - Text with aligned tables
 */
function formatTables(text) {
    const lines = text.split('\n');
    const result = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Check if this could be the start of a table (header row)
        if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
            // Found a table - collect all rows
            const tableLines = [line];
            let j = i + 1;

            // Collect separator and all following table rows
            while (j < lines.length && (isTableSeparator(lines[j]) || isTableRow(lines[j]))) {
                tableLines.push(lines[j]);
                j++;
            }

            // Parse all rows into cells
            const parsedRows = tableLines.map(parseTableRow);

            // Calculate max width for each column
            const colCount = Math.max(...parsedRows.map(row => row.length));
            const colWidths = new Array(colCount).fill(0);

            for (const row of parsedRows) {
                for (let c = 0; c < row.length; c++) {
                    // For separator rows, minimum width is 3 (---)
                    const cellLen = isTableSeparator(tableLines[parsedRows.indexOf(row)])
                        ? 3
                        : row[c].length;
                    colWidths[c] = Math.max(colWidths[c], cellLen);
                }
            }

            // Rebuild aligned table
            for (let r = 0; r < tableLines.length; r++) {
                const originalLine = tableLines[r];
                const cells = parsedRows[r];
                const isSeparator = isTableSeparator(originalLine);

                const alignedCells = [];
                for (let c = 0; c < colCount; c++) {
                    const cell = cells[c] || '';
                    const width = colWidths[c];

                    if (isSeparator) {
                        // Rebuild separator with proper width (no spaces)
                        alignedCells.push('-'.repeat(width + 2)); // +2 to account for spaces in content rows
                    } else {
                        // Pad cell content to column width
                        alignedCells.push(' ' + cell.padEnd(width) + ' ');
                    }
                }

                if (isSeparator) {
                    result.push('|' + alignedCells.join('|') + '|');
                } else {
                    result.push('|' + alignedCells.join('|') + '|');
                }
            }

            i = j;
        } else {
            result.push(line);
            i++;
        }
    }

    return result.join('\n');
}

/**
 * Render markdown text with ANSI terminal styling.
 * @param {string} text - Markdown text to render
 * @returns {string} - Text with ANSI styling for terminal display
 */
export function renderMarkdown(text) {
    if (typeof text !== 'string') {
        return String(text);
    }

    // Pre-process: align tables before other formatting
    text = formatTables(text);

    const lines = text.split('\n');
    const output = [];
    let inCodeBlock = false;
    let codeBlockLang = '';

    for (const line of lines) {
        // Check for code block delimiter
        if (line.trimStart().startsWith('```')) {
            const trimmedLine = line.trimStart();
            if (!inCodeBlock) {
                // Starting a code block
                inCodeBlock = true;
                codeBlockLang = trimmedLine.slice(3).trim();
                const langLabel = codeBlockLang ? ` ${codeBlockLang} ` : '';
                const padding = 40 - langLabel.length;
                output.push(`${ANSI.dim}┌─${langLabel}${'─'.repeat(Math.max(0, padding))}${ANSI.reset}`);
            } else {
                // Ending a code block
                inCodeBlock = false;
                codeBlockLang = '';
                output.push(`${ANSI.dim}└${'─'.repeat(42)}${ANSI.reset}`);
            }
            continue;
        }

        if (inCodeBlock) {
            // Inside code block - preserve formatting, add border
            output.push(`${ANSI.dim}│${ANSI.reset} ${line}`);
            continue;
        }

        // Process regular markdown line
        output.push(processLine(line));
    }

    // Handle unclosed code block
    if (inCodeBlock) {
        output.push(`${ANSI.dim}└${'─'.repeat(42)}${ANSI.reset}`);
    }

    return output.join('\n');
}

export { formatTables };
export default renderMarkdown;
