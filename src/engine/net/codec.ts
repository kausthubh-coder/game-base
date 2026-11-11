// How a message becomes bytes on the wire, behind one small interface. Today it is JSON text. A binary
// codec that sends only what changed comes later and fits the same three functions.
import { readClientMessage, readServerMessage, type ClientMessage, type ServerMessage } from './messages.ts';

export type Wire = string | ArrayBuffer;

export interface Codec {
  encode(message: ClientMessage | ServerMessage): Wire;
  /** What a browser sent, checked. Null when it is not a message. */
  decodeClient(data: Wire): ClientMessage | null;
  /** What the server sent. Null when it is not a message. */
  decodeServer(data: Wire): ServerMessage | null;
}

function parse(data: Wire): unknown {
  if (typeof data !== 'string') return null;
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}

export const jsonCodec: Codec = {
  encode: (message) => JSON.stringify(message),
  decodeClient: (data) => readClientMessage(parse(data)),
  decodeServer: (data) => readServerMessage(parse(data)),
};
