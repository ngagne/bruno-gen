import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bruToJsonV2, collectionBruToJson } from "@usebruno/lang";
import { parse } from "../../parsers/parse.js";
import { generate } from "../orchestrator.js";

describe("AsyncAPI WebSocket → Bruno compatibility", () => {
  let outputDir: string;

  beforeAll(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "gen-bruno-asyncapi-"));
    const ir = await parse(join(process.cwd(), "test/fixtures/asyncapi/chat-websocket.yaml"));
    const result = await generate(ir, { outputDir, grouping: "flat" });
    expect(result.success).toBe(true);
  });

  afterAll(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it("creates Bruno-readable native WebSocket requests", async () => {
    const collection = collectionBruToJson(
      await readFile(join(outputDir, "collection.bru"), "utf8"),
    ) as { vars: { req: { name: string; value: string }[] } };
    const request = bruToJsonV2(await readFile(join(outputDir, "sendchatmessage.bru"), "utf8")) as {
      meta: { type: string };
      ws: { url: string };
      body: {
        mode: string;
        ws: { name: string; type: string; content: string; selected: boolean }[];
      };
    };

    expect(collection.vars.req).toContainEqual(
      expect.objectContaining({ name: "baseUrl", value: "wss://chat.example.com/socket" }),
    );
    expect(request.meta.type).toBe("ws");
    expect(request.ws).toEqual({ url: "{{baseUrl}}" });
    expect(request.body).toMatchObject({
      mode: "ws",
      ws: [
        {
          name: "chat message",
          type: "json",
          selected: true,
          content: expect.stringContaining('"text": "Hello from AsyncAPI"'),
        },
      ],
    });
  });
});
