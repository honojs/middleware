import type { Context } from 'hono'
import type { Env, MiddlewareHandler } from 'hono/types'
import React from 'react'
import { renderToString, type RenderToReadableStreamOptions } from 'react-dom/server'
import type { Props } from '.'

type RendererOptions = {
  docType?: boolean | string
  stream?: boolean | Record<string, string>
  readableStreamOptions?: RenderToReadableStreamOptions
}

type BaseProps = {
  c: Context
  children: React.ReactElement
}

type ComponentProps = Props &
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  BaseProps & { Layout: React.FC<Record<string, any> & { children: React.ReactElement }> }

const RequestContext = React.createContext<Context | null>(null)

const createRenderer =
  (
    c: Context,
    Layout: React.FC<{ children: React.ReactElement }>,
    component?: React.FC<ComponentProps>,
    options?: RendererOptions
  ) =>
  async (children: React.ReactElement, props?: Props) => {
    const node = component ? component({ children, Layout, c, ...props }) : children

    if (options?.stream) {
      const { renderToReadableStream } = await import('react-dom/server')
      const stream = await renderToReadableStream(
        React.createElement(RequestContext.Provider, { value: c }, node),
        options.readableStreamOptions
      )
      if (options.stream === true) {
        c.header('Transfer-Encoding', 'chunked')
        c.header('Content-Type', 'text/html; charset=UTF-8')
      } else {
        for (const [key, value] of Object.entries(options.stream)) {
          c.header(key, value)
        }
      }
      return c.body(stream)
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
  component?: React.FC<ComponentProps>,
  options?: RendererOptions
): MiddlewareHandler =>
  function reactRenderer(c, next) {
    const Layout = (c.getLayout() ?? React.Fragment) as React.FC<{
      children: React.ReactElement
    }>
    if (component) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      c.setLayout((props: any) => {
        return component({ ...props, Layout, c }, c)
      })
    }
    c.setRenderer(createRenderer(c, Layout, component, options))
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
