import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { GrpcParser } from "./GrpcParser.js";

const fixture = join(process.cwd(), "test/fixtures/grpc/greeter.proto");

describe("GrpcParser", () => {
  it("maps services, unary and streaming methods, and request examples", async () => {
    const ir = await new GrpcParser().parse({ filePath: fixture });

    expect(ir.info.title).toBe("example.greeter gRPC API");
    expect(ir.endpoints).toHaveLength(2);
    expect(ir.endpoints[0].grpc).toMatchObject({
      method: "example.greeter.Greeter/SayHello",
      methodType: "unary",
      requestExample: { name: "", aliases: [""] },
      proto: { fileName: "greeter.proto" },
    });
    expect(ir.endpoints[1].grpc?.methodType).toBe("serverStreaming");
  });

  it("reports invalid proto syntax and service-less specs", async () => {
    const parser = new GrpcParser();
    await expect(
      parser.validate({ content: 'syntax = "proto3"; message Empty {}', format: "grpc" }),
    ).resolves.toMatchObject({ valid: false });
    await expect(parser.validate({ content: "not valid", format: "grpc" })).resolves.toMatchObject({
      valid: false,
    });
  });
});
