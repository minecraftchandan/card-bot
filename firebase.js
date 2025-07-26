// firebase.js
const { initializeApp, applicationDefault, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let db;

if (!getApps().length) {
  const firebaseApp = initializeApp({
    credential: applicationDefault(),
  });
  db = getFirestore(firebaseApp);
} else {
  db = getFirestore();
}

module.exports = db;
