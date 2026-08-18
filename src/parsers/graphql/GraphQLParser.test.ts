import { describe, it, expect } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GraphQLParser } from "./GraphQLParser.js";

describe("GraphQLParser", () => {
  const parser = new GraphQLParser();

  describe("canParse", () => {
    it("recognizes GraphQL file extensions and SDL variants", () => {
      expect(parser.canParse({ _filePath: "schema.GQL" })).toBe(true);
      expect(
        parser.canParse({ _filePath: "schema.txt", _raw: "input Search { term: String }" }),
      ).toBe(true);
      expect(parser.canParse({ _filePath: "schema.txt" })).toBe(false);
    });

    it("returns true for GraphQL SDL content", () => {
      expect(parser.canParse({ _raw: "type Query { users: [User] }" })).toBe(true);
    });

    it("returns false for non-GraphQL content", () => {
      expect(parser.canParse({ openapi: "3.0.0" })).toBe(false);
    });
  });

  describe("parse", () => {
    it("loads and validates SDL from a file and reports invalid SDL", async () => {
      const dir = await mkdtemp(join(tmpdir(), "gen-bruno-graphql-"));
      const file = join(dir, "schema.graphql");
      await writeFile(file, "type Query { ping: String! }");
      await expect(parser.parse({ filePath: file })).resolves.toMatchObject({
        endpoints: [expect.objectContaining({ id: "ping" })],
      });
      await expect(parser.validate({ filePath: file })).resolves.toMatchObject({ valid: true });
      await rm(dir, { recursive: true, force: true });
      await expect(parser.parse({ content: "type Query {" })).rejects.toThrow(
        "Failed to parse GraphQL SDL",
      );
    });

    it("parses a minimal GraphQL SDL", async () => {
      const sdl = `
        type User {
          id: ID!
          name: String!
          email: String
        }

        type Query {
          users: [User]
          user(id: ID!): User
        }
      `;

      const ir = await parser.parse({ content: sdl });

      expect(ir.info.title).toBe("GraphQL API");
      expect(ir.servers).toHaveLength(1);
      expect(ir.servers[0].url).toBe("/graphql");
      expect(ir.endpoints).toHaveLength(2);
      expect(ir.endpoints[0].id).toBe("users");
      expect(ir.endpoints[0].method).toBe("post");
      expect(ir.endpoints[0].path).toBe("/graphql");
      expect(ir.endpoints[0].tags).toContain("query");
    });

    it("parses mutations", async () => {
      const sdl = `
        input CreateUserInput {
          name: String!
          email: String!
        }

        type User {
          id: ID!
          name: String!
        }

        type Query {
          users: [User]
        }

        type Mutation {
          createUser(input: CreateUserInput!): User!
        }
      `;

      const ir = await parser.parse({ content: sdl });
      const mutationEndpoint = ir.endpoints.find((e) => e.tags.includes("mutation"));

      expect(mutationEndpoint).toBeDefined();
      expect(mutationEndpoint?.id).toBe("createUser");
      expect(mutationEndpoint?.requestBody).toBeDefined();
    });

    it("maps custom scalars", async () => {
      const sdl = `
        scalar DateTime

        type Post {
          createdAt: DateTime!
        }

        type Query {
          posts: [Post]
        }
      `;

      const ir = await parser.parse({ content: sdl });
      expect(ir.components.schemas).toHaveProperty("Post");
      expect(ir.components.schemas.Post.properties?.createdAt.type).toBe("string");
      expect(ir.components.schemas.Post.properties?.createdAt.format).toBe(
        "custom-scalar-datetime",
      );
    });

    it("maps enum types", async () => {
      const sdl = `
        enum Role {
          ADMIN
          USER
          GUEST
        }

        type Query {
          roles: [Role]
        }
      `;

      const ir = await parser.parse({ content: sdl });
      expect(ir.components.schemas).toHaveProperty("Role");
      expect(ir.components.schemas.Role.type).toBe("string");
      expect(ir.components.schemas.Role.enum).toEqual(["ADMIN", "USER", "GUEST"]);
    });
  });
});
