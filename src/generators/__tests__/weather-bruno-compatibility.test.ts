import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bruToEnvJsonV2, bruToJsonV2, collectionBruToJson } from "@usebruno/lang";
import { parse } from "../../parsers/parse.js";
import { generate } from "../orchestrator.js";

describe("weather OpenAPI → Bruno compatibility", () => {
  let outputDir: string;

  beforeAll(async () => {
    outputDir = await mkdtemp(join(tmpdir(), "gen-bruno-weather-"));
    const ir = await parse(join(process.cwd(), "test/fixtures/weather/weather.openapi.json"));
    const result = await generate(ir, { outputDir, grouping: "flat" });
    expect(result.success).toBe(true);
  });

  afterAll(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it("is readable by Bruno's current collection, request, and environment parsers", async () => {
    const collection = collectionBruToJson(
      await readFile(join(outputDir, "collection.bru"), "utf8"),
    ) as {
      meta: { type: string; name: string };
      vars: { req: { name: string; value: string }[] };
    };
    const request = bruToJsonV2(await readFile(join(outputDir, "getweatherdata.bru"), "utf8")) as {
      http: { method: string; url: string };
      params: { name: string; value: string; type: string }[];
      vars?: { res?: unknown[] };
    };
    const environment = bruToEnvJsonV2(
      await readFile(join(outputDir, "environments", "default.bru"), "utf8"),
    ) as { variables: { name: string; value: string }[] };

    expect(collection.meta).toMatchObject({
      type: "collection",
      name: "OpenWeatherMap One Call API",
    });
    expect(collection.vars.req).toContainEqual({
      name: "baseUrl",
      value: "https://api.openweathermap.org",
      enabled: true,
      local: false,
    });
    expect(request.http).toMatchObject({
      method: "get",
      url: "{{baseUrl}}/data/2.5/weather",
    });
    expect(request.params).toEqual([
      expect.objectContaining({ name: "lat", type: "query", value: "{{lat}}" }),
      expect.objectContaining({ name: "lon", type: "query", value: "{{lon}}" }),
      expect.objectContaining({ name: "appid", type: "query", value: "{{appid}}" }),
    ]);
    expect(request.vars?.res).toBeUndefined();
    expect(environment.variables.map((variable) => variable.name)).toEqual(["lat", "lon", "appid"]);
  });
});
