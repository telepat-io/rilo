import Replicate from 'replicate';
import { env, assertRequiredEnv } from '../config/env.js';

let client;

export function getReplicateClient() {
  if (!client) {
    assertRequiredEnv();
    client = new Replicate({ auth: env.replicateApiToken });
  }
  return client;
}
