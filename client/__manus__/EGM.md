# __manus__

## Overview

Manus Debug Collector, a dev-only browser script. It captures console output, network requests (fetch and XHR), errors and semantic UI events, then POSTs them to the Vite dev middleware. The middleware writes them to `.manus-logs/`.

## Interface

- `debug-collector.js`: injected by the `manus-debug-collector` Vite plugin as `<script src="/__manus__/debug-collector.js" defer>`. It is skipped when `NODE_ENV === "production"` (see the repo-root `vite.config.ts`)
- Global `window.__MANUS_DEBUG_COLLECTOR__ = { version: "2.0-no-rrweb", store, forceReport }` [debug-collector.js]
- `CONFIG` [debug-collector.js:CONFIG]:
  - `reportEndpoint: "/__manus__/logs"`
  - buffer caps: console 500, network 200, ui 500
  - `reportInterval: 2000`
  - `maxBodyLength: 10240`
  - `uiInputMaxLen: 200`, `uiTextMaxLen: 80`, `scrollThrottleMs: 500`
- Report payload: `{ timestamp, consoleLogs, networkRequests, sessionEvents, uiEvents }` [debug-collector.js:reportLogs]
- Unload beacon payload: the same shape. If the serialized payload is longer than 60000 characters (`MAX_BEACON_SIZE`), it is replaced by the last 50 console logs, the last 20 network requests and the last 100 UI events, plus `_truncated: true` [debug-collector.js:beforeunload]

## Invariants

- Initializes once; it is guarded by the existing global [debug-collector.js]
- Values under keys that contain `password`, `token`, `secret`, `key`, `authorization`, `cookie` or `session` are redacted from captured bodies and values. `sanitizeValue` also cuts strings to 1000 characters and arrays to 100 items [debug-collector.js:sanitizeValue]
- An input or textarea is masked only when its `type` is `password` or its `name` or `id` contains one of the sensitive words above. Values of all other inputs are recorded in UI events, up to 200 characters [debug-collector.js:isSensitiveField, getInputValueSafe]
- Fetch request headers pass through `sanitizeValue`, so `Authorization`, `apikey` and `Cookie` values are redacted [debug-collector.js:window.fetch]
- Requests to `/__manus__/*` are not intercepted. Elements inside `.manus-no-record` are ignored
- Streaming response bodies, binary response bodies and response bodies larger than 10240 bytes are not captured. Request bodies are always captured, passed through `sanitizeValue` and then cut to 10240 characters of their serialized form (`maxBodyLength`) [debug-collector.js:window.fetch, XMLHttpRequest.send, capBody]
- Data from a failed POST is put back into the buffers

## Side Effects

- Monkey-patches `console.*`, `window.fetch`, `XMLHttpRequest.prototype.open` / `send`, `history.pushState` / `replaceState`
- Adds document and window listeners: click, change, focus, keydown, submit, scroll, popstate, hashchange, error, unhandledrejection, beforeunload
- Sends a POST to `/__manus__/logs` every 2s, and a `navigator.sendBeacon` on unload

## Verification

- Run: `pnpm test` (no test targets this directory; the file is not type-checked)
