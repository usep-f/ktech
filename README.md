# KTech Solutions Website

A high-performance, responsive multi-page web application built for modern enterprise technology infrastructure. The system leverages Vite for lightning-fast development, Tailwind CSS for robust styling, and Firebase for secure, real-time user authentication.

## Features

- **Modern UI/UX**: Premium, responsive design utilizing Tailwind CSS with dynamic micro-animations and reveal effects.
- **Multi-Page Architecture**: Distinct pages for Home, About Us, Services, Portfolio, and Contact, all sharing a modular navigation component.
- **Vite Build System**: Optimized development server with hot-module replacement and automated static bundling for production.
- **Firebase Authentication**: Integrated secure user login and registration flows directly tied to the Firebase Auth SDK.
- **Modular Components**: Centralized `navbar.js` managing all cross-page UI components, including the authentication modals and responsive mobile menus.

---

## 🚀 Getting Started

Follow these instructions to set up the project on your local workstation.

### Prerequisites

You will need the following installed on your machine:
- [Node.js](https://nodejs.org/) (Version 18+ recommended)
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/usep-f/ktech.git
cd ktech
```

### 2. Install Dependencies

The project uses `npm` to manage the Vite development server and the Firebase SDK.

```bash
npm install
```

### 3. Setup Firebase Environment Variables

This application requires Firebase credentials to handle authentication.

1. Create a new file named `.env` in the root folder of the project.
2. Copy the contents of the `.env.example` file into your new `.env` file.
3. Go to your [Firebase Console](https://console.firebase.google.com/), open your project settings, and replace the placeholder values in your `.env` file with your actual Firebase configuration keys.

> **Note:** Do not remove the `VITE_` prefix from the variable names, as Vite requires this prefix to safely expose the keys to the frontend JavaScript.

### 4. Setup Firebase Backend (Cloud Functions)

The system relies on Firebase Cloud Functions to handle secure operations like account deletion and notifications.

1. Navigate to the functions directory:
   ```bash
   cd functions
   ```
2. Install the backend dependencies (Firebase Admin SDK):
   ```bash
   npm install
   ```
3. Return to the root directory:
   ```bash
   cd ..
   ```

### 5. Run the Development Server

Start the local Vite development server:

```bash
npm run dev
```

Open your browser and navigate to the URL provided in your terminal (usually `http://localhost:5174`). Vite provides instant hot-reloading.

### 6. Admin Account Provisioning (For Developers)

If you are setting this project up on a completely new Firebase project, you will need to grant your account Admin access to view the Admin Dashboard and bypass security rules. Because our `firestore.rules` reads directly from the database, no complicated scripts are required:

1. Register an account normally through the local website UI.
2. Open your [Firebase Console](https://console.firebase.google.com/) and go to **Firestore Database**.
3. Open the `users` collection and find your user document.
4. Add or change the `role` field from `"client"` to `"admin"`.
5. Log out and log back into the local website to refresh your permissions.

---

## 🛠️ Building for Production

When you are ready to deploy the website, you can bundle it into static assets.

```bash
npm run build
```

This command will process all HTML files in the `src/` directory, minify your JavaScript, and output the optimized, production-ready files into a `dist/` directory located at the root of the project. 

You can preview this production build locally by running:

```bash
npm run preview
```

---

## ☁️ Deploying to Firebase Hosting

This application is configured for direct deployment to **Firebase Hosting**. Because the system uses Vite, Firebase is pre-configured to upload and serve optimized assets from the compiled [dist](file:///c:/Users/venre/Desktop/ktech/dist) directory.

### First-Time Workspace Setup
The core configurations (`firebase.json` and `.firebaserc`) are checked into version control. If you are setting up the project on a new workstation, you do **not** need to run `firebase init`. 

Simply follow these steps:

1. **Install Firebase CLI** globally on your system:
   ```bash
   npm install -g firebase-tools
   ```

2. **Log in to Firebase** to authenticate your terminal:
   ```bash
   firebase login
   ```
   *(Ensure your Google/Firebase account has been added to the project console permissions).*

3. **Compile & Deploy** your updates in one step:
   ```bash
   npm run build && firebase deploy
   ```

Once completed, the Firebase CLI will provide your live URL (e.g., `https://ktech-solutions.web.app`).

---

## Architecture Notes

- **Source Code**: All active development files (HTML, JS) are housed within the `src/` directory.
- **Routing**: `vite.config.js` is configured to recognize `src/` as the root directory, ensuring seamless path resolution between the multi-page application files.
- **Authentication**: The entire authentication UI flow (modals, dropdowns, avatar generation) and Firebase SDK logic is housed dynamically within `src/navbar.js`. This script is imported as a module on every HTML page.
