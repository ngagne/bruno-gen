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
  /** folder.bru content. */
  folderBru: string;
  /** Endpoints belonging to this folder. */
  endpoints: EndpointIR[];
  /** Display name for the folder. */
  displayName: string;
}

/**
 * Group endpoints by their primary tag and generate folder.bru for each.
 * @param ir - The collection IR
 * @returns Array of folder groups with endpoints
 */
function generateFolderGroups(ir: CollectionIR): FolderGroup[] {
  // Group endpoints by first tag
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

  // Generate groups from tags
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
