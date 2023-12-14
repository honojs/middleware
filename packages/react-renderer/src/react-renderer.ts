import type { Context } from 'hono'
import type { Env, MiddlewareHandler } from 'hono/types'
import React from 'react'
import { renderToString, renderToReadableStream } from 'react-dom/server'

export type Props = {}

type RendererOptions = {
  docType?: boolean | string
  stream?: boolean | Record<string, string>
}

type BaseProps = {
  c: Context
  children: React.ReactElement
}

const RequestContext = React.createContext<Context | null>(null)

const createRenderer =
  (c: Context, component?: React.FC<Props & BaseProps>, options?: RendererOptions) =>
  async (children: React.ReactElement, props?: Props) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const node = component ? component({ children, c, ...props }) : children

    if (options?.stream) {
      const stream = await renderToReadableStream(
        React.createElement(RequestContext.Provider, { value: c }, node)
      )
      return c.body(stream, {
        headers:
          options.stream === true
            ? {
                'Transfer-Encoding': 'chunked',
                'Content-Type': 'text/html; charset=UTF-8',
              }
            : options.stream,
      })
    } else {
      const docType =
        typeof options?.docType === 'string'
          ? options.docType
          : options?.docType === true
          ? '<!DOCTYPE html>'
          : ''
      const body =
        docType + renderToString(React.createElement(RequestContext.Provider, { value: c }, node))
      return c.html(body)
    }
  }

export const reactRenderer = (
  component?: React.FC<Props & BaseProps>,
  options?: RendererOptions
): MiddlewareHandler =>
  function reactRenderer(c, next) {
    c.setRenderer(createRenderer(c, component, options))
    return next()
  }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useRequestContext = <E extends Env = any>(): Context<E> => {
  const c = React.useContext(RequestContext)
  if (!c) {
    throw new Error('RequestContext is not provided.')
  }
  return c
}
