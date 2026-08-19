/** Metadata required to render a native Bruno gRPC request. */
interface GrpcEndpointExtension {
  /** Fully-qualified service and method, e.g. `example.Greeter/SayHello`. */
  method: string;
  /** Bruno's gRPC request mode. */
  methodType: "unary" | "clientStreaming" | "serverStreaming" | "bidirectionalStreaming";
  /** A JSON-compatible example message for the request. */
  requestExample: Record<string, unknown>;
  /** Proto source retained so generated collections are self-contained. */
  proto: {
    fileName: string;
    content: string;
  };
}

export type { GrpcEndpointExtension };
