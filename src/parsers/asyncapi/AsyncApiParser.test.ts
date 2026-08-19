import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { AsyncApiParser } from "./AsyncApiParser.js";

const fixture = join(process.cwd(), "test/fixtures/asyncapi/chat-websocket.yaml");

describe("AsyncApiParser", () => {
  it("identifies supported AsyncAPI versions", () => {
    const parser = new AsyncApiParser();
    expect(parser.canParse({ asyncapi: "2.6.0" })).toBe(true);
    expect(parser.canParse({ asyncapi: "3.0.0" })).toBe(true);
    expect(parser.canParse({ asyncapi: "1.2.0" })).toBe(false);
    expect(parser.canParse({})).toBe(false);
  });

  it("maps AsyncAPI 3 WebSocket send and receive operations", async () => {
    const ir = await new AsyncApiParser().parse({ filePath: fixture });

    expect(ir.info).toMatchObject({ title: "Chat WebSocket API", version: "1.0.0" });
    expect(ir.servers).toEqual([expect.objectContaining({ url: "wss://chat.example.com/socket" })]);
    expect(ir.endpoints).toHaveLength(2);
    expect(ir.endpoints[0].websocket).toEqual({
      action: "send",
      messages: [
        expect.objectContaining({
          name: "chat message",
          type: "json",
          content: expect.stringContaining('"room": "general"'),
          selected: true,
        }),
      ],
    });
    expect(ir.endpoints[1].websocket).toEqual({ action: "receive", messages: [] });
  });

  it("maps AsyncAPI 2 publish and subscribe operations without changing their semantics", async () => {
    const ir = await new AsyncApiParser().parse({
      content: `asyncapi: 2.6.0
info: { title: Legacy Socket, version: '1' }
servers:
  local: { url: localhost:8080/socket, protocol: ws }
channels:
  notifications:
    publish:
      operationId: publishNotification
      message:
        name: notification
        payload: { type: object, properties: { message: { type: string, example: hello } } }
    subscribe:
      operationId: subscribeNotification
      message:
        name: notification
        payload: { type: object }
`,
    });

    expect(ir.servers[0].url).toBe("ws://localhost:8080/socket");
    expect(ir.endpoints.map((endpoint) => endpoint.websocket)).toEqual([
      expect.objectContaining({ action: "send", messages: [expect.anything()] }),
      { action: "receive", messages: [] },
    ]);
  });

  it("validates required metadata and a WebSocket server", async () => {
    const parser = new AsyncApiParser();
    await expect(
      parser.validate({
        content: "asyncapi: 3.0.0\ninfo: { title: Missing Server, version: '1' }\nservers: {}",
      }),
    ).resolves.toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "ASYNCAPI_WEBSOCKET_SERVER" }),
      ]),
    });
  });

  it("supports inline JSON, server variables, and text messages", async () => {
    const ir = await new AsyncApiParser().parse({
      content: JSON.stringify({
        asyncapi: "3.1.0",
        info: { title: "Inline Socket", version: "1" },
        servers: {
          secure: {
            url: "wss://socket.example.com/events",
            protocol: "wss",
            variables: { tenant: { default: "acme", enum: ["acme", "globex"] } },
          },
          ignored: { host: "example.com", protocol: "mqtt" },
        },
        channels: { events: { address: "events" } },
        operations: {
          sendText: {
            action: "send",
            channel: { $ref: "#/channels/events" },
            message: { name: "notice", contentType: "text/plain", payload: { default: "hello" } },
            tags: ["notifications"],
          },
          ignored: { action: "reply" },
        },
      }),
    });

    expect(ir.servers).toEqual([
      expect.objectContaining({
        url: "wss://socket.example.com/events",
        variables: { tenant: { default: "acme", enum: ["acme", "globex"] } },
      }),
    ]);
    expect(ir.endpoints[0].websocket?.messages).toEqual([
      { name: "notice", type: "text", content: "hello", selected: true },
    ]);
    expect(ir.endpoints[0].tags).toEqual(["notifications"]);
  });

  it("uses channel messages and schema examples when an operation omits its message list", async () => {
    const ir = await new AsyncApiParser().parse({
      content: `asyncapi: 3.0.0
info: { title: Encodings, version: '1' }
servers:
  local: { host: localhost:3000, pathname: events, protocol: ws, description: local socket }
channels: {}
operations:
  sendMessages:
    action: send
    channel:
      address: direct
      messages:
        XML:
          title: XML message
          contentType: application/xml
          payload: { type: string, enum: ["<ping />"] }
        Binary:
          payload: { type: array, items: { type: integer } }
        Boolean:
          payload: { type: boolean }
`,
    });

    expect(ir.servers[0]).toMatchObject({
      url: "ws://localhost:3000/events",
      description: "local socket",
    });
    expect(ir.endpoints[0]).toMatchObject({ tags: ["direct"] });
    expect(ir.endpoints[0].websocket?.messages).toEqual([
      { name: "XML message", type: "xml", content: "<ping />", selected: true },
      { name: "message 2", type: "json", content: "[\n  0\n]", selected: false },
      { name: "message 3", type: "json", content: "false", selected: false },
    ]);
  });

  it("reports malformed inline documents as AsyncAPI parse errors", async () => {
    await expect(new AsyncApiParser().validate({ content: "just text" })).resolves.toMatchObject({
      valid: false,
      errors: [expect.objectContaining({ code: "ASYNCAPI_PARSE_ERROR" })],
    });
  });
});
