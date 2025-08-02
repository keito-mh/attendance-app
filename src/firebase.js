import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase設定（ここにあなたの設定を貼り付け）
const firebaseConfig = {
  apiKey: "AIzaSyBh3FR5g743xi45rdtGVw2H1f4bkgX9LTo",
  authDomain: "attendance-app-3yun.firebaseapp.com",
  projectId: "attendance-app-3yun",
  storageBucket: "attendance-app-3yun.firebasestorage.app",
  messagingSenderId: "194563395345",
  appId: "1:194563395345:web:8af28a6c2d84b59c2446b0"
};

// Firebase初期化
const app = initializeApp(firebaseConfig);

// Firestoreデータベース
export const db = getFirestore(app);
