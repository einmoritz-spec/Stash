// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDtxa71EE4EmELntGa2XY_OqaZjoBgTcns",
  authDomain: "stash-8cf5b.firebaseapp.com",
  projectId: "stash-8cf5b",
  storageBucket: "stash-8cf5b.firebasestorage.app",
  messagingSenderId: "434103815158",
  appId: "1:434103815158:web:561e85e204075edf2595d7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

window.FIREBASE_CONFIG = {
  apiKey: "DEIN_API_KEY",
  authDomain: "DEIN_PROJEKT.firebaseapp.com",
  projectId: "DEIN_PROJEKT",
  storageBucket: "DEIN_PROJEKT.appspot.com",
  messagingSenderId: "DEINE_SENDER_ID",
  appId: "DEINE_APP_ID"
};
