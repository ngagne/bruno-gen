import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSchema, parse as parseGraphQL, validate as validateGraphQLDocument } from "graphql";
import { bruToJsonV2, collectionBruToJson } from "@usebruno/lang";
import { parse } from "../../parsers/parse.js";
import { generate } from "../orchestrator.js";

describe("GraphQL schema → Bruno compatibility", () => {
  let outputDir: string;

  beforeAll(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "gen-bruno-graphql-"));
    const ir = await parse(join(process.cwd(), "test/fixtures/graphql/social.schema.graphql"));
    const result = await generate(ir, { outputDir, grouping: "flat" });
    expect(result.success).toBe(true);
  });

  afterAll(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it("generates a Bruno-readable collection containing executable GraphQL operations", async () => {
    const collection = collectionBruToJson(
      await readFile(join(outputDir, "collection.bru"), "utf8"),
    ) as { vars: { req: { name: string; value: string }[] } };
    const userRequest = bruToJsonV2(await readFile(join(outputDir, "user.bru"), "utf8")) as {
      http: { method: string; url: string; body: string };
      body: { graphql: { query: string; variables: string } };
    };
    const createUserRequest = bruToJsonV2(
      await readFile(join(outputDir, "createuser.bru"), "utf8"),
    ) as { body: { graphql: { query: string; variables: string } } };

    expect(collection.vars.req).toContainEqual(
      expect.objectContaining({ name: "baseUrl", value: "http://localhost:4000" }),
    );
    expect(userRequest.http).toMatchObject({
      method: "post",
      url: "{{baseUrl}}/graphql",
      body: "graphql",
    });
    const schema = buildSchema(
      await readFile(join(process.cwd(), "test/fixtures/graphql/social.schema.graphql"), "utf8"),
    );
    const userDocument = parseGraphQL(userRequest.body.graphql.query);
    expect(validateGraphQLDocument(schema, userDocument)).toEqual([]);
    expect(userRequest.body.graphql.query).toContain("query user($id: ID!)");
    expect(userRequest.body.graphql.query).toContain("organization { id name }");
    expect(JSON.parse(userRequest.body.graphql.variables)).toHaveProperty("id");
    expect(createUserRequest.body.graphql.query).toContain(
      "mutation createUser($input: CreateUserInput!)",
    );
    expect(JSON.parse(createUserRequest.body.graphql.variables)).toHaveProperty("input");
  });
});
