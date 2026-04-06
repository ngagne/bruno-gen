import type { SchemaIR } from "./schema.js";
import type { ExampleObject } from "./response.js";

/** Where a parameter appears in the request. */
type ParameterLocation = "path" | "query" | "header" | "cookie";

/** A single parameter on an endpoint (path param, query string, header, cookie). */
interface ParameterIR {
  name: string;
  in: ParameterLocation;
  required: boolean;
  description?: string;
  deprecated: boolean;
  schema: SchemaIR;
  /** A single example value. */
  example?: unknown;
  /** Multiple named examples. */
  examples?: Record<string, ExampleObject>;
}

export type { ParameterIR, ParameterLocation };
