/**
 * Generate folder.bru for tag-based grouping.
 * Maps endpoints to folders by their primary tag.
 */

import type { CollectionIR, EndpointIR } from "../ir/index.js";
import { sanitizeFolderName } from "./path-sanitizer.js";
import { formatBlock } from "./bru-serializer.js";

interface FolderGroup {
  /** Folder directory name (sanitized tag name). */
  folderName: string;
  /** folder.bru content (null in flat mode). */
  folderBru: string | null;
  /** Endpoints belonging to this folder. */
  endpoints: EndpointIR[];
  /** Display name for the folder. */
  displayName: string;
}

interface FolderOptions {
  /** Grouping format: 'tag' (default), 'path', or 'flat'. */
  format?: "tag" | "path" | "flat";
}

/**
 * Group endpoints by their grouping strategy and generate folder.bru for each.
 * @param ir - The collection IR
 * @param options - Grouping options
 * @returns Array of folder groups with endpoints
 */
function generateFolderGroups(ir: CollectionIR, options?: FolderOptions): FolderGroup[] {
  const format = options?.format ?? "tag";

  if (format === "flat") {
    return generateFlatGroups(ir);
  }

  if (format === "path") {
    return generatePathGroups(ir);
  }

  // Default: tag-based grouping
  return generateTagGroups(ir);
}

/**
 * Group endpoints by their primary tag.
 */
function generateTagGroups(ir: CollectionIR): FolderGroup[] {
  const tagMap = new Map<string, EndpointIR[]>();
  const ungrouped: EndpointIR[] = [];

  for (const endpoint of ir.endpoints) {
    if (endpoint.tags && endpoint.tags.length > 0) {
      const primaryTag = endpoint.tags[0];
      const existingEndpoints = tagMap.get(primaryTag) || [];
      existingEndpoints.push(endpoint);
      tagMap.set(primaryTag, existingEndpoints);
    } else {
      ungrouped.push(endpoint);
    }
  }

  const groups: FolderGroup[] = [];
  let sequence = 1;

  // Sort tags by their appearance in the tags array for consistent ordering
  const sortedTags = ir.tags ? ir.tags.map((t) => t.name) : Array.from(tagMap.keys());

  for (const tagName of sortedTags) {
    const endpoints = tagMap.get(tagName);
    if (endpoints && endpoints.length > 0) {
      const folderName = sanitizeFolderName(tagName);
      const folderBru = generateFolderBru(tagName, sequence);
      groups.push({
        folderName,
        folderBru,
        endpoints,
        displayName: tagName,
      });
      sequence++;
    }
  }

  // Handle ungrouped endpoints
  if (ungrouped.length > 0) {
    const folderBru = generateFolderBru("Ungrouped", sequence);
    groups.push({
      folderName: "ungrouped",
      folderBru,
      endpoints: ungrouped,
      displayName: "Ungrouped",
    });
  }

  return groups;
}

/**
 * Group endpoints by first URL path segment.
 */
function generatePathGroups(ir: CollectionIR): FolderGroup[] {
  const pathMap = new Map<string, EndpointIR[]>();

  for (const endpoint of ir.endpoints) {
    // Extract first path segment: /users/123/posts → users
    const segments = endpoint.path.split("/").filter(Boolean);
    const firstSegment = segments[0] ?? "root";
    const existing = pathMap.get(firstSegment) || [];
    existing.push(endpoint);
    pathMap.set(firstSegment, existing);
  }

  const groups: FolderGroup[] = [];
  let sequence = 1;

  for (const [segment, endpoints] of pathMap) {
    const folderName = sanitizeFolderName(segment);
    const folderBru = generateFolderBru(segment, sequence);
    groups.push({
      folderName,
      folderBru,
      endpoints,
      displayName: segment,
    });
    sequence++;
  }

  return groups;
}

/**
 * Flat grouping — no folders, all endpoints at root.
 */
function generateFlatGroups(ir: CollectionIR): FolderGroup[] {
  return [
    {
      folderName: "",
      folderBru: null,
      endpoints: ir.endpoints,
      displayName: "root",
    },
  ];
}

/**
 * Generate folder.bru content for a single tag.
 * @param tagName - The display name for the folder
 * @param sequence - The ordering sequence number
 * @returns The folder.bru file content
 */
function generateFolderBru(tagName: string, sequence: number): string {
  const entries: Record<string, unknown> = {
    name: tagName,
    seq: sequence,
  };
  return formatBlock("meta", entries);
}

export { generateFolderGroups, generateFolderBru };
export type { FolderGroup };
