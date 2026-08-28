/** The protocol used to render an endpoint request. */
type RequestTransport =
  { kind: "http" } | { kind: "graphql" } | { kind: "grpc" } | { kind: "websocket" };

export type { RequestTransport };
