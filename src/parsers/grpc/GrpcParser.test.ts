import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { GrpcParser } from "./GrpcParser.js";

const fixture = join(process.cwd(), "test/fixtures/grpc/greeter.proto");

describe("GrpcParser", () => {
  it("detects service declarations in raw proto content", () => {
    const parser = new GrpcParser();
    expect(parser.canParse({ _raw: "service Greeter {}" })).toBe(true);
    expect(parser.canParse({ _raw: "message Greeter {}" })).toBe(false);
    expect(parser.canParse({})).toBe(false);
  });

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

  it("maps every streaming mode and representative scalar and nested values", async () => {
    const ir = await new GrpcParser().parse({
      content: `syntax = "proto3";
message Child { bool enabled = 1; bytes data = 2; double ratio = 3; uint64 count = 4; }
message Request { Child child = 1; repeated int32 ids = 2; string name = 3; }
service Streams {
  rpc Unary (Request) returns (Child);
  rpc Upload (stream Request) returns (Child);
  rpc Chat (stream Request) returns (stream Child);
}`,
      format: "grpc",
    });

    expect(ir.info.title).toBe("gRPC API");
    expect(ir.endpoints.map((endpoint) => endpoint.grpc?.methodType)).toEqual([
      "unary",
      "clientStreaming",
      "bidirectionalStreaming",
    ]);
    expect(ir.endpoints[0].grpc?.requestExample).toEqual({
      child: { enabled: false, data: "", ratio: 0, count: 0 },
      ids: [0],
      name: "",
    });
    expect(ir.endpoints[0].grpc?.proto.fileName).toBe("service.proto");
  });

  it("prevents recursive request schemas from recursing forever", async () => {
    const ir = await new GrpcParser().parse({
      content: `syntax = "proto3";
message Node { string value = 1; Node next = 2; }
service Tree { rpc Add (Node) returns (Node); }`,
      format: "grpc",
    });

    expect(ir.endpoints[0].grpc?.requestExample).toEqual({ value: "", next: {} });
  });

  it("validates a usable service and rejects a service without methods during parse", async () => {
    const parser = new GrpcParser();
    await expect(
      parser.validate({
        content:
          'syntax = "proto3"; message Empty {} service Health { rpc Check (Empty) returns (Empty); }',
        format: "grpc",
      }),
    ).resolves.toEqual({ valid: true, errors: [], warnings: [] });
    await expect(
      parser.parse({ content: 'syntax = "proto3"; service Empty {}', format: "grpc" }),
    ).rejects.toThrow("no gRPC service methods");
  });

  it("wraps parser failures with the public error prefix", async () => {
    await expect(
      new GrpcParser().parse({ content: 'syntax = "proto3"; service Broken {', format: "grpc" }),
    ).rejects.toThrow("Failed to parse Protocol Buffer spec:");
  });
});
