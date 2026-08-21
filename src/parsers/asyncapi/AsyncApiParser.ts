import yaml from "js-yaml";
import type { CollectionIR, EndpointIR, WebSocketMessageIR } from "../../ir/index.js";
import type { SpecInput } from "../types.js";
import type { ValidationResult } from "../../ir/validation.js";
import { loadSpec } from "../utils/spec-loader.js";

type UnknownObj = Record<string, unknown>;

/** Parse AsyncAPI 2.x and 3.x documents with WebSocket servers into Bruno requests. */
export class AsyncApiParser {
  canParse(data: UnknownObj): boolean {
    return typeof data.asyncapi === "string" && /^(2|3)\./.test(data.asyncapi);
  }

  async parse(input: SpecInput): Promise<CollectionIR> {
    const { data } = this.load(input);
    const validation = validateDocument(data, "inline");
    if (!validation.valid) throw new Error(validation.errors[0].message);

    const servers = mapWebSocketServers(data);
    const version = data.asyncapi as string;
    const endpoints = version.startsWith("3.") ? mapV3Endpoints(data) : mapV2Endpoints(data);
    if (endpoints.length === 0) {
      throw new Error("AsyncAPI spec contains no WebSocket operations.");
    }

    return {
      info: mapInfo(data.info),
      servers,
      securitySchemes: {},
      defaultSecurity: [],
      tags: [...new Set(endpoints.flatMap((endpoint) => endpoint.tags))].map((name) => ({ name })),
      endpoints,
      components: { schemas: {}, parameters: {}, responses: {}, requestBodies: {} },
      extensions: { asyncapi: data.asyncapi, websocket: true },
    };
  }

  async validate(input: SpecInput): Promise<ValidationResult> {
    const source = "filePath" in input ? input.filePath : "inline";
    try {
      const { data } = this.load(input);
      return validateDocument(data, source);
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            file: source,
            message: error instanceof Error ? error.message : String(error),
            code: "ASYNCAPI_PARSE_ERROR",
          },
        ],
        warnings: [],
      };
    }
  }

  private load(input: SpecInput): { data: UnknownObj; source: string } {
    if ("filePath" in input) return loadSpec(input.filePath);
    if (typeof input.content === "object")
      return { data: input.content as unknown as UnknownObj, source: "inline" };
    try {
      return { data: JSON.parse(input.content) as UnknownObj, source: "inline" };
    } catch {
      const data = yaml.load(input.content);
      if (!isObject(data))
        throw new Error("Invalid AsyncAPI document: expected a JSON/YAML object.");
      return { data, source: "inline" };
    }
  }
}

