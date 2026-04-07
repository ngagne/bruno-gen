import { describe, it, expect } from "vitest";
import { generateFolderGroups, generateFolderBru } from "../folder-generator.js";
import type { CollectionIR } from "../../ir/index.js";

describe("folder-generator", () => {
  function makeIR(overrides: Partial<CollectionIR>): CollectionIR {
    return {
      info: { title: "Test", version: "1.0.0" },
      servers: [],
      endpoints: [],
      securitySchemes: {},
      tags: [],
      ...overrides,
    };
  }

  function makeEndpoint(overrides: Partial<CollectionIR["endpoints"][0]> = {}) {
    return {
      id: "test-endpoint",
      method: "get",
      path: "/test",
      parameters: [],
      responses: [],
      requestBody: undefined,
      security: [],
      tags: [],
      summary: "",
      description: "",
      deprecated: false,
      ...overrides,
    } as CollectionIR["endpoints"][0];
  }

  describe("tag-based grouping (default)", () => {
    it("groups endpoints by their first tag", () => {
      const ir = makeIR({
        endpoints: [
          makeEndpoint({ id: "get-users", tags: ["users"] }),
          makeEndpoint({ id: "get-pets", tags: ["pets"] }),
          makeEndpoint({ id: "create-user", tags: ["users"] }),
        ],
        tags: [{ name: "users" }, { name: "pets" }],
      });

      const groups = generateFolderGroups(ir);
      expect(groups.length).toBe(2);
      expect(groups[0].displayName).toBe("users");
      expect(groups[0].endpoints.length).toBe(2);
      expect(groups[1].displayName).toBe("pets");
      expect(groups[1].endpoints.length).toBe(1);
    });

    it("handles ungrouped endpoints", () => {
      const ir = makeIR({
        endpoints: [
          makeEndpoint({ id: "get-users", tags: ["users"] }),
          makeEndpoint({ id: "health", tags: [] }),
        ],
        tags: [{ name: "users" }],
      });

      const groups = generateFolderGroups(ir);
      const ungrouped = groups.find((g) => g.displayName === "Ungrouped");
      expect(ungrouped).toBeDefined();
      if (ungrouped) {
        expect(ungrouped.endpoints.length).toBe(1);
      }
    });

    it("generates folder.bru for each group", () => {
      const ir = makeIR({
        endpoints: [makeEndpoint({ id: "test", tags: ["api"] })],
        tags: [{ name: "api" }],
      });

      const groups = generateFolderGroups(ir);
      expect(groups[0].folderBru).toContain("meta {");
      expect(groups[0].folderBru).toContain("api");
    });
  });

  describe("path-based grouping", () => {
    it("groups endpoints by first URL path segment", () => {
      const ir = makeIR({
        endpoints: [
          makeEndpoint({ id: "get-users", path: "/users" }),
          makeEndpoint({ id: "get-user-by-id", path: "/users/123" }),
          makeEndpoint({ id: "get-pets", path: "/pets" }),
          makeEndpoint({ id: "get-pet-by-id", path: "/pets/456" }),
        ],
      });

      const groups = generateFolderGroups(ir, { format: "path" });
      expect(groups.length).toBe(2);

      const usersGroup = groups.find((g) => g.folderName === "users");
      const petsGroup = groups.find((g) => g.folderName === "pets");
      expect(usersGroup).toBeDefined();
      expect(petsGroup).toBeDefined();
      if (usersGroup && petsGroup) {
        expect(usersGroup.endpoints.length).toBe(2);
        expect(petsGroup.endpoints.length).toBe(2);
      }
    });

    it("handles root-level paths", () => {
      const ir = makeIR({
        endpoints: [makeEndpoint({ id: "root", path: "/" })],
      });

      const groups = generateFolderGroups(ir, { format: "path" });
      expect(groups.length).toBe(1);
      expect(groups[0].folderName).toBe("root");
    });
  });

  describe("flat grouping", () => {
    it("returns single group with no folder name and null folderBru", () => {
      const ir = makeIR({
        endpoints: [makeEndpoint({ id: "get-users" }), makeEndpoint({ id: "get-pets" })],
      });

      const groups = generateFolderGroups(ir, { format: "flat" });
      expect(groups.length).toBe(1);
      expect(groups[0].folderName).toBe("");
      expect(groups[0].folderBru).toBeNull();
      expect(groups[0].endpoints.length).toBe(2);
    });
  });

  describe("generateFolderBru", () => {
    it("generates meta block with name and sequence", () => {
      const result = generateFolderBru("My API", 3);
      expect(result).toContain("meta {");
      expect(result).toContain('"My API"');
      expect(result).toContain("seq: 3");
    });
  });
});
