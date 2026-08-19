/** A message Bruno can send after connecting to a WebSocket endpoint. */
interface WebSocketMessageIR {
  name: string;
  content: string;
  type: "json" | "text" | "xml";
  selected?: boolean;
}

/** AsyncAPI metadata used to render a native Bruno WebSocket request. */
interface WebSocketEndpointExtension {
  action: "send" | "receive";
  messages: WebSocketMessageIR[];
}

export type { WebSocketEndpointExtension, WebSocketMessageIR };
