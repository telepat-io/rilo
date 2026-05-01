import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  userSidebar: [
    'rilo/index',
    'rilo/features',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'rilo/getting-started/overview',
        'rilo/getting-started/installation',
        'rilo/getting-started/quickstart',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'rilo/guides/configuration',
        'rilo/guides/model-adapters-and-options',
        'rilo/guides/story-format-and-script-generation',
        'rilo/guides/pipeline-stages',
        'rilo/guides/regeneration-and-invalidation',
        'rilo/guides/subtitles-align-and-burn-in',
        'rilo/guides/output-structure',
        'rilo/guides/local-preview',
        'rilo/guides/deployment-backends',
        'rilo/guides/troubleshooting',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'rilo/reference/cli-reference',
        'rilo/reference/api-auth-and-webhooks',
        'rilo/reference/environment-variables',
        'rilo/reference/glossary',
        'rilo/reference/model-catalog',
        'rilo/reference/output-artifacts',
      ],
    },
    {
      type: 'category',
      label: 'Technical',
      items: [
        'rilo/technical/architecture',
        'rilo/technical/pipeline-and-invalidation-diagrams',
        'rilo/technical/orchestrator-and-checkpointing',
        'rilo/technical/observability-and-analytics',
        'rilo/technical/testing',
      ],
    },
    {
      type: 'category',
      label: 'Contributing',
      items: [
        'rilo/contributing/development',
        'rilo/contributing/releasing-and-docs-deploy',
      ],
    },
  ],
};

export default sidebars;
