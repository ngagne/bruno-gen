import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bruToJsonV2 } from "@usebruno/lang";
import { parse } from "../../parsers/parse.js";
import { generate } from "../orchestrator.js";

describe("gRPC proto → Bruno compatibility", () => {
  let outputDir: string;

  beforeAll(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "gen-bruno-grpc-"));
    const ir = await parse(join(process.cwd(), "test/fixtures/grpc/greeter.proto"));
    const result = await generate(ir, { outputDir, grouping: "flat" });
    expect(result.success).toBe(true);
  });

  afterAll(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it("creates Bruno-readable native gRPC requests and includes their proto dependency", async () => {
    const requestPath = join(outputDir, "greeter.sayhello.bru");
    const request = bruToJsonV2(await readFile(requestPath, "utf8")) as {
      meta: { type: string };
      grpc: { url: string; method: string; body: string; protoPath: string; methodType: string };
      body: { mode: string; grpc: { name: string; content: string }[] };
    };

    expect(request.meta.type).toBe("grpc");
    expect(request.grpc).toMatchObject({
      url: "{{baseUrl}}",
      method: "example.greeter.Greeter/SayHello",
      body: "grpc",
      protoPath: "protos/greeter.proto",
      methodType: "unary",
    });
    expect(request.body.mode).toBe("grpc");
    expect(JSON.parse(request.body.grpc[0].content)).toEqual({ name: "", aliases: [""] });
    await expect(stat(join(outputDir, "protos/greeter.proto"))).resolves.toBeDefined();
  });
});
