import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildOpenApiSpec } from './spec.js';

export async function generateOpenApiFile({
  outputPath = path.resolve('openapi', 'openapi.json'),
  baseUrl = 'http://localhost:3000'
} = {}) {
  const spec = buildOpenApiSpec({ baseUrl });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
  return outputPath;
}

const entryPoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';

if (import.meta.url === entryPoint) {
  const outputPath = await generateOpenApiFile();
  console.log(`OpenAPI generated at ${outputPath}`);
}
