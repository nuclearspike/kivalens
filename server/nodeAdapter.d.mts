/** Node request/response <-> Fetch Request/Response, for the Node hosts. */
import type { IncomingMessage, ServerResponse } from 'node:http'
export declare function toRequest(req: IncomingMessage, res: ServerResponse): Request
export declare function sendResponse(res: ServerResponse, response: Response): Promise<void>
