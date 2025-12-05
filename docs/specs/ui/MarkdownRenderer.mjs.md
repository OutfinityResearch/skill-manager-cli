# Design Spec: src/ui/MarkdownRenderer.mjs

ID: DS(/ui/MarkdownRenderer.mjs)

## Overview

**Role**: Custom terminal markdown renderer that transforms markdown text to ANSI-styled terminal output without external dependencies.

**Pattern**: Pure function with line-by-line processing and inline element transformation.

**Key Collaborators**:
- `NaturalLanguageProcessor` - renders LLM output when markdown enabled
- `REPLSession` - controls markdown toggle

## What It Does

MarkdownRenderer transforms:

1. **Headers**: `#`, `##`, `###`, `####` with colored styling
2. **Code Blocks**: Fenced code with box borders
3. **Inline Code**: Backtick-wrapped text with cyan color
4. **Bold/Italic**: `**bold**`, `*italic*`, `_italic_`
5. **Lists**: Unordered (`-`, `*`) and ordered (`1.`)
6. **Blockquotes**: `>` with vertical bar prefix
7. **Links**: `[text](url)` with underlined text
8. **Horizontal Rules**: `---`, `***`, `___`

## How It Does It

### Main Render Function
```javascript
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
            if (!inCodeBlock) {
                // Starting code block
                inCodeBlock = true;
                codeBlockLang = line.trimStart().slice(3).trim();
                const langLabel = codeBlockLang ? ` ${codeBlockLang} ` : '';
                output.push(`${DIM}┌─${langLabel}${'─'.repeat(40 - langLabel.length)}${RESET}`);
            } else {
                // Ending code block
                inCodeBlock = false;
                output.push(`${DIM}└${'─'.repeat(42)}${RESET}`);
            }
            continue;
        }

        if (inCodeBlock) {
            // Inside code block - preserve formatting
            output.push(`${DIM}│${RESET} ${line}`);
            continue;
        }

        // Process regular markdown line
        output.push(processLine(line));
    }

    // Handle unclosed code block
    if (inCodeBlock) {
        output.push(`${DIM}└${'─'.repeat(42)}${RESET}`);
    }

    return output.join('\n');
}
```

### Line Processing
```javascript
function processLine(line) {
    // Headers (check longer prefixes first)
    if (line.startsWith('#### ')) {
        return `${BOLD}${BLUE}${line.slice(5)}${RESET}`;
    }
    if (line.startsWith('### ')) {
        return `${BOLD}${CYAN}${line.slice(4)}${RESET}`;
    }
    if (line.startsWith('## ')) {
        return `${BOLD}${YELLOW}${line.slice(3)}${RESET}`;
    }
    if (line.startsWith('# ')) {
        return `${BOLD}${GREEN}${line.slice(2)}${RESET}\n${'─'.repeat(40)}`;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
        return `${DIM}${'─'.repeat(40)}${RESET}`;
    }

    // Blockquote
    if (line.startsWith('> ')) {
        return `${DIM}│ ${processInline(line.slice(2))}${RESET}`;
    }

    // Unordered list
    const unorderedMatch = line.match(/^(\s*)([-*])\s+(.*)$/);
    if (unorderedMatch) {
        const [, indent, , content] = unorderedMatch;
        return `${indent}  • ${processInline(content)}`;
    }

    // Ordered list
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
        const [, indent, num, content] = orderedMatch;
        return `${indent}  ${num}. ${processInline(content)}`;
    }

    // Regular text
    return processInline(line);
}
```

