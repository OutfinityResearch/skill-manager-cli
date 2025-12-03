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
 * Render markdown text with ANSI terminal styling.
 * @param {string} text - Markdown text to render
 * @returns {string} - Text with ANSI styling for terminal display
 */
export function renderMarkdown(text) {
    if (typeof text !== 'string') {
        return String(text);
    }

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

export default renderMarkdown;
