import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyATYtYAGitBNgB4Vn0SPllF0w1gj3Hnr8E",
  authDomain: "chatwithyash-6e5a3.firebaseapp.com",
  databaseURL: "https://chatwithyash-6e5a3-default-rtdb.firebaseio.com",
  projectId: "chatwithyash-6e5a3",
  storageBucket: "chatwithyash-6e5a3.appspot.com",
  messagingSenderId: "860118961558",
  appId: "1:860118961558:web:45f9b081ba7fb0bff4e1b7",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const storage = getStorage(app);

