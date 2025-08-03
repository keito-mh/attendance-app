import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase設定（ここにあなたの設定を貼り付け）
const firebaseConfig = {
  apiKey: "AIzaSyBW3izAw3ySnOdaozJ2iDekHMkblIOFMo8",
  authDomain: "attendance-app-firebase-9086d.firebaseapp.com",
  projectId: "attendance-app-firebase-9086d",
  storageBucket: "attendance-app-firebase-9086d.firebasestorage.app",
  messagingSenderId: "65432712385",
  appId: "1:65432712385:web:197dbe2f62116f36301040"
};

// Firebase初期化
const app = initializeApp(firebaseConfig);

// Firestoreデータベース
export const db = getFirestore(app);

export default app;
