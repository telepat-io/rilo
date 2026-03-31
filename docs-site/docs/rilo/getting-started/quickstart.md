---
slug: /getting-started/quickstart
sidebar_position: 3
title: Quickstart
---

Local development workflow:

```bash
npm install
cp .env.example .env
npm run dev -- settings
npm run dev -- --project housing-case --story-file ./examples/story.txt
```

Using a global install:

```bash
npm install -g @telepat/rilo
rilo settings
rilo --project housing-case --story-file ./examples/story.txt
```

Or run via npx:

```bash
npx @telepat/rilo settings
npx @telepat/rilo --project housing-case --story-file ./examples/story.txt
```

Initial outputs in `projects/<project>/` include config.json, story.md, run-state.json, artifacts.json, assets/, and final.mp4.
