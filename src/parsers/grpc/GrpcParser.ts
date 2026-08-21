import protobuf from "protobufjs";
import type { Service, Type } from "protobufjs";
import path from "node:path";
import { readFileSync } from "node:fs";
import type { CollectionIR, EndpointIR, GrpcEndpointExtension } from "../../ir/index.js";
import type { SpecInput } from "../types.js";
import type { ValidationResult } from "../../ir/validation.js";

/** Parse Protocol Buffer service definitions into native Bruno gRPC requests. */
export class GrpcParser {
  canParse(data: Record<string, unknown>): boolean {
    const content = typeof data === "string" ? data : data._raw;
    return typeof content === "string" && /\bservice\s+\w+\s*\{/.test(content);
  }

  async parse(input: SpecInput): Promise<CollectionIR> {
    const { content, fileName } = this.load(input);
    let parsed: ReturnType<typeof protobuf.parse>;
    try {
      parsed = protobuf.parse(content, { keepCase: false, alternateCommentMode: true });
      parsed.root.resolveAll();
    } catch (error) {
      throw new Error(
        `Failed to parse Protocol Buffer spec: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const packageName = parsed.package;
    const endpoints: EndpointIR[] = [];
    for (const service of findServices(parsed.root)) {
      for (const method of service.methodsArray) {
        const requestType = method.resolvedRequestType;
        const grpc: GrpcEndpointExtension = {
          method: `${service.fullName.replace(/^\./, "")}/${method.name}`,
          methodType: getMethodType(method.requestStream === true, method.responseStream === true),
          requestExample: requestType ? createExample(requestType) : {},
          proto: { fileName, content },
        };
        endpoints.push({
          id: `${service.name}.${method.name}`,
          // Retain the existing required HTTP method field for backwards-compatible IR consumers.
          method: "post",
          path: `/${service.name}/${method.name}`,
          summary: method.comment ?? undefined,
          tags: [service.name],
          deprecated: false,
          parameters: [],
          responses: [],
          consumesContentTypes: [],
          transport: { kind: "grpc" },
          grpc,
        });
      }
    }
    if (endpoints.length === 0)
      throw new Error("Protocol Buffer spec contains no gRPC service methods.");

    return {
      info: { title: packageName ? `${packageName} gRPC API` : "gRPC API", version: "1.0.0" },
      servers: [{ url: "http://localhost:50051", description: "gRPC server", variables: {} }],
      securitySchemes: {},
      defaultSecurity: [],
      tags: [...new Set(endpoints.map((endpoint) => endpoint.tags[0]))].map((name) => ({ name })),
      endpoints,
      components: { schemas: {}, parameters: {}, responses: {}, requestBodies: {} },
      extensions: { grpc: true },
    };
  }

  async validate(input: SpecInput): Promise<ValidationResult> {
    const source = "filePath" in input ? input.filePath : "inline";
    try {
      const { content } = this.load(input);
      const result = protobuf.parse(content);
      if (findServices(result.root).length === 0)
        throw new Error("Protocol Buffer spec contains no gRPC service methods.");
      return { valid: true, errors: [], warnings: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            file: source,
            message: error instanceof Error ? error.message : String(error),
            code: "GRPC_PARSE_ERROR",
          },
        ],
        warnings: [],
      };
    }
  }

  private load(input: SpecInput): { content: string; fileName: string } {
    return "filePath" in input
      ? { content: readFileSync(input.filePath, "utf8"), fileName: path.basename(input.filePath) }
      : { content: input.content, fileName: "service.proto" };
  }
}

function findServices(namespace: { nestedArray?: unknown[] }): Service[] {
  const services: Service[] = [];
  for (const nested of namespace.nestedArray ?? []) {
    if (nested instanceof protobuf.Service) services.push(nested);
    if (nested && typeof nested === "object" && "nestedArray" in nested)
      services.push(...findServices(nested as { nestedArray?: unknown[] }));
  }
  return services;
}

function getMethodType(
  requestStream: boolean,
  responseStream: boolean,
): GrpcEndpointExtension["methodType"] {
  if (requestStream && responseStream) return "bidirectionalStreaming";
  if (requestStream) return "clientStreaming";
  if (responseStream) return "serverStreaming";
  return "unary";
}

function createExample(type: Type, seen = new Set<Type>()): Record<string, unknown> {
  if (seen.has(type)) return {};
  seen.add(type);
  const example: Record<string, unknown> = {};
  for (const field of type.fieldsArray) {
    const value =
      field.resolvedType instanceof protobuf.Type
        ? createExample(field.resolvedType, seen)
        : sampleScalar(field.type);
    example[field.name] = field.repeated ? [value] : value;
  }
  seen.delete(type);
  return example;
}

function sampleScalar(type: string): unknown {
  if (/^(double|float)$/.test(type)) return 0;
  if (/^(int|uint|sint|fixed|sfixed)\d*$/.test(type)) return 0;
  if (type === "bool") return false;
  if (type === "bytes") return "";
  return "";
}
