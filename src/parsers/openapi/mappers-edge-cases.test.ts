import { describe, expect, it } from "vitest";
import { mapParameters, mergeParameters } from "./parameter-mapper.js";
import { mapRequestBody } from "./request-body-mapper.js";
import { mapResponses } from "./response-mapper.js";

describe("OpenAPI mapper edge cases", () => {
  it("filters unresolved parameter references and supplies safe defaults", () => {
    expect(
      mapParameters([
        { $ref: "#/components/parameters/Missing" },
        { $ref: "#/components/parameters/Resolved", schema: { type: "integer" }, name: "page" },
        { description: 42, deprecated: false, required: false },
      ]),
    ).toEqual([
      expect.objectContaining({ name: "page", in: "query", schema: { type: "integer" } }),
      expect.objectContaining({
        name: "unknown",
        in: "query",
        required: false,
        deprecated: false,
        description: undefined,
      }),
    ]);
  });

  it("merges operation parameters by name and location", () => {
    const path = mapParameters([
      { name: "id", in: "path", required: true, schema: { type: "string" } },
      { name: "locale", in: "query", schema: { type: "string" } },
    ]);
    const operation = mapParameters([
      { name: "locale", in: "query", example: "fr", schema: { type: "string" } },
      { name: "locale", in: "header", example: "en", schema: { type: "string" } },
    ]);

    expect(mergeParameters(path, operation)).toEqual([
      expect.objectContaining({ name: "id", in: "path" }),
      expect.objectContaining({ name: "locale", in: "query", example: "fr" }),
      expect.objectContaining({ name: "locale", in: "header", example: "en" }),
    ]);
  });

  it("rejects absent, unresolved, and empty request bodies", () => {
    expect(mapRequestBody(undefined)).toBeUndefined();
    expect(mapRequestBody("invalid" as unknown as Record<string, unknown>)).toBeUndefined();
    expect(mapRequestBody({ $ref: "#/components/requestBodies/Missing" })).toBeUndefined();
    expect(mapRequestBody({ content: {} })).toBeUndefined();
  });

  it("maps request body media metadata and defaults", () => {
    expect(
      mapRequestBody({
        description: "Create payload",
        required: true,
        content: {
          "application/json": {
            example: { name: "Ada" },
            examples: { alternate: { value: { name: "Grace" } } },
            encoding: { name: { style: "form" } },
          },
        },
      }),
    ).toEqual({
      description: "Create payload",
      required: true,
      content: {
        "application/json": {
          schema: {},
          example: { name: "Ada" },
          examples: { alternate: { value: { name: "Grace" } } },
          encoding: { name: { style: "form" } },
        },
      },
    });

    expect(
      mapRequestBody({ description: 42, required: false, content: { "text/plain": {} } }),
    ).toMatchObject({ description: undefined, required: false });
  });

  it("returns no responses for missing input and skips unresolved references", () => {
    expect(mapResponses(undefined)).toEqual([]);
    expect(mapResponses("invalid" as unknown as Record<string, unknown>)).toEqual([]);
    expect(mapResponses({ default: { $ref: "#/components/responses/Missing" } })).toEqual([]);
  });

  it("maps response content, headers, links, and fallback descriptions", () => {
    expect(
      mapResponses({
        "200": {
          $ref: "#/components/responses/Resolved",
          description: "OK",
          content: {
            "application/json": {
              example: { id: 1 },
              examples: { alternate: { value: { id: 2 } } },
              encoding: { id: { style: "form" } },
            },
          },
          headers: {
            "X-Rate-Limit": {
              description: "Remaining requests",
              required: true,
              schema: { type: "integer" },
            },
            "X-Trace": { description: 42 },
          },
          links: { next: { operationId: "nextPage" } },
        },
        "204": {},
      }),
    ).toEqual([
      expect.objectContaining({
        statusCode: "200",
        description: "OK",
        content: {
          "application/json": expect.objectContaining({ schema: {}, example: { id: 1 } }),
        },
        headers: {
          "X-Rate-Limit": expect.objectContaining({
            description: "Remaining requests",
            required: true,
            schema: { type: "integer" },
          }),
          "X-Trace": expect.objectContaining({
            description: undefined,
            required: false,
            schema: {},
          }),
        },
        links: { next: { operationId: "nextPage" } },
      }),
      expect.objectContaining({ statusCode: "204", description: "", content: {}, headers: {} }),
    ]);
  });
});
