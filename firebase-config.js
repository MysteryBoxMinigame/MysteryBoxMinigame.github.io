// Firebase Configuration
// Replace these values with your actual Firebase project credentials

const firebaseConfig = {
    apiKey: "your-api-key-here",
    authDomain: "your-project-id.firebaseapp.com", 
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};

/* 
HOW TO SET UP FIREBASE:

1. Go to https://console.firebase.google.com/
2. Create a new project or select existing one
3. Go to Project Settings > General > Your apps
4. Click "Add app" and select Web (</>) 
5. Register your app with a nickname
6. Copy the config object and replace the values above
7. Enable Authentication:
   - Go to Authentication > Sign-in method
   - Enable Email/Password
   - Enable Google (optional)
8. Enable Firestore:
   - Go to Firestore Database > Create database
   - Start in test mode for development
   - Choose your preferred location

9. Update Firestore Rules for production:
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
*/

// Don't modify anything below this line
if (typeof module !== 'undefined' && module.exports) {
    module.exports = firebaseConfig;
}
