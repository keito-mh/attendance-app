import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // あなたのFirebase設定
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;