function validateDocument(data: UnknownObj, source: string): ValidationResult {
  const errors: ValidationResult["errors"] = [];
  if (typeof data.asyncapi !== "string" || !/^(2|3)\./.test(data.asyncapi)) {
    errors.push({
      file: source,
      message: "Not an AsyncAPI 2.x or 3.x spec.",
      code: "ASYNCAPI_VERSION",
    });
  }
  if (
    !isObject(data.info) ||
    typeof data.info.title !== "string" ||
    typeof data.info.version !== "string"
  ) {
    errors.push({
      file: source,
      message: "AsyncAPI info.title and info.version are required.",
      code: "ASYNCAPI_INFO",
    });
  }
  if (mapWebSocketServers(data).length === 0) {
    errors.push({
      file: source,
      message: "AsyncAPI spec contains no ws or wss servers.",
      code: "ASYNCAPI_WEBSOCKET_SERVER",
    });
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

function mapInfo(info: unknown): CollectionIR["info"] {
  const value = info as UnknownObj;
  return {
    title: value.title as string,
    version: value.version as string,
    description: typeof value.description === "string" ? value.description : undefined,
  };
}

function mapWebSocketServers(data: UnknownObj): CollectionIR["servers"] {
  if (!isObject(data.servers)) return [];
  return Object.values(data.servers)
    .filter(isObject)
    .filter((server) => server.protocol === "ws" || server.protocol === "wss")
    .map((server) => ({
      url: makeServerUrl(server),
      description: typeof server.description === "string" ? server.description : undefined,
      variables: mapServerVariables(server.variables),
    }));
}

function makeServerUrl(server: UnknownObj): string {
  const protocol = server.protocol as "ws" | "wss";
  const rawUrl = typeof server.url === "string" ? server.url : undefined;
  if (rawUrl)
    return rawUrl.startsWith("ws:") || rawUrl.startsWith("wss:")
      ? rawUrl
      : `${protocol}://${rawUrl}`;
  const host = typeof server.host === "string" ? server.host : "localhost";
  const pathname = typeof server.pathname === "string" ? server.pathname : "";
  return `${protocol}://${host}${pathname.startsWith("/") || !pathname ? pathname : `/${pathname}`}`;
}

function mapServerVariables(
  value: unknown,
): Record<string, { default: string; enum?: string[]; description?: string }> {
  if (!isObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([name, variable]) => {
      if (!isObject(variable)) return [];
      return [
        [
          name,
          {
            default: String(variable.default ?? ""),
            enum: Array.isArray(variable.enum) ? variable.enum.map(String) : undefined,
            description:
              typeof variable.description === "string" ? variable.description : undefined,
          },
        ],
      ];
    }),
  );
}

function mapV3Endpoints(data: UnknownObj): EndpointIR[] {
  const channels = isObject(data.channels) ? data.channels : {};
  if (!isObject(data.operations)) return [];
  return Object.entries(data.operations).flatMap(([id, operation]) => {
    if (!isObject(operation) || (operation.action !== "send" && operation.action !== "receive"))
      return [];
    const channel = resolveChannel(operation.channel, channels);
    if (!channel) return [];
    return [toEndpoint(id, operation, channel, data)];
  });
}

function mapV2Endpoints(data: UnknownObj): EndpointIR[] {
  if (!isObject(data.channels)) return [];
  return Object.entries(data.channels).flatMap(([address, channel]) => {
    if (!isObject(channel)) return [];
    return (["publish", "subscribe"] as const).flatMap((kind) => {
      const operation = channel[kind];
      if (!isObject(operation)) return [];
      return [
        toEndpoint(
          (operation.operationId as string | undefined) ?? `${kind}-${address}`,
          operation,
          channel,
          data,
          kind === "publish" ? "send" : "receive",
        ),
      ];
    });
  });
}

function resolveChannel(value: unknown, channels: UnknownObj): UnknownObj | undefined {
  if (!isObject(value)) return undefined;
  if (typeof value.$ref === "string") {
    const name = value.$ref.replace("#/channels/", "");
    return isObject(channels[name]) ? channels[name] : undefined;
  }
  return value;
}

function toEndpoint(
  id: string,
  operation: UnknownObj,
  channel: UnknownObj,
  document: UnknownObj,
  action = operation.action as "send" | "receive",
): EndpointIR {
  const messages =
    action === "send"
      ? resolveMessages(operation.messages ?? operation.message, channel, document)
      : [];
  const address = typeof channel.address === "string" ? channel.address : "";
  const tags = mapTags(operation.tags);
  return {
    id,
    method: "get",
    path: "",
    summary: typeof operation.summary === "string" ? operation.summary : undefined,
    description: typeof operation.description === "string" ? operation.description : undefined,
    tags: tags.length > 0 ? tags : [address || "websocket"],
    deprecated: operation.deprecated === true,
    parameters: [],
    responses: [],
    consumesContentTypes: [],
    transport: { kind: "websocket" },
    websocket: { action, messages },
    extensions: { asyncapiChannel: address },
  };
}

function mapTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((tag) => {
    if (typeof tag === "string") return [tag];
    return isObject(tag) && typeof tag.name === "string" ? [tag.name] : [];
  });
}

function resolveMessages(
  value: unknown,
  channel: UnknownObj,
  document: UnknownObj,
): WebSocketMessageIR[] {
  const entries = Array.isArray(value)
    ? value
    : value
      ? [value]
      : Object.values(channel.messages ?? {});
  return entries
    .filter(isObject)
    .map((message, index) => mapMessage(resolveRef(message, document), index));
}

function resolveRef(value: UnknownObj, document: UnknownObj): UnknownObj {
  if (typeof value.$ref !== "string") return value;
  const segments = value.$ref.replace(/^#\//, "").split("/");
  let resolved: unknown = document;
  for (const segment of segments) resolved = isObject(resolved) ? resolved[segment] : undefined;
  return isObject(resolved) ? resolved : value;
}

function mapMessage(message: UnknownObj, index: number): WebSocketMessageIR {
  const contentType =
    typeof message.contentType === "string" ? message.contentType : "application/json";
  const example =
    Array.isArray(message.examples) && isObject(message.examples[0])
      ? message.examples[0].payload
      : undefined;
  const payload = example ?? exampleFromSchema(message.payload);
  return {
    name:
      typeof message.name === "string"
        ? message.name
        : typeof message.title === "string"
          ? message.title
          : `message ${index + 1}`,
    type: contentType.includes("xml")
      ? "xml"
      : contentType.includes("json") || isObject(payload)
        ? "json"
        : "text",
    content: typeof payload === "string" ? payload : JSON.stringify(payload ?? {}, null, 2),
    selected: index === 0,
  };
}

function exampleFromSchema(schema: unknown): unknown {
  if (!isObject(schema)) return {};
  if ("example" in schema) return schema.example;
  if ("default" in schema) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  if (schema.type === "array") return [exampleFromSchema(schema.items)];
  if (schema.type === "object" || isObject(schema.properties)) {
    return Object.fromEntries(
      Object.entries(isObject(schema.properties) ? schema.properties : {}).map(([name, value]) => [
        name,
        exampleFromSchema(value),
      ]),
    );
  }
  if (schema.type === "boolean") return false;
  if (schema.type === "integer" || schema.type === "number") return 0;
  return "";
}

function isObject(value: unknown): value is UnknownObj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
