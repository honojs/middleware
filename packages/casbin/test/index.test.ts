import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { newEnforcer } from 'casbin';
import { casbin } from '../src';

describe('Casbin Middleware Tests', () => {
  describe('BasicAuthorizer', () => {
    const app = new Hono();
    const enforcer = newEnforcer('examples/model.conf', 'examples/policy.csv');
    app.use('*', casbin({ newEnforcer: enforcer }));
    app.get('/dataset1/test', (c) => c.text('dataset1 test'));
    app.post('/dataset1/resource1', (c) => c.text('resource1 created'));
    app.post('/dataset2/folder1/file', (c) => c.text('file created'));
    app.get('/dataset2/resource1', (c) => c.text('resource1 fetched'));
    app.post('/dataset2/resource1', (c) => c.text('resource1 created'));
    app.put('/dataset2/resource1', (c) => c.text('resource1 updated'));
    app.delete('/dataset2/resource1', (c) => c.text('resource1 deleted'));
    app.get('/dataset2/resource2', (c) => c.text('resource2 fetched'));
    app.get('/dataset1/admin', (c) => c.text('resource fetched'));
    app.post('/dataset1/admin', (c) => c.text('resource created'));
    app.put('/dataset1/admin', (c) => c.text('resource updated'));
    app.delete('/dataset1/admin', (c) => c.text('resource deleted'));

    it('test: p, alice, /dataset1/*, GET', async () => {
      const req = new Request('http://localhost/dataset1/test', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from('alice:password').toString('base64')}`
        }
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
    });

    it('test: p, alice, /dataset1/resource1, POST', async () => {
      const req = new Request('http://localhost/dataset1/resource1', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from('alice:password').toString('base64')}`
        }
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
    });

    it('test: bob, /dataset2/folder1/*, POST', async () => {
      const req = new Request('http://localhost/dataset2/folder1/file', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from('bob:password').toString('base64')}`
        }
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
    });

    it('test: p, bob, /dataset2/resource1, * - GET', async () => {
      const req = new Request('http://localhost/dataset2/resource1', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from('bob:password').toString('base64')}`
        }
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
    });

    it('test: p, bob, /dataset2/resource1, * - POST', async () => {
      const req = new Request('http://localhost/dataset2/resource1', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from('bob:password').toString('base64')}`
        }
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
    });

    it('test: p, bob, /dataset2/resource1, * - PUT', async () => {
      const req = new Request('http://localhost/dataset2/resource1', {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${Buffer.from('bob:password').toString('base64')}`
        }
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
    });

    it('test: p, bob, /dataset2/resource1, * - DELETE', async () => {
      const req = new Request('http://localhost/dataset2/resource1', {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${Buffer.from('bob:password').toString('base64')}`
        }
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
    });

    it('test: p, bob, /dataset2/resource2, GET', async () => {
      const req = new Request('http://localhost/dataset2/resource2', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from('bob:password').toString('base64')}`
        }
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
    });

    it('test: p & g, dataset1_admin, /dataset1/*, * - GET', async () => {
      const req = new Request('http://localhost/dataset1/admin', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from('cathy:password').toString('base64')}`
        }
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
    });

    it('test: p & g, dataset1_admin, /dataset1/*, * - POST', async () => {
      const req = new Request('http://localhost/dataset1/admin', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from('cathy:password').toString('base64')}`
        }
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
    });

    it('test: p & g, dataset1_admin, /dataset1/*, * - PUT', async () => {
      const req = new Request('http://localhost/dataset1/admin', {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${Buffer.from('cathy:password').toString('base64')}`
        }
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
    });

    it('test: p & g, dataset1_admin, /dataset1/*, * - DELETE', async () => {
      const req = new Request('http://localhost/dataset1/admin', {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${Buffer.from('cathy:password').toString('base64')}`
        }
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
    });

    it('test: p, bob, /dataset1/test - POST 403', async () => {
      const req = new Request('http://localhost/dataset1/test', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from('bob:password').toString('base64')}`
        }
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(403);
    });

    it('test: p, bob, /dataset1/resource1 - 403', async () => {
      const req = new Request('http://localhost/dataset1/resource1', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from('bob:password').toString('base64')}`
        }
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(403);
    });

    it('test: p & g, dataset1_admin, /dataset1/*, * - DELETE - 403', async () => {
      const req = new Request('http://localhost/dataset1/admin', {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${Buffer.from('chalin:password').toString('base64')}`
        }
      });
      const res = await app.fetch(req);
      expect(res.status).toBe(403);
    });
  });
});
