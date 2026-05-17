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

### 4. Run the Development Server

Start the local Vite development server:

```bash
npm run dev
```

Open your browser and navigate to the URL provided in your terminal (usually `http://localhost:5173`). Vite provides instant hot-reloading, so any changes you make to the HTML or JS files will instantly reflect in the browser.

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

## Architecture Notes

- **Source Code**: All active development files (HTML, JS) are housed within the `src/` directory.
- **Routing**: `vite.config.js` is configured to recognize `src/` as the root directory, ensuring seamless path resolution between the multi-page application files.
- **Authentication**: The entire authentication UI flow (modals, dropdowns, avatar generation) and Firebase SDK logic is housed dynamically within `src/navbar.js`. This script is imported as a module on every HTML page.
