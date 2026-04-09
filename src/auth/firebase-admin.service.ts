import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: admin.app.App;

  constructor() {
    if (!admin.apps.length) {
      this.app = admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'nyama-xxxxx',
      });
      this.logger.log(
        `🔥 Firebase Admin initialisé (projectId=${process.env.FIREBASE_PROJECT_ID || 'nyama-xxxxx'})`,
      );
    } else {
      this.app = admin.apps[0]!;
    }
  }

  async verifyIdToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    return admin.auth().verifyIdToken(idToken);
  }
}
