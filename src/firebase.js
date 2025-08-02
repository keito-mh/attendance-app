// Firebase v9+ の正しいインポート方法
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase設定（あなたの実際の設定値に置き換えてください）
const firebaseConfig = {
  apiKey: "AIzaSyAw1foKE0J7Y5ns",
  authDomain: "attendance-app-137a2.firebaseapp.com",
  projectId: "attendance-app-137a2",
  storageBucket: "attendance-app-137a2.firebasestorage.app",
  messagingSenderId: "232882299054",
  appId: "1:232882299054:web:6b9d73f6b47fb6d1a38d3f"
};

// Firebase初期化
const app = initializeApp(firebaseConfig);

// Firestoreデータベース
export const db = getFirestore(app);

export default app;
