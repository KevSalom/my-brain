/**
 * Utility to convert rich HTML text copied from a browser into standard Markdown.
 * Useful for keeping headings, lists, bold/italic, and code blocks from Medium, Substack, etc.
 */
export function convertHtmlToMarkdown(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue || "";
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      let childrenText = "";
      el.childNodes.forEach(child => {
        childrenText += walk(child);
      });

      switch (tagName) {
        case 'h1':
          return `\n\n# ${childrenText.trim()}\n\n`;
        case 'h2':
          return `\n\n## ${childrenText.trim()}\n\n`;
        case 'h3':
          return `\n\n### ${childrenText.trim()}\n\n`;
        case 'h4':
          return `\n\n#### ${childrenText.trim()}\n\n`;
        case 'p': {
          const trimmedP = childrenText.trim();
          return trimmedP ? `\n\n${trimmedP}\n\n` : '';
        }
        case 'strong':
        case 'b': {
          const trimmedBold = childrenText.trim();
          return trimmedBold ? ` **${trimmedBold}** ` : '';
        }
        case 'em':
        case 'i': {
          const trimmedItalic = childrenText.trim();
          return trimmedItalic ? ` *${trimmedItalic}* ` : '';
        }
        case 'code':
          return ` \`${childrenText}\` `;
        case 'pre':
          return `\n\n\`\`\`\n${childrenText.trim()}\n\`\`\`\n\n`;
        case 'li':
          return `\n* ${childrenText.trim()}`;
        case 'ul':
        case 'ol':
          return `\n${childrenText}\n`;
        case 'br':
          return `\n`;
        default:
          return childrenText;
      }
    }
    return "";
  };

  let markdown = walk(doc.body);

  // Clean up excessive whitespace and newlines
  markdown = markdown
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+\n/g, '\n\n');

  return markdown.trim();
}
