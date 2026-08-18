/**
 * Core serialization primitives for Bruno DSL.
 * Converts values and structures into Bruno .bru file format.
 */

/**
 * Serialize a value to Bruno DSL format.
 * - Strings: raw Bruno values (the Bruno DSL does not use quoted scalar strings)
 * - Numbers: unquoted
 * - Booleans: unquoted true/false
 * - Null: unquoted null
 * - Arrays: [item, item] syntax
 * - Objects: JSON stringified for body blocks
 */
function serializeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value.toString();
  }
  if (typeof value === "number") {
    return value.toString();
  }
  if (typeof value === "string") {
    // Bruno variable references (pure or mixed with paths) should not be quoted
    // e.g. {{token}} or {{baseUrl}}/data/2.5/weather
    if (/\{\{[^}]+\}\}/.test(value)) {
      return value;
    }
    // Multi-line strings use ''' syntax
    if (value.includes("\n")) {
      return `'''${value}'''`;
    }
    // Bruno values are unquoted. Quoting a scalar makes the quote characters
    // part of the value when Bruno reads the file.
    return value;
  }
  if (Array.isArray(value)) {
    // The Bruno grammar requires list items on their own lines.
    return `[\n${value.map((item) => `    ${serializeValue(item)}`).join("\n")}\n  ]`;
  }
  if (typeof value === "object") {
    return `'''${JSON.stringify(value, null, 2)}'''`;
  }
  return String(value);
}

/**
 * Escape a key for use in Bruno DSL (handle spaces, special chars).
 * Keys with spaces or special characters must be quoted.
 */
function escapeKey(key: string): string {
  if (/^[a-zA-Z0-9_\-:.]+$/.test(key)) {
    return key;
  }
  return `"${key.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Generate a Bruno block: blockName { key: value; ... }
 * @param name - The block name (e.g., "meta", "headers", "params:query")
 * @param entries - Key-value pairs to include in the block
 * @returns Formatted Bruno block string
 */
function formatBlock(name: string, entries: Record<string, unknown>): string {
  const keys = Object.keys(entries);
  if (keys.length === 0) {
    return `${name} { }`;
  }

  const lines = keys
    .map((key) => {
      const escapedKey = escapeKey(key);
      const serializedValue = serializeValue(entries[key]);
      return `  ${escapedKey}: ${serializedValue}`;
    })
    .join("\n");

  return `${name} {\n${lines}\n}`;
}

/**
 * Generate a Bruno block with raw content (for JSON bodies, GraphQL queries, etc.).
 * @param name - The block name (e.g., "body:json", "body:graphql")
 * @param content - Raw content to include (preserved as-is)
 * @returns Formatted Bruno block string
 */
function formatBlockWithContent(name: string, content: string): string {
  if (!content || content.trim() === "") {
    return `${name} { }`;
  }

  // Indent content by 2 spaces
  const indentedContent = content
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");

  return `${name} {\n${indentedContent}\n}`;
}

/**
 * Format a multi-line string for docs blocks using ''' syntax.
 */
function formatMultiline(text: string): string {
  if (!text.includes("\n")) {
    return text;
  }
  return `'''${text}'''`;
}

/**
 * Format a comment line in Bruno DSL (using # prefix).
 */
function formatComment(text: string): string {
  return `# ${text}`;
}

/**
 * Format a disabled field with ~ prefix.
 */
function formatDisabledField(key: string, value: unknown): string {
  const escapedKey = escapeKey(key);
  const serializedValue = serializeValue(value);
  return `~${escapedKey}: ${serializedValue}`;
}

/**
 * Format a local/unpersisted variable with @ prefix.
 */
function formatLocalVar(key: string, value: unknown): string {
  const escapedKey = escapeKey(key);
  const serializedValue = serializeValue(value);
  return `@${escapedKey}: ${serializedValue}`;
}

export {
  serializeValue,
  escapeKey,
  formatBlock,
  formatBlockWithContent,
  formatMultiline,
  formatComment,
  formatDisabledField,
  formatLocalVar,
};
