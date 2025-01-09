import { createMiddleware } from 'hono/factory'
import { ConnectMiddleware } from './types'
import { createResponse } from "node-mocks-http";
import Connect, { HandleFunction } from "connect";
import { transformRequestToIncomingMessage, transformResponseToServerResponse } from './utils';
import { StatusCode } from 'hono/utils/http-status';

export const connect = (...middlewares: ConnectMiddleware[]) => {
  const connectApp = Connect();

  for (const middleware of middlewares) {
    connectApp.use(middleware as HandleFunction);
  }

  return createMiddleware(async (c, next) => {
    const res = await new Promise<Response | undefined>((resolve) => {
      const request = transformRequestToIncomingMessage(c.req.raw);
      // @ts-expect-error
      request.app = connectApp

      const response = createResponse();
      const end = response.end;

      // @ts-expect-error
      response.end = (...args: Parameters<typeof response.end>) => {
        const call = end.call(response, ...args);

        const connectResponse = transformResponseToServerResponse(response);

        if (response.writableEnded) {
          resolve(connectResponse)
        }

        return call;
      };

      connectApp.handle(request, response, () => {
        const connectResponse = transformResponseToServerResponse(response);
        const preparedHeaders = (c.newResponse(null, 204, {})).headers;
        const connectHeaders = connectResponse.headers;

        for (const key of [...preparedHeaders.keys()]) {
          c.header(key, undefined);
        }

        for (const [key, value] of [...connectHeaders.entries()]) {
          c.header(key, value);
        }

        c.status(connectResponse.status as StatusCode);

        if (connectResponse.body) {
          resolve(c.body(connectResponse.body));
        } else {
          resolve(undefined);
        }
      });
    });

    if (res) {
      c.res = res;
      c.finalized = true;
    }
    console.log([...(c.newResponse(null, 204, {})).headers.entries()])

    await next();
  });
}