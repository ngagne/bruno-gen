/** Materialize a side-effect-free collection plan to an output directory. */

import { join } from "node:path";
import type { CollectionIR } from "../ir/index.js";
import type { Plugin, PluginContext } from "../plugins/types.js";
import type { ResolvedConfig } from "../config/types.js";
import { executePreOutput, executeTransformIR } from "../plugins/execute.js";
import { prepareOutputDir, writeBruFile } from "./file-writer.js";
import { planCollection } from "./collection-plan.js";

interface GenerateOptions {
  outputDir: string;
  force?: boolean;
  grouping?: "tag" | "path" | "flat";
  generateTests?: boolean;
  plugins?: Plugin[];
  specPath?: string;
  resolvedConfig?: ResolvedConfig;
}

interface GenerateResult {
  success: boolean;
  filesWritten: string[];
  warnings: string[];
}

/** Generate and write a complete Bruno collection from an IR. */
async function generate(ir: CollectionIR, options: GenerateOptions): Promise<GenerateResult> {
  const filesWritten: string[] = [];
  const plugins = options.plugins ?? [];

  try {
    const transformedIR = await executeTransformIR(ir, plugins, {
      specPath: options.specPath ?? "unknown",
      options: options.resolvedConfig ?? {},
    } satisfies PluginContext);
    const plan = planCollection(transformedIR, options);

    await prepareOutputDir(options.outputDir, { clean: options.force === true });

    const warnings = [...plan.warnings];
    for (const file of plan.files) {
      const outputPath = join(options.outputDir, file.relativePath);
      let content = file.content;

      if (file.kind === "request") {
        content = await executePreOutput(
          content,
          { filePath: outputPath, endpoint: file.endpoint, folder: file.folder },
          plugins,
        );
      }

      const result = await writeBruFile(content, outputPath);
      if (result.success) {
        filesWritten.push(outputPath);
      } else {
        warnings.push(`Failed to write ${file.relativePath}: ${result.error}`);
      }
    }

    return { success: warnings.length === 0, filesWritten, warnings };
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
