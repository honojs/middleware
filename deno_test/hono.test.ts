import { buildSchema } from "https://cdn.skypack.dev/graphql@16.5.0?dts";
import { Hono } from "https://deno.land/x/hono@v2.0.3/mod.ts";
import { errorMessages, graphqlServer } from "../deno_dist/index.ts";
import { assertEquals } from "https://deno.land/std@0.149.0/testing/asserts.ts";


Deno.test("graphql-server", async (t) => {
  // Construct a schema, using GraphQL schema language
  const schema = buildSchema(`
  type Query {
    hello: String
  }
`);

  // The root provides a resolver function for each API endpoint
  const rootValue = {
    hello: () => "Hello world!",
  };

  const app = new Hono();

  app.use(
    "/graphql",
    graphqlServer({
      schema,
      rootValue,
    })
  );

  app.all("*", (c) => {
    c.header("foo", "bar");
    return c.text("fallback");
  });

    const query = "query { hello }";
    const body = {
      query: query,
    };

    const res = await app.request("http://localhost/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    assertEquals(res.status, 200)
    assertEquals(await res.text(), '{"data":{"hello":"Hello world!"}}')
});
