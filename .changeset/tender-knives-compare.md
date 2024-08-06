---
'@hono/event-emitter': major
---

### Added:
- New `emitAsync` method to the EventEmitter to enable invoking asynchronous handlers. 
- Added prevention for potential memory leak when adding handlers inside of middleware via `on` method.
- Introduced new option of EventEmitter `maxHandlers` that limits number of handlers that can be added to a single event.
- Significantly improved documentation.

### Changed:
- Moved context parameter to the first position in the `emit` method.
