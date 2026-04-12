/**
 * Orchestrator — coordinates all sub-generators.
 * Main generate() function that creates a complete Bruno collection from CollectionIR.
 */

import type { CollectionIR } from "../ir/index.js";
import type { Plugin, PluginContext } from "../plugins/types.js";
import type { ResolvedConfig } from "../config/types.js";
import { prepareOutputDir, writeBruFile } from "./file-writer.js";
import { generateCollectionBru } from "./collection-generator.js";
import { generateAuthVars } from "./environment-generator.js";
import { formatBlock } from "./bru-serializer.js";
import { generateBrunoJson } from "./bruno-json-generator.js";
import { generateFolderGroups } from "./folder-generator.js";
import { generateRequestBru } from "./request-generator.js";
import { sanitizeRequestFilename } from "./path-sanitizer.js";

interface GenerateOptions {
  /** Output directory path. */
  outputDir: string;
  /** Force regeneration (clean existing). */
  force?: boolean;
  /** Grouping strategy: 'tag' | 'path' | 'flat'. Default: 'tag'. */
  grouping?: "tag" | "path" | "flat";
  /** Generate post-response test assertions. */
  generateTests?: boolean;
  /** Plugin array to run during generation. */
  plugins?: Plugin[];
  /** Spec path (for plugin context). */
  specPath?: string;
  /** Resolved config (for plugin context). */
  resolvedConfig?: ResolvedConfig;
}

interface GenerateResult {
  success: boolean;
  filesWritten: string[];
  warnings: string[];
}

/**
 * Main entry point — generate a complete Bruno collection from IR.
 * @param ir - The collection IR
 * @param options - Generation options
 * @returns Result with files written and any warnings
 */
