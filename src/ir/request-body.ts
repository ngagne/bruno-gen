import type { MediaTypeIR } from "./response.js";

/** A request body definition for an endpoint. */
interface RequestBodyIR {
  description?: string;
  required: boolean;
  /** MIME type → media type definition (e.g. "application/json"). */
  content: Record<string, MediaTypeIR>;
}

export type { RequestBodyIR };
