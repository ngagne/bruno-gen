import { describe, it, expect } from "vitest";
import {
  generatePostResponseTests,
  generateAssertions,
  isSuccessStatus,
  findJsonMediaType,
  getRequiredFields,
  formatExpectedValue,
} from "../test-generator.js";
import type { ResponseIR } from "../../ir/index.js";

describe("test-generator", () => {
  describe("generatePostResponseTests", () => {
    it("generates status-only assertion for 200 response with no required fields or example", () => {
      const responses: ResponseIR[] = [
        {
          statusCode: "200",
          description: "OK",
          headers: {},
          content: {
            "application/json": {
              schema: { type: "object", properties: {} },
            },
          },
          links: {},
        },
      ];

      const result = generatePostResponseTests(responses);
      expect(result).toContain("tests {");
      expect(result).toContain('expect(res.status).to.equal(200, "expected status 200")');
      expect(result).toContain('test("200 OK"');
    });

    it("generates required fields presence assertions", () => {
      const responses: ResponseIR[] = [
        {
          statusCode: "200",
          description: "OK",
          headers: {},
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {},
                required: ["id", "name", "email"],
              },
            },
          },
          links: {},
        },
      ];

      const result = generatePostResponseTests(responses);
      expect(result).toContain('res.body).to.have.property("id"');
      expect(result).toContain('res.body).to.have.property("name"');
      expect(result).toContain('res.body).to.have.property("email"');
    });

    it("generates example value assertion when spec provides example", () => {
      const responses: ResponseIR[] = [
        {
          statusCode: "200",
          description: "OK",
          headers: {},
          content: {
            "application/json": {
              schema: { type: "object" },
              example: { id: 42, name: "Test" },
            },
          },
          links: {},
        },
      ];

      const result = generatePostResponseTests(responses);
      expect(result).toContain("res.body.id").toContain("42");
    });

    it("filters out non-2xx responses", () => {
      const responses: ResponseIR[] = [
        {
          statusCode: "200",
          description: "OK",
          headers: {},
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
          links: {},
        },
        {
          statusCode: "400",
          description: "Bad Request",
          headers: {},
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
          links: {},
        },
        {
          statusCode: "500",
          description: "Server Error",
          headers: {},
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
          links: {},
        },
      ];

      const result = generatePostResponseTests(responses);
      expect(result).toContain("expected status 200");
      expect(result).not.toContain("expected status 400");
      expect(result).not.toContain("expected status 500");
    });

    it("filters out non-JSON responses", () => {
      const responses: ResponseIR[] = [
        {
          statusCode: "200",
          description: "OK",
          headers: {},
          content: {
            "application/xml": {
              schema: { type: "string" },
            },
          },
          links: {},
        },
      ];

      const result = generatePostResponseTests(responses);
      expect(result).toBe("");
    });

    it("handles multiple 2xx responses", () => {
      const responses: ResponseIR[] = [
        {
          statusCode: "200",
          description: "OK",
          headers: {},
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
          links: {},
        },
        {
          statusCode: "201",
          description: "Created",
          headers: {},
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
          links: {},
        },
      ];

      const result = generatePostResponseTests(responses);
      expect(result).toContain("expected status 200");
      expect(result).toContain("expected status 201");
    });

    it("uses the status code as the label when description is absent", () => {
      const response: ResponseIR = {
        statusCode: "204",
        description: "",
        headers: {},
        content: { "application/json": { schema: { type: "object" } } },
        links: {},
      };
      expect(generatePostResponseTests([response])).toContain('test("204"');
    });

    it("uses the first object-shaped named example", () => {
      const response: ResponseIR = {
        statusCode: "200",
        description: 'Quoted "response"',
        headers: {},
        content: {
          "application/json": {
            schema: { type: "object" },
            examples: { first: { value: { message: 'say "hello"' } } },
          },
        },
        links: {},
      };
      const result = generatePostResponseTests([response]);
      expect(result).toContain('test("200 Quoted \\"response\\""');
      expect(result).toContain("res.body.message").toContain('say \\"hello\\"');
    });

    it("returns empty string when no eligible responses", () => {
      const responses: ResponseIR[] = [];
      expect(generatePostResponseTests(responses)).toBe("");
    });

    it("handles +json content types as JSON", () => {
      const responses: ResponseIR[] = [
        {
          statusCode: "200",
          description: "OK",
          headers: {},
          content: {
            "application/vnd.api+json": {
              schema: { type: "object" },
            },
          },
          links: {},
        },
      ];

      const result = generatePostResponseTests(responses);
      expect(result).toContain("expected status 200");
    });
  });

  describe("generateAssertions", () => {
    it("generates all three tiers when data is available", () => {
      const response: ResponseIR = {
        statusCode: "200",
        description: "Success",
        headers: {},
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["id"],
            },
            example: { id: 1, name: "Test" },
          },
        },
        links: {},
      };

      const mediaType = findJsonMediaType(response);
      expect(mediaType).not.toBeNull();
      if (mediaType) {
        const assertions = generateAssertions(response, mediaType);
        expect(assertions.length).toBeGreaterThan(2); // status + required + example
      }
    });
  });

  describe("isSuccessStatus", () => {
    it("returns true for 2xx codes", () => {
      expect(isSuccessStatus("200")).toBe(true);
      expect(isSuccessStatus("201")).toBe(true);
      expect(isSuccessStatus("204")).toBe(true);
      expect(isSuccessStatus("299")).toBe(true);
    });

    it("returns false for non-2xx codes", () => {
      expect(isSuccessStatus("100")).toBe(false);
      expect(isSuccessStatus("301")).toBe(false);
      expect(isSuccessStatus("400")).toBe(false);
      expect(isSuccessStatus("404")).toBe(false);
      expect(isSuccessStatus("500")).toBe(false);
    });
  });

  describe("findJsonMediaType", () => {
    it("finds application/json", () => {
      const response: ResponseIR = {
        statusCode: "200",
        description: "",
        headers: {},
        content: {
          "application/json": { schema: { type: "object" } },
        },
        links: {},
      };
      expect(findJsonMediaType(response)).not.toBeNull();
    });

    it("returns null for non-JSON content", () => {
      const response: ResponseIR = {
        statusCode: "200",
        description: "",
        headers: {},
        content: {
          "text/plain": { schema: { type: "string" } },
        },
        links: {},
      };
      expect(findJsonMediaType(response)).toBeNull();
    });

    it("returns null when no content", () => {
      const response: ResponseIR = {
        statusCode: "200",
        description: "",
        headers: {},
        content: {},
        links: {},
      };
      expect(findJsonMediaType(response)).toBeNull();
    });
  });

  describe("getRequiredFields", () => {
    it("extracts required array from schema", () => {
      const mediaType = {
        schema: { type: "object", required: ["id", "name"] },
      };
      expect(getRequiredFields(mediaType)).toEqual(["id", "name"]);
    });

    it("returns empty array when no required fields", () => {
      const mediaType = {
        schema: { type: "object" },
      };
      expect(getRequiredFields(mediaType)).toEqual([]);
    });

    it("filters malformed required entries", () => {
      expect(
        getRequiredFields({ schema: { required: ["id", 42, null] } } as unknown as {
          schema: unknown;
        }),
      ).toEqual(["id"]);
      expect(getRequiredFields({ schema: undefined })).toEqual([]);
    });
  });

  describe("formatExpectedValue", () => {
    it("formats strings with quotes", () => {
      expect(formatExpectedValue("hello")).toBe('"hello"');
    });

    it("formats numbers without quotes", () => {
      expect(formatExpectedValue(42)).toBe("42");
    });

    it("formats booleans without quotes", () => {
      expect(formatExpectedValue(true)).toBe("true");
      expect(formatExpectedValue(false)).toBe("false");
    });

    it("formats null", () => {
      expect(formatExpectedValue(null)).toBe("null");
    });

    it("formats objects as JSON", () => {
      expect(formatExpectedValue({ a: 1 })).toBe('{"a":1}');
    });
  });
});
