import { getSupportedModelCatalog } from '@telepat/limn';

export function getLimnGenerationModels() {
  return getSupportedModelCatalog().filter((entry) => entry.generationEnabled);
}

export const DEFAULT_LIMN_MODEL_ID = 'z-image';

export function resolveFamilyFromReplicateModelId(replicateModelId) {
  const match = getLimnGenerationModels().find((model) =>
    model.replicateModelIds.includes(replicateModelId)
  );
  return match?.family ?? null;
}

export function isKnownLimnFamily(family) {
  return getLimnGenerationModels().some((model) => model.family === family);
}

export function isReplicateModelIdForFamily(family, replicateModelId) {
  const match = getLimnGenerationModels().find((model) => model.family === family);
  if (!match) {
    return false;
  }
  return match.replicateModelIds.includes(replicateModelId);
}

export function getLimnReplicateModelsForFamily(family) {
  const match = getLimnGenerationModels().find((model) => model.family === family);
  if (!match) {
    return [];
  }
  return [...match.replicateModelIds];
}

export function getLimnDefaultReplicateModel(family) {
  const match = getLimnGenerationModels().find((model) => model.family === family);
  return match?.defaultReplicateModelId ?? null;
}
