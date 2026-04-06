import { describe, it, expect } from "vitest";
import {
  isInternalRef,
  isFileRef,
  isRemoteRef,
  resolveRefPath,
  extractRefName,
} from "./ref-utils.js";

describe("ref-utils", () => {
  describe("isInternalRef", () => {
    it("returns true for internal refs", () => {
      expect(isInternalRef("#/components/schemas/User")).toBe(true);
      expect(isInternalRef("#/definitions/User")).toBe(true);
    });

    it("returns false for file and remote refs", () => {
      expect(isInternalRef("./models/User.yaml")).toBe(false);
      expect(isInternalRef("https://example.com/schema")).toBe(false);
    });
  });

  describe("isFileRef", () => {
    it("returns true for relative file refs", () => {
      expect(isFileRef("./models/User.yaml")).toBe(true);
      expect(isFileRef("../common/Error.json")).toBe(true);
    });

    it("returns false for internal and remote refs", () => {
      expect(isFileRef("#/components/schemas/User")).toBe(false);
      expect(isFileRef("https://example.com/schema")).toBe(false);
    });
  });

  describe("isRemoteRef", () => {
    it("returns true for http and https refs", () => {
      expect(isRemoteRef("https://example.com/schema")).toBe(true);
      expect(isRemoteRef("http://example.com/schema")).toBe(true);
    });

    it("returns false for internal and file refs", () => {
      expect(isRemoteRef("#/components/schemas/User")).toBe(false);
      expect(isRemoteRef("./models/User.yaml")).toBe(false);
    });
  });

  describe("resolveRefPath", () => {
    it("resolves relative file refs relative to spec file", () => {
      const result = resolveRefPath("./models/User.yaml", "/project/spec.yaml");
      expect(result).toBe("/project/models/User.yaml");
    });

    it("resolves parent directory file refs", () => {
      const result = resolveRefPath("../common/Error.yaml", "/project/specs/api.yaml");
      expect(result).toBe("/project/common/Error.yaml");
    });

    it("returns null for internal refs", () => {
      const result = resolveRefPath("#/components/schemas/User", "/project/spec.yaml");
      expect(result).toBeNull();
    });

    it("returns null for remote refs", () => {
      const result = resolveRefPath("https://example.com/schema", "/project/spec.yaml");
      expect(result).toBeNull();
    });
  });

  describe("extractRefName", () => {
    it("extracts name from internal component refs", () => {
      expect(extractRefName("#/components/schemas/User")).toBe("User");
    });

    it("extracts name from internal definition refs", () => {
      expect(extractRefName("#/definitions/User")).toBe("User");
    });

    it("extracts name from file refs", () => {
      expect(extractRefName("./models/User.yaml")).toBe("User");
      expect(extractRefName("../common/Error.json")).toBe("Error");
    });

    it("returns null for unrecognizable refs", () => {
      expect(extractRefName("unknown")).toBeNull();
    });
  });
});
