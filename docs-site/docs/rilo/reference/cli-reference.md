---
slug: /reference/cli-reference
sidebar_position: 1
title: CLI Reference
---

Core command:

```bash
rilo --project <name> --story-file <path>
```

Common flags:
- `--project`: target project name
- `--story-file`: path to story input file
- `--force`: force restart from earlier stages where applicable
- `--help`: print usage
- `--version`: print package version

Install globally:

```bash
npm install -g @telepat/rilo
```

Run without global install:

```bash
npx @telepat/rilo --help
```

Example:

```bash
rilo --project housing-case --story-file ./examples/story.txt
```
