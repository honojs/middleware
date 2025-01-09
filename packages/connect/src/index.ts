import { createMiddleware } from 'hono/factory'
import { ConnectMiddleware } from './types'
import { createResponse } from "node-mocks-http";
import Connect, { HandleFunction } from "connect";
import { transformRequestToIncomingMessage, transformResponseToServerResponse } from './utils';
import { StatusCode } from 'hono/utils/http-status';
import { resolve } from 'path';

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

        const _response = transformResponseToServerResponse(response);

        if (response.writableEnded) {
          resolve(_response)
        }

        return call;
      };

      connectApp.handle(request, response, () => {
        const webResponse = transformResponseToServerResponse(response);
        webResponse.headers.forEach((value, key) => {
          c.header(key, value)
        });
        c.status(webResponse.status as StatusCode);

        resolve(undefined);
      });
    })

    if (res) {
      c.res = res
      c.finalized = true
    }

    await next()
  })
}
