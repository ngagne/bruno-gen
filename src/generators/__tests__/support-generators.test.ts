import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  escapeKey,
  formatBlock,
  formatBlockWithContent,
  formatComment,
  formatDisabledField,
  formatLocalVar,
  formatMultiline,
  serializeValue,
} from "../bru-serializer.js";
import { extractBaseUrl, generateEnvironmentBru } from "../environment-generator.js";
import { readBruFile, prepareOutputDir, writeBruFile } from "../file-writer.js";
import { generatePostResponseVars, generateResponseDocs } from "../response-examples.js";
import type { CollectionIR, ResponseIR } from "../../ir/index.js";

const dirs: string[] = [];
afterEach(async () =>
  Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))),
);

describe("Bruno serialization support", () => {
  it("serializes scalar, list, object, and utility syntax accepted by Bruno", () => {
    expect(serializeValue(null)).toBe("null");
    expect(serializeValue(true)).toBe("true");
    expect(serializeValue(2)).toBe("2");
    expect(serializeValue("hello world")).toBe("hello world");
    expect(serializeValue("{{token}}/users")).toBe("{{token}}/users");
    expect(serializeValue("a\nb")).toBe("'''a\nb'''");
    expect(serializeValue(["smoke", "regression"])).toContain("    smoke\n    regression");
    expect(serializeValue({ id: 1 })).toContain('"id": 1');
    expect(escapeKey("content-type")).toBe("content-type");
    expect(escapeKey('key "with" spaces')).toBe('"key \\"with\\" spaces"');
    expect(formatBlock("meta", {})).toBe("meta { }");
    expect(formatBlock("meta", { tags: ["smoke"] })).toContain("tags: [");
    expect(formatBlockWithContent("docs", "a\nb")).toContain("  a\n  b");
    expect(formatBlockWithContent("docs", "")).toBe("docs { }");
    expect(formatMultiline("one")).toBe("one");
    expect(formatMultiline("one\ntwo")).toBe("'''one\ntwo'''");
    expect(formatComment("note")).toBe("# note");
    expect(formatDisabledField("x", "y")).toBe("~x: y");
    expect(formatLocalVar("x", "y")).toBe("@x: y");
  });
});

describe("environment and response support", () => {
  const ir: CollectionIR = {
    info: { title: "API", version: "1" },
    servers: [{ url: "https://{region}.example.com", variables: { region: { default: "eu" } } }],
    securitySchemes: { key: { type: "apiKey", name: "X-Key", in: "header" } },
    defaultSecurity: [],
    tags: [],
    endpoints: [],
    components: { schemas: {}, parameters: {}, responses: {}, requestBodies: {} },
    extensions: {},
  };

  it("builds an environment from server defaults and auth", () => {
    expect(extractBaseUrl(ir)).toBe("https://eu.example.com");
    expect(extractBaseUrl({ ...ir, servers: [] })).toBe("https://api.example.com");
    expect(generateEnvironmentBru(ir)).toContain("keyValue: your-api-key");
    expect(generateEnvironmentBru(ir)).toContain("region: eu");
  });

  it("documents response examples and only creates useful post-response variables", () => {
    const responses: ResponseIR[] = [
      {
        statusCode: "200",
        description: "OK",
        headers: {},
        links: {},
        content: {
          "application/json": {
            schema: { type: "object", properties: { id: { type: "integer" } } },
            example: { id: 7 },
          },
        },
      },
    ];
    expect(generateResponseDocs([])).toBe("");
    expect(generateResponseDocs(responses)).toContain('"id": 7');
    expect(generatePostResponseVars(responses)).toContain("id: $res.body.id");
    expect(generatePostResponseVars([{ ...responses[0], statusCode: "400" }])).toBe("");
    expect(
      generatePostResponseVars([
        { ...responses[0], content: { "text/plain": { schema: { type: "string" } } } },
      ]),
    ).toBe("");
  });
});

describe("file writer", () => {
  it("writes, reads, and cleans a generated output directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gen-bruno-writer-"));
    dirs.push(dir);
    const target = join(dir, "nested", "request.bru");
    expect((await writeBruFile("get {\n}\n", target)).success).toBe(true);
    expect(await readBruFile(target)).toContain("get");
    await writeFile(join(dir, "stale.bru"), "stale");
    await prepareOutputDir(dir, { clean: true });
    await expect(readFile(join(dir, "stale.bru"), "utf8")).rejects.toThrow();
  });
});
