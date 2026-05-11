import admin from 'firebase-admin';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { env } from '../../config/env';

export function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
    } else if (env.FIREBASE_PROJECT_ID) {
      // Fall back to Application Default Credentials if available (GOOGLE_APPLICATION_CREDENTIALS, gcloud auth, etc.)
      admin.initializeApp({ projectId: env.FIREBASE_PROJECT_ID });
    } else {
      throw new AppError(
        'Firebase admin is not configured. Set FIREBASE_PROJECT_ID (required), and optionally FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (service account).',
        500,
        ERROR_CODES.INTERNAL_SERVER_ERROR,
      );
    }
  }

  return admin;
}

