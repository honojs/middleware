import type { ServerResponse } from "node:http";
import {
	type MockResponse,
	type RequestOptions,
	createRequest,
    RequestMethod,
} from "node-mocks-http";

export function transformRequestToIncomingMessage(
	request: Request,
	options?: RequestOptions,
) {
	const parsedURL = new URL(request.url, "http://localhost");

	const query: Record<string, unknown> = {};
	for (const [key, value] of parsedURL.searchParams.entries()) {
		query[key] = value;
	}

	const message = createRequest({
		method: request.method.toUpperCase() as RequestMethod,
		url: parsedURL.pathname,
		headers: Object.fromEntries(request.headers.entries()),
		query,
        ...(request.body && {
            body: request.body
        }),
		...options,
	});

	return message;
}

export function transformResponseToServerResponse(
	serverResponse: MockResponse<ServerResponse>,
) {
	return new Response(
		serverResponse._getData() || serverResponse._getBuffer(),
		{
			status: serverResponse.statusCode,
			statusText: serverResponse.statusMessage,
			headers: serverResponse.getHeaders() as HeadersInit,
		},
	);
}
