import { env } from '../config/env.js';

let initialized = false;
let admin;
let db;
let bucket;

export async function getFirebaseClients(options = {}) {
  const envOverride = options.env || env;
  const importFirebaseAdmin = options.importFirebaseAdmin || (async () => import('firebase-admin'));

  if (initialized) {
    return { admin, db, bucket };
  }

  const adminModule = await importFirebaseAdmin();
  admin = adminModule.default;

  const hasExplicitCredentials =
    envOverride.firebaseProjectId && envOverride.firebaseClientEmail && envOverride.firebasePrivateKey;

  const appConfig = hasExplicitCredentials
    ? {
        credential: admin.credential.cert({
          projectId: envOverride.firebaseProjectId,
          clientEmail: envOverride.firebaseClientEmail,
          privateKey: envOverride.firebasePrivateKey.replace(/\\n/g, '\n')
        }),
        storageBucket: envOverride.firebaseStorageBucket || undefined
      }
    : {
        credential: admin.credential.applicationDefault(),
        storageBucket: envOverride.firebaseStorageBucket || undefined
      };

  admin.initializeApp(appConfig);
  db = admin.firestore();
  bucket = admin.storage().bucket();
  initialized = true;

  return { admin, db, bucket };
}

export function __resetFirebaseClientsForTests() {
  initialized = false;
  admin = undefined;
  db = undefined;
  bucket = undefined;
}

export function buildStorageHttpUrl(bucketName, objectPath) {
  const encodedPath = objectPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://storage.googleapis.com/${bucketName}/${encodedPath}`;
}
