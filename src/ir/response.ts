import type { SchemaIR } from "./schema.js";

/** A named example with optional metadata. */
interface ExampleObject {
  summary?: string;
  description?: string;
  value: unknown;
  externalValue?: string;
}

/** A link to a related operation. */
interface LinkObject {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, string>;
  requestBody?: string;
  description?: string;
}

/** Encoding hints for multipart request/response bodies. */
interface EncodingObject {
  contentType?: string;
  headers?: Record<string, HeaderIR>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

/** A header defined on a response. */
interface HeaderIR {
  description?: string;
  required: boolean;
  schema: SchemaIR;
}

/** A single response from an endpoint. */
interface ResponseIR {
  /** HTTP status code: "200", "4XX", "default", etc. */
  statusCode: string;
  description: string;
  headers: Record<string, HeaderIR>;
  /** MIME type → media type definition. */
  content: Record<string, MediaTypeIR>;
  /** Links to related operations. */
  links?: Record<string, LinkObject>;
}

/** A media type within a response (or request body). */
interface MediaTypeIR {
  schema: SchemaIR;
  /** A single example value. */
  example?: unknown;
  /** Multiple named examples. */
  examples?: Record<string, ExampleObject>;
  /** Encoding hints for multipart/form-data. */
  encoding?: Record<string, EncodingObject>;
}

export type { ResponseIR, MediaTypeIR, HeaderIR, ExampleObject, LinkObject, EncodingObject };
