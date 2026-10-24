---
source: import
created: 2026-10-19T18:00:00.000Z
tags: [testing]
status: done
---

# Browser smoke tests

jsdom proves the components; only a real browser proves the bundle, the daemon URL, CORS and the
Markdown pipeline together.

```js
expect(statusBar).toContain("Connected to daemon");
```
