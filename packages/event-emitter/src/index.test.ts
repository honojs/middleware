import { Hono } from 'hono';
import { expect, vi } from 'vitest';
import { emitter, createEmitter, type Emitter, type EventHandlers, defineHandler, defineHandlers } from '../src';

describe('EventEmitter', () => {
  describe('Used inside of route handlers', () => {
    it('Should work when subscribing to events inside of route handler', async () => {
      type EventHandlerPayloads = {
        'todo:created': { id: string; text: string };
      };
      type Env = { Variables: { emitter: Emitter<EventHandlerPayloads> } };

      const handler = defineHandler<EventHandlerPayloads, 'todo:created'>((_c, _payload) => {});

      const spy = vi.fn(handler);

      const app = new Hono<Env>();

      app.use('*', emitter());

      app.use((c, next) => {
        c.get('emitter').on('todo:created', spy);
        return next();
      });

      let currentContext = null;
      app.post('/todo', (c) => {
        currentContext = c;
        c.get('emitter').emit('todo:created', c, { id: '2', text: 'Buy milk' });
        return c.json({ message: 'Todo created' });
      });

      const res = await app.request('http://localhost/todo', { method: 'POST' });
      expect(res).not.toBeNull();
      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledWith(currentContext, { id: '2', text: 'Buy milk' });
    });

    it('Should not subscribe same handler to same event twice inside of route handler', async () => {
      type EventHandlerPayloads = {
        'todo:created': { id: string; text: string };
      };
      type Env = { Variables: { emitter: Emitter<EventHandlerPayloads> } };

      const handler = defineHandler<EventHandlerPayloads, 'todo:created'>((_c, _payload) => {});

      const spy = vi.fn(handler);

      const app = new Hono<Env>();

      app.use('*', emitter());

      app.use((c, next) => {
        c.get('emitter').on('todo:created', spy);
        return next();
      });

      app.post('/todo', (c) => {
        c.get('emitter').emit('todo:created', c, { id: '2', text: 'Buy milk' });
        return c.json({ message: 'Todo created' });
      });

      await app.request('http://localhost/todo', { method: 'POST' });
      await app.request('http://localhost/todo', { method: 'POST' });
      await app.request('http://localhost/todo', { method: 'POST' });
      expect(spy).toHaveBeenCalledTimes(3);
    });

    it('Should work assigning event handlers via middleware', async () => {
      type EventHandlerPayloads = {
        'todo:created': { id: string; text: string };
      };

      type Env = { Variables: { emitter: Emitter<EventHandlerPayloads> } };

      const handlers = defineHandlers<EventHandlerPayloads>({
        'todo:created': [vi.fn((_c, _payload) => {})],
      });

      const app = new Hono<Env>();

      app.use('*', emitter(handlers));

      let currentContext = null;
      app.post('/todo', (c) => {
        currentContext = c;
        c.get('emitter').emit('todo:created', c, { id: '2', text: 'Buy milk' });
        return c.json({ message: 'Todo created' });
      });

      const res = await app.request('http://localhost/todo', { method: 'POST' });
      expect(res).not.toBeNull();
      expect(res.status).toBe(200);
      expect(handlers['todo:created']?.[0]).toHaveBeenCalledWith(currentContext, { id: '2', text: 'Buy milk' });
    });
  });

  describe('Used as standalone', () => {
    it('Should work assigning event handlers via createEmitter function param', async () => {
      type EventHandlerPayloads = {
        'todo:created': { id: string; text: string };
        'todo:deleted': { id: string };
      };

      type Env = { Variables: { emitter: Emitter<EventHandlerPayloads> } };

      const handlers: EventHandlers<EventHandlerPayloads> = {
        'todo:created': [vi.fn((_payload) => {})],
      };

      const ee = createEmitter<EventHandlerPayloads>(handlers);

      const todoDeletedHandler = vi.fn(defineHandler<EventHandlerPayloads, 'todo:deleted'>((_c, _payload) => {}));

      ee.on('todo:deleted', todoDeletedHandler);

      const app = new Hono<Env>();

      let todoCreatedContext = null;
      app.post('/todo', (c) => {
        todoCreatedContext = c;
        ee.emit('todo:created', c, { id: '2', text: 'Buy milk' });
        return c.json({ message: 'Todo created' });
      });

      let todoDeletedContext = null;
      app.delete('/todo/123', (c) => {
        todoDeletedContext = c;
        ee.emit('todo:deleted', c, { id: '3' });
        return c.json({ message: 'Todo deleted' });
      });

      const res = await app.request('http://localhost/todo', { method: 'POST' });
      expect(res).not.toBeNull();
      expect(res.status).toBe(200);
      expect(handlers['todo:created']?.[0]).toHaveBeenCalledWith(todoCreatedContext, { id: '2', text: 'Buy milk' });
      const res2 = await app.request('http://localhost/todo/123', { method: 'DELETE' });
      expect(res2).not.toBeNull();
      expect(res2.status).toBe(200);
      expect(todoDeletedHandler).toHaveBeenCalledWith(todoDeletedContext, { id: '3' });
    });

    it('Should work assigning event handlers via standalone on()', async () => {
      type EventHandlerPayloads = {
        'todo:created': { id: string; text: string };
        'todo:deleted': { id: string };
      };

      type Env = { Variables: { emitter: Emitter<EventHandlerPayloads> } };

      const ee = createEmitter<EventHandlerPayloads>();

      const todoDeletedHandler = defineHandler<EventHandlerPayloads, 'todo:deleted'>(
        (_c, _payload: EventHandlerPayloads['todo:deleted']) => {},
      );

      const spy = vi.fn(todoDeletedHandler);

      ee.on('todo:deleted', spy);

      const app = new Hono<Env>();

      let currentContext = null;
      app.delete('/todo/123', (c) => {
        currentContext = c;
        ee.emit('todo:deleted', c, { id: '2' });
        return c.json({ message: 'Todo created' });
      });

      const res = await app.request('http://localhost/todo/123', { method: 'DELETE' });
      expect(res).not.toBeNull();
      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledWith(currentContext, { id: '2' });
    });

    it('Should work removing event handlers via off() method', async () => {
      type EventHandlerPayloads = {
        'todo:created': { id: string; text: string };
        'todo:deleted': { id: string };
      };

      type Env = { Variables: { emitter: Emitter<EventHandlerPayloads> } };

      const ee = createEmitter<EventHandlerPayloads>();

      const todoDeletedHandler = defineHandler<EventHandlerPayloads, 'todo:deleted'>(
        (_c, _payload: EventHandlerPayloads['todo:deleted']) => {},
      );

      const spy = vi.fn(todoDeletedHandler);

      ee.on('todo:deleted', spy);

      const app = new Hono<Env>();

      app.post('/todo', (c) => {
        ee.emit('todo:deleted', c, { id: '2' });
        ee.off('todo:deleted', spy);
        return c.json({ message: 'Todo created' });
      });

      await app.request('http://localhost/todo', { method: 'POST' });
      await app.request('http://localhost/todo', { method: 'POST' });
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('Should work removing all event handlers via off() method not providing handler as second argument', async () => {
      type EventHandlerPayloads = {
        'todo:deleted': { id: string };
      };

      type Env = { Variables: { emitter: Emitter<EventHandlerPayloads> } };

      const ee = createEmitter<EventHandlerPayloads>();

      const todoDeletedHandler = defineHandler<EventHandlerPayloads, 'todo:deleted'>(
        (_c, _payload: EventHandlerPayloads['todo:deleted']) => {},
      );
      const todoDeletedHandler2 = defineHandler<EventHandlerPayloads, 'todo:deleted'>(
        (_c, _payload: EventHandlerPayloads['todo:deleted']) => {},
      );

      const spy = vi.fn(todoDeletedHandler);
      const spy2 = vi.fn(todoDeletedHandler2);

      ee.on('todo:deleted', spy);
      ee.on('todo:deleted', spy2);

      const app = new Hono<Env>();

      app.post('/todo', (c) => {
        ee.emit('todo:deleted', c, { id: '2' });
        ee.off('todo:deleted');
        return c.json({ message: 'Todo created' });
      });

      await app.request('http://localhost/todo', { method: 'POST' });
      await app.request('http://localhost/todo', { method: 'POST' });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });
  });
});
