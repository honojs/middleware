# Alias of hono/jsx for replacement of React

This package is used to install the React compatibility API provided by [Hono](https://github.com/honojs/hono). This package allows you to replace the "react" and "react-dom" entities with "@hono/react-compat".

## Usage

```bash
npm install react@npm:@hono/react-compat react-dom@npm:@hono/react-compat
```

After installing in this way, "@hono/react-compat" will be loaded when "react" is specified in the `jsxImportSource` setting or in the `import` statement. See the [npm docs](https://docs.npmjs.com/cli/v7/commands/npm-install) for more information about aliased installs.

## Author

Taku Amano <https://github.com/usualoma>

## License

MIT
