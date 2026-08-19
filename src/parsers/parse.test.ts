import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, validate } from "./parse.js";

const dirs: string[] = [];
afterEach(async () =>
  Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))),
);

describe("unified parser", () => {
  it("routes inline OpenAPI, Swagger, GraphQL, and AsyncAPI input", async () => {
    await expect(
      parse({ content: { openapi: "3.0.0", info: { title: "Open", version: "1" }, paths: {} } }),
    ).resolves.toMatchObject({ info: { title: "Open" } });
    await expect(
      parse({ content: { swagger: "2.0", info: { title: "Swagger", version: "1" }, paths: {} } }),
    ).resolves.toMatchObject({ info: { title: "Swagger" } });
    await expect(parse({ content: "type Query { ping: String! }" })).resolves.toMatchObject({
      info: { title: "GraphQL API" },
    });
    await expect(
      parse({
        content:
          "asyncapi: 3.0.0\ninfo: { title: Socket, version: '1' }\nservers: { local: { host: localhost, protocol: ws } }\nchannels: { ping: { address: ping } }\noperations: { sendPing: { action: send, channel: { $ref: '#/channels/ping' } } }",
      }),
    ).resolves.toMatchObject({ info: { title: "Socket" } });
  });

  it("routes files and GraphQL directories and provides useful unknown-format validation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gen-bruno-parse-"));
    dirs.push(dir);
    const openapi = join(dir, "api.json");
    await writeFile(
      openapi,
      JSON.stringify({ openapi: "3.0.0", info: { title: "File", version: "1" }, paths: {} }),
    );
    await expect(parse(openapi)).resolves.toMatchObject({ info: { title: "File" } });
    const graphqlDir = join(dir, "schema");
    await mkdir(graphqlDir);
    await writeFile(join(graphqlDir, "api.graphql"), "type Query { ping: String! }");
    await expect(parse(graphqlDir)).resolves.toMatchObject({ info: { title: "GraphQL API" } });
    await expect(parse({ content: { nope: true } })).rejects.toThrow("Unknown spec format");
    await expect(validate({ content: { nope: true } })).resolves.toMatchObject({
      valid: false,
      errors: [expect.objectContaining({ code: "UNKNOWN_FORMAT" })],
    });
  });

  it("validates the recognized input families", async () => {
    await expect(
      validate({ content: { openapi: "3.0.0", info: { title: "API", version: "1" }, paths: {} } }),
    ).resolves.toMatchObject({ valid: true });
    await expect(validate({ content: "type Query { ping: String! }" })).resolves.toMatchObject({
      valid: true,
    });
  });
});
