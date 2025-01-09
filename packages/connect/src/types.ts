import type { NextFunction, Request, Response } from "express";
import type { MockRequest, MockResponse } from "node-mocks-http";

export type ConnectMiddleware = (
	req: MockRequest<Request>,
	res: MockResponse<Response>,
	next: NextFunction,
) => unknown;
