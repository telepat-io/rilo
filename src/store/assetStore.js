import { writeProjectArtifacts } from './projectStore.js';

export async function persistArtifacts(projectName, artifacts) {
  await writeProjectArtifacts(projectName, artifacts);
}