async function generate(ir: CollectionIR, options: GenerateOptions): Promise<GenerateResult> {
  const filesWritten: string[] = [];
  const warnings: string[] = [];
  const usedFilenames = new Set<string>();

  try {
    // Step 0: Run transformIR plugin hooks (waterfall)
    let transformedIR = ir;
    if (options.plugins && options.plugins.length > 0) {
      const pluginContext: PluginContext = {
        specPath: options.specPath ?? "unknown",
        options: options.resolvedConfig ?? {},
      };
      for (const plugin of options.plugins) {
        if (plugin.hooks.transformIR) {
          try {
            transformedIR = await plugin.hooks.transformIR(transformedIR, pluginContext);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
              success: false,
              filesWritten,
              warnings: [`Plugin '${plugin.name}' transformIR hook failed: ${message}`],
            };
          }
        }
      }
    }

    // Step 1: Prepare output directory
    await prepareOutputDir(options.outputDir);

    // Step 2: Generate bruno.json (required for valid Bruno collection)
    const brunoJson = generateBrunoJson(transformedIR);
    const brunoJsonPath = `${options.outputDir}/bruno.json`;
    const brunoJsonResult = await writeBruFile(brunoJson, brunoJsonPath);
    if (brunoJsonResult.success) {
      filesWritten.push(brunoJsonPath);
    } else {
      warnings.push(`Failed to write bruno.json: ${brunoJsonResult.error}`);
    }

    // Step 3: Generate collection.bru
    const collectionBru = generateCollectionBru(transformedIR);
    const collectionPath = `${options.outputDir}/collection.bru`;
    const collectionResult = await writeBruFile(collectionBru, collectionPath);
    if (collectionResult.success) {
      filesWritten.push(collectionPath);
    } else {
      warnings.push(`Failed to write collection.bru: ${collectionResult.error}`);
    }

    // Step 4: Generate environment file only if there are meaningful vars
    // (auth vars, server variable defaults). Skip if the only var would be baseUrl
    // since that belongs in collection-level vars, not environment.
    const envVars = collectEnvironmentVars(transformedIR);
    if (Object.keys(envVars).length > 0) {
      const envBru = formatEnvVarsBlock(envVars);
      const envPath = `${options.outputDir}/environments/default.bru`;
      const envResult = await writeBruFile(envBru, envPath);
      if (envResult.success) {
        filesWritten.push(envPath);
      } else {
        warnings.push(`Failed to write environment file: ${envResult.error}`);
      }
    }

    // Step 5: Generate folder groups and request files
    let folderGroups = generateFolderGroups(transformedIR, { format: options.grouping });

    // Skip the "ungrouped" folder if it's the only group — files go at root instead
    if (folderGroups.length === 1 && folderGroups[0].folderName === "ungrouped") {
      folderGroups = generateFolderGroups(transformedIR, { format: "flat" });
    }

    for (const group of folderGroups) {
      // Determine the directory for request files
      // In flat mode, files go directly in outputDir
      const folderDir = group.folderName
        ? `${options.outputDir}/${group.folderName}`
        : options.outputDir;

      if (group.folderName) {
        await prepareOutputDir(folderDir);
      }

      // Write folder.bru (skip in flat mode)
      if (group.folderBru) {
        const folderBruPath = `${folderDir}/folder.bru`;
        const folderResult = await writeBruFile(group.folderBru, folderBruPath);
        if (folderResult.success) {
          filesWritten.push(folderBruPath);
        } else {
          warnings.push(
            `Failed to write folder.bru for ${group.displayName}: ${folderResult.error}`,
          );
        }
      }

      // Write request files for each endpoint in this folder
      for (let i = 0; i < group.endpoints.length; i++) {
        const endpoint = group.endpoints[i];

        // Generate request.bru content
        const requestBru = generateRequestBru(endpoint, transformedIR, {
          seq: i + 1,
          baseUrl: "{{baseUrl}}",
          generateTests: options.generateTests,
        });

        // Generate safe filename
        const filename = sanitizeRequestFilename(endpoint, usedFilenames);
        const requestPath = `${folderDir}/${filename}`;

        // Run preOutput plugin hooks (waterfall)
        let finalContent = requestBru;
        if (options.plugins && options.plugins.length > 0) {
          const preOutputCtx = {
            filePath: requestPath,
            endpoint,
            folder: group.folderName,
          };
          for (const plugin of options.plugins) {
            if (plugin.hooks.preOutput) {
              try {
                finalContent = await plugin.hooks.preOutput(finalContent, preOutputCtx);
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return {
                  success: false,
                  filesWritten,
                  warnings: [`Plugin '${plugin.name}' preOutput hook failed: ${message}`],
                };
              }
            }
          }
        }

        const requestResult = await writeBruFile(finalContent, requestPath);
        if (requestResult.success) {
          filesWritten.push(requestPath);
        } else {
          warnings.push(`Failed to write request file ${filename}: ${requestResult.error}`);
        }

        // Add warning for deprecated endpoints
        if (endpoint.deprecated) {
          warnings.push(`Endpoint ${endpoint.id} is deprecated`);
        }
      }
    }

    return {
      success: warnings.length === 0,
      filesWritten,
      warnings,
    };
  } catch (error) {
    return {
      success: false,
      filesWritten,
      warnings: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export { generate };
export type { GenerateOptions, GenerateResult };

/**
 * Collect environment variables from IR, excluding baseUrl (which goes in collection vars).
 * Returns only auth vars and server variable defaults.
 */
function collectEnvironmentVars(ir: CollectionIR): Record<string, string> {
  const vars: Record<string, string> = {};

  // Auth variables from all security schemes
  const authVars = generateAuthVars(ir.securitySchemes);
  Object.assign(vars, authVars);

  // Server variable defaults
  if (ir.servers && ir.servers.length > 0 && ir.servers[0].variables) {
    const serverVars = ir.servers[0].variables;
    for (const [key, serverVar] of Object.entries(serverVars)) {
      if (serverVar.default) {
        vars[key] = serverVar.default;
      }
    }
  }

  return vars;
}

/**
 * Format environment variables as a vars block.
 */
function formatEnvVarsBlock(vars: Record<string, unknown>): string {
  return formatBlock("vars", vars);
}
