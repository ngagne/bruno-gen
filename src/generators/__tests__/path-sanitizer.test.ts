import { describe, it, expect } from "vitest";
import { sanitizeRequestFilename, sanitizeFolderName, sanitizeName } from "../path-sanitizer.js";
import type { EndpointIR } from "../../ir/index.js";

describe("path-sanitizer", () => {
  describe("sanitizeName", () => {
    it("replaces special characters with dashes", () => {
      expect(sanitizeName("GET /users/{id}")).toBe("get-users-id");
      expect(sanitizeName("POST /oauth/token?grant_type=client_credentials")).toBe("post-oauth-token-grant-type-client-credentials");
    });

    it("collapses multiple dasheses to single dash", () => {
      expect(sanitizeName("get---users")).toBe("get-users");
    });

    it("trims leading and trailing dashes", () => {
      expect(sanitizeName("-get-users-")).toBe("get-users");
    });

    it("lowercases the result", () => {
      expect(sanitizeName("GetUsers")).toBe("getusers");
    });

    it("handles Windows reserved words", () => {
      expect(sanitizeName("CON")).toBe("_con");
      expect(sanitizeName("PRN")).toBe("_prn");
      expect(sanitizeName("AUX")).toBe("_aux");
      expect(sanitizeName("NUL")).toBe("_nul");
    });
  });

  describe("sanitizeRequestFilename", () => {
    it("generates .bru filename from endpoint id", () => {
      const endpoint: EndpointIR = {
        id: "GetUser",
        method: "get",
        path: "/users/{id}",
        tags: [],
        deprecated: false,
        parameters: [],
        responses: [],
        consumesContentTypes: [],
      };
      expect(sanitizeRequestFilename(endpoint)).toBe("getuser.bru");
    });

    it("falls back to method-path when no id", () => {
      const endpoint: EndpointIR = {
        id: "",
        method: "get",
        path: "/users/{id}",
        tags: [],
        deprecated: false,
        parameters: [],
        responses: [],
        consumesContentTypes: [],
      };
      expect(sanitizeRequestFilename(endpoint)).toBe("get-users-id.bru");
    });

    it("handles duplicates with counter", () => {
      const endpoint: EndpointIR = {
        id: "GetUser",
        method: "get",
        path: "/users",
        tags: [],
        deprecated: false,
        parameters: [],
        responses: [],
        consumesContentTypes: [],
      };
      const usedNames = new Set<string>(["getuser.bru"]);
      expect(sanitizeRequestFilename(endpoint, usedNames)).toBe("getuser_2.bru");
    });
  });

  describe("sanitizeFolderName", () => {
    it("sanitizes tag names for directory names", () => {
      expect(sanitizeFolderName("Users API")).toBe("users-api");
      expect(sanitizeFolderName("Products")).toBe("products");
    });

    it("handles special characters in tag names", () => {
      expect(sanitizeFolderName("Users & Products")).toBe("users-products");
    });
  });
});
