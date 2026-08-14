import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
// @ts-ignore - this file will be generated after firebase setup
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  // @ts-ignore
  autoDetectLongPolling: false
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

