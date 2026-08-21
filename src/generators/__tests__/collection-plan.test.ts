import { describe, expect, it } from "vitest";
import type { CollectionIR } from "../../ir/index.js";
import { planCollection } from "../collection-plan.js";

describe("planCollection", () => {
  it("is the complete source of truth for generated files and warnings", () => {
    const ir: CollectionIR = {
      info: { title: "Plan API", version: "1" },
      servers: [{ url: "https://api.example.test", variables: {} }],
      securitySchemes: {},
      defaultSecurity: [],
      tags: [{ name: "Users" }],
      endpoints: [
        {
          id: "listUsers",
          method: "get",
          path: "/users",
          tags: ["Users"],
          deprecated: true,
          parameters: [],
          responses: [],
          consumesContentTypes: [],
        },
      ],
      components: { schemas: {}, parameters: {}, responses: {}, requestBodies: {} },
      extensions: {},
    };

    const plan = planCollection(ir, { grouping: "tag" });

    expect(plan.files.map((file) => file.relativePath)).toEqual([
      "bruno.json",
      "collection.bru",
      "users/folder.bru",
      "users/listusers.bru",
    ]);
    expect(plan.files.find((file) => file.kind === "request")?.endpoint).toBe(ir.endpoints[0]);
    expect(plan.warnings).toEqual(["Endpoint listUsers is deprecated"]);
  });

  it("only plans an environment when it contains values", () => {
    const ir: CollectionIR = {
      info: { title: "No Environment", version: "1" },
      servers: [{ url: "https://api.example.test", variables: {} }],
      securitySchemes: {},
      defaultSecurity: [],
      tags: [],
      endpoints: [],
      components: { schemas: {}, parameters: {}, responses: {}, requestBodies: {} },
      extensions: {},
    };

    expect(planCollection(ir).files.map((file) => file.relativePath)).not.toContain(
      "environments/default.bru",
    );
  });

  it("uses the shared environment renderer for auth, server, and required parameter values", () => {
    const ir: CollectionIR = {
      info: { title: "Environment", version: "1" },
      servers: [{ url: "https://{region}.example.test", variables: { region: { default: "us" } } }],
      securitySchemes: { token: { type: "http", scheme: "bearer" } },
      defaultSecurity: [],
      tags: [],
      endpoints: [
        {
          id: "getUser",
          method: "get",
          path: "/users/{id}",
          tags: [],
          deprecated: false,
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "integer", default: 42 } },
          ],
          responses: [],
          consumesContentTypes: [],
        },
      ],
      components: { schemas: {}, parameters: {}, responses: {}, requestBodies: {} },
      extensions: {},
    };

    const environment = planCollection(ir).files.find((file) => file.kind === "environment");
    expect(environment?.content).toContain("tokenToken: your-bearer-token-here");
    expect(environment?.content).toContain("region: us");
    expect(environment?.content).toContain("id: 42");
    expect(environment?.content).not.toContain("baseUrl:");
  });
});
