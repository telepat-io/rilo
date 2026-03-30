---
slug: /technical/testing
sidebar_position: 4
title: Testing
---

Run quality checks:

```bash
npm run lint
npm test
npm run test:coverage
npm run frontend:lint
npm run frontend:build
npm run docs:build
```

Tests are designed to avoid live inference and external-network dependency in unit suites.
