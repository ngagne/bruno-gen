import { describe, it, expect } from "vitest";
import { detectFormat } from "./auto-detector.js";

describe("auto-detector", () => {
  it("detects OpenAPI from content field", () => {
    expect(detectFormat({ openapi: "3.0.0" })).toBe("openapi");
    expect(detectFormat({ openapi: "3.1.0" })).toBe("openapi");
  });

  it("detects Swagger from content field", () => {
    expect(detectFormat({ swagger: "2.0" })).toBe("swagger");
  });

  it("detects AsyncAPI from content field", () => {
    expect(detectFormat({ asyncapi: "3.0.0" })).toBe("asyncapi");
    expect(detectFormat("asyncapi: 2.6.0" as unknown as Record<string, unknown>)).toBe("asyncapi");
  });

  it("detects GraphQL from file extension", () => {
    expect(detectFormat({}, "schema.graphql")).toBe("graphql");
    expect(detectFormat({}, "schema.gql")).toBe("graphql");
  });

  it("detects GraphQL from content inspection", () => {
    const data = { _raw: "type Query { users: [User] }" };
    expect(detectFormat(data as Record<string, unknown>)).toBe("graphql");
  });

  it("detects GraphQL declaration forms from content and SDL fields", () => {
    const declarations = [
      "type Mutation { update: Boolean }",
      "type Subscription { changed: Boolean }",
      "scalar DateTime",
      "interface Node { id: ID! }",
      "enum Role { ADMIN }",
      "union Search = User",
      "input UserInput { name: String }",
    ];
    for (const declaration of declarations) {
      expect(detectFormat({ content: declaration })).toBe("graphql");
    }
    expect(detectFormat({ sdl: "type Query { ping: String }" })).toBe("graphql");
  });

  it("detects Protocol Buffers by extension and service signatures", () => {
    expect(detectFormat({}, "service.proto")).toBe("grpc");
    expect(
      detectFormat({ _raw: "service Greeter { rpc SayHello (Request) returns (Reply); }" }),
    ).toBe("grpc");
    expect(detectFormat({ _raw: "service Empty {}" })).toBe("unknown");
  });

  it("rejects unsupported version markers", () => {
    expect(detectFormat({ openapi: "2.0.0" })).toBe("unknown");
    expect(detectFormat({ swagger: "1.2" })).toBe("unknown");
    expect(detectFormat({ asyncapi: "1.0.0" })).toBe("unknown");
  });

  it("returns unknown for unrecognized formats", () => {
    expect(detectFormat({})).toBe("unknown");
    expect(detectFormat({ random: "data" })).toBe("unknown");
  });

  it("prioritizes extension over content", () => {
    // .graphql extension should win even with no GraphQL content
    expect(detectFormat({}, "file.graphql")).toBe("graphql");
  });

  it("prioritizes content field over extension for OpenAPI/Swagger", () => {
    expect(detectFormat({ openapi: "3.0.0" }, "file.json")).toBe("openapi");
    expect(detectFormat({ swagger: "2.0" }, "file.yaml")).toBe("swagger");
  });
});
