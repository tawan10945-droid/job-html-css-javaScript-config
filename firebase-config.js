// Firebase Configuration for Realtime Database
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

  const firebaseConfig = {
  apiKey: "AIzaSyABY8jkjB2RD3RPK-qQ6kJThm32Pc9OpKE",
  authDomain: "events-93cb9.firebaseapp.com",
  databaseURL: "https://events-93cb9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "events-93cb9",
  storageBucket: "events-93cb9.firebasestorage.app",
  messagingSenderId: "234410411694",
  appId: "1:234410411694:web:b544058bce0dfe78a88f3f",
  measurementId: "G-4D3X216R1K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);  // Realtime Database
const storage = getStorage(app);

export { app, db, storage };