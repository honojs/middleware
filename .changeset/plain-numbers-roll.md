---
'@hono/zod-openapi': major
---

## Description

This PR adds two new utilities to improve route definition and registration in `@hono/zod-openapi`:

- `defineOpenAPIRoute`: Provides explicit type safety for route definitions
- `openapiRoutes`: Enables batch registration of multiple routes with full type safety

## Problem

- Registering many routes individually was repetitive and verbose
- Type inference for complex route configurations was challenging
- Organizing routes across multiple files was difficult
- No built-in support for conditional route registration
- RPC type safety was hard to maintain across scattered route registrations

## Solution

- `defineOpenAPIRoute`: Wraps route definitions with explicit types for better IDE support and type checking
- `openapiRoutes`: Accepts an array of route definitions and registers them all at once
- Supports `addRoute` flag for conditional registration
- Maintains full type safety and RPC support through recursive type merging
- Enables clean modular organization of routes

## Benefits

- ✅ Reduced boilerplate code
- ✅ Better type inference and IDE autocomplete
- ✅ Easier code organization and maintainability
- ✅ Declarative conditional routes
- ✅ Full backward compatibility

## Examples

See the updated README for usage examples.

## Testing

- All existing tests pass (102/102)
- Added tests for new functionality
- Verified type inference works correctly

## Documentation

- Updated package README with usage examples
- Added MyContribution.md with detailed design rationale