### Inline Element Processing
```javascript
function processInline(text) {
    // Inline code (must be first to avoid conflicts)
    text = text.replace(/`([^`]+)`/g, `${CYAN}$1${RESET}`);

    // Bold **text**
    text = text.replace(/\*\*([^*]+)\*\*/g, `${BOLD}$1${RESET}`);

    // Italic *text* (careful not to match bold or list bullets)
    text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, `${ITALIC}$1${RESET}`);

    // Italic _text_
    text = text.replace(/(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g, `${ITALIC}$1${RESET}`);

    // Links [text](url)
    text = text.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        `${UNDERLINE}$1${RESET} ${DIM}($2)${RESET}`
    );

    return text;
}
```

## Why This Design

### 1. Zero Dependencies
**Decision**: Implement markdown rendering without external libraries.

**Rationale**:
- No dependency bloat
- Full control over output
- Simple enough to implement
- Avoids compatibility issues

### 2. Line-by-Line Processing
**Decision**: Process each line independently (except code blocks).

**Rationale**:
- Simple state machine (only code block state)
- Memory efficient (no AST)
- Easy to understand and debug
- Handles streaming output well

### 3. Code Block Boxing
**Decision**: Draw box borders around code blocks with language label.

**Rationale**:
- Visual separation from surrounding text
- Language label for context
- Consistent width (40 chars)
- Looks better than indentation alone

### 4. Inline Before Bold
**Decision**: Process inline code before bold/italic.

**Rationale**:
- `**inside backticks**` should stay as-is
- Prevents false matches inside code
- Order matters for regex replacement
- Most restrictive patterns first

### 5. Color Scheme for Headers
**Decision**: Different colors for different header levels.

**Rationale**:
- Visual hierarchy (like syntax highlighting)
- Easy to scan document structure
- H1: Green (most prominent)
- H2: Yellow, H3: Cyan, H4: Blue

## Public API

### Functions
```javascript
renderMarkdown(text)  // Transform markdown to ANSI-styled text
```

### Default Export
```javascript
export default renderMarkdown;
```

## ANSI Codes Used

```javascript
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
```

## Supported Markdown Elements

| Element | Syntax | Rendering |
|---------|--------|-----------|
| H1 | `# Title` | Bold green + underline |
| H2 | `## Section` | Bold yellow |
| H3 | `### Subsection` | Bold cyan |
| H4 | `#### Minor` | Bold blue |
| Code block | ` ``` ` | Box with borders |
| Inline code | `` `code` `` | Cyan |
| Bold | `**text**` | Bold |
| Italic | `*text*` or `_text_` | Italic |
| Link | `[text](url)` | Underlined text + dim URL |
| Unordered list | `- item` or `* item` | Bullet (•) |
| Ordered list | `1. item` | Number preserved |
| Blockquote | `> text` | Dim vertical bar |
| HR | `---` | Dim horizontal line |

## Pseudocode

```javascript
function renderMarkdown(text) {
    lines = text.split('\n');
    output = [];
    inCodeBlock = false;

    for line in lines:
        if (line starts with '```'):
            if (!inCodeBlock):
                inCodeBlock = true;
                lang = extractLanguage(line);
                output.push(drawCodeBlockTop(lang));
            else:
                inCodeBlock = false;
                output.push(drawCodeBlockBottom());
            continue;

        if (inCodeBlock):
            output.push(`│ ${line}`);
            continue;

        output.push(processLine(line));

    return output.join('\n');
}

function processLine(line) {
    if (isHeader(line)) return formatHeader(line);
    if (isHorizontalRule(line)) return formatHR();
    if (isBlockquote(line)) return formatBlockquote(line);
    if (isList(line)) return formatListItem(line);
    return processInline(line);
}

function processInline(text) {
    // Order matters!
    text = replaceInlineCode(text);
    text = replaceBold(text);
    text = replaceItalic(text);
    text = replaceLinks(text);
    return text;
}
```

## Notes/Constraints

- No support for tables (would require significant complexity)
- No support for images (terminal limitation)
- No nested formatting (`**_bold italic_**`)
- Code blocks assume fixed width (40 chars)
- Unclosed code blocks are auto-closed at end
- Non-string input is converted via String()
- Italic regex uses lookbehind (ES2018+)
