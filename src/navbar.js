/**
 * KTech Solutions — Shared Navbar & Auth Component
 * Include this script on every page. It injects:
 *   1. The navbar into #navbar-root
 *   2. Login & Register modals into #modal-root
 *   3. Required CSS for modal animations
 *   4. All interactivity (open/close/switch modals, auth state, avatar)
 *
 * Firebase Integration:
 *   Replace KTechAuth internals with Firebase Auth SDK calls.
 *   The onAuthStateChanged pattern mirrors Firebase's API deliberately.
 */

import { auth, db } from './firebase.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { showToast } from './toast.js';

  // ═══════════════════════════════════════════
  // 2. DETECT ACTIVE PAGE
  // ═══════════════════════════════════════════
  const path = window.location.pathname.split("/").pop() || "index.html";
  const activePage = path === "" ? "index.html" : path;

  function navLinkClass(href) {
    if (href === activePage) {
      return "text-primary font-bold border-b-2 border-primary pb-1";
    }
    return "text-on-surface-variant font-label-md hover:text-primary transition-colors duration-200";
  }

  // ═══════════════════════════════════════════
  // 3. INJECT CSS
  // ═══════════════════════════════════════════
  const style = document.createElement("style");
  style.textContent = `
    .modal-overlay{position:fixed;inset:0;z-index:100;background:rgba(7,13,31,.85);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;pointer-events:none;transition:opacity .35s ease}
    .modal-overlay.open{opacity:1;pointer-events:auto}
    .modal-card{transform:translateY(30px) scale(.96);filter:blur(4px);transition:transform .4s cubic-bezier(.16,1,.3,1),filter .4s cubic-bezier(.16,1,.3,1)}
    .modal-overlay.open .modal-card{transform:translateY(0) scale(1);filter:blur(0)}
    .ktech-avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#00e5ff,#00daf3);color:#001f24;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;cursor:pointer;transition:box-shadow .3s ease,transform .2s ease;position:relative}
    .ktech-avatar:hover{box-shadow:0 0 16px rgba(0,229,255,.4);transform:scale(1.05)}
    .ktech-dropdown{position:absolute;top:calc(100% + 8px);right:0;min-width:220px;background:#191f31;border:1px solid #3b494c;border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,.5);padding:12px 0;opacity:0;pointer-events:none;transform:translateY(-8px);transition:opacity .2s ease,transform .2s ease;z-index:110}
    .ktech-dropdown.open{opacity:1;pointer-events:auto;transform:translateY(0)}
    .ktech-dropdown-item{display:flex;align-items:center;gap:10px;padding:10px 16px;font-size:14px;color:#bac9cc;cursor:pointer;transition:background .15s ease,color .15s ease}
    .ktech-dropdown-item:hover{background:rgba(0,229,255,.08);color:#c3f5ff}
    .ktech-dropdown-divider{height:1px;background:#3b494c;margin:6px 0}
    .ktech-dropdown-header{padding:10px 16px}
    .ktech-dropdown-header .name{font-weight:600;font-size:14px;color:#dce1fb}
    .ktech-dropdown-header .email{font-size:12px;color:#849396;margin-top:2px}
  `;
  document.head.appendChild(style);

  // ═══════════════════════════════════════════
  // 4. BUILD NAVBAR HTML
  // ═══════════════════════════════════════════
  function buildNavbar() {
    return `
    <header class="fixed top-0 w-full h-[80px] z-50 bg-surface/70 backdrop-blur-md border-b border-outline-variant/30 shadow-sm">
      <div class="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-nav-height w-full max-w-container-max mx-auto">
        <div class="text-headline-sm font-headline-sm font-bold text-on-surface">KTech Solutions</div>
        <nav class="hidden md:flex space-x-gutter">
          <a class="${navLinkClass("index.html")}" href="index.html">Home</a>
          <a class="${navLinkClass("aboutus.html")}" href="aboutus.html">About Us</a>
          <a class="${navLinkClass("services.html")}" href="services.html">Services</a>
          <a class="${navLinkClass("contact.html")}" href="contact.html">Contact</a>
        </nav>
        <div class="hidden md:flex items-center space-x-base" id="nav-auth-area">
          <!-- Auth area injected by updateAuthUI -->
        </div>
        <button class="md:hidden text-on-surface p-2" id="mobile-menu-btn">
          <span class="material-symbols-outlined">menu</span>
        </button>
      </div>
    </header>`;
  }

  // ═══════════════════════════════════════════
  // 5. BUILD MODALS HTML
  // ═══════════════════════════════════════════
  function buildModals() {
    return `
    <!-- LOGIN MODAL -->
    <div class="modal-overlay" id="login-modal">
      <div class="modal-card bg-surface-container-low border border-outline-variant/50 rounded-lg w-full max-w-[480px] shadow-2xl relative overflow-hidden flex flex-col">
        <div class="h-[2px] bg-primary w-full"></div>
        <div class="px-gutter pt-gutter pb-6 flex justify-between items-start border-b border-outline-variant/30">
          <div>
            <h2 class="font-headline-md text-headline-md text-on-surface mb-2">Login</h2>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Access your high-performance infrastructure dashboard.</p>
          </div>
          <button class="modal-close-btn text-on-surface-variant hover:text-primary transition-colors p-2 rounded-full hover:bg-surface-variant/50">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <form class="p-gutter flex flex-col gap-6" id="login-form">
          <div class="flex flex-col gap-2">
            <label class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider" for="login-email">Corporate Email</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">mail</span>
              <input class="w-full bg-surface-container border-b border-outline-variant focus:border-primary focus:ring-0 focus:outline-none focus:shadow-[0_0_15px_rgba(195,245,255,0.1)] text-on-surface font-body-md pl-12 pr-4 py-4 rounded-t-DEFAULT transition-all" id="login-email" placeholder="admin@enterprise.com" required type="email">
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <label class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider" for="login-password">Password</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">lock</span>
              <input class="w-full bg-surface-container border-b border-outline-variant focus:border-primary focus:ring-0 focus:outline-none focus:shadow-[0_0_15px_rgba(195,245,255,0.1)] text-on-surface font-body-md pl-12 pr-12 py-4 rounded-t-DEFAULT transition-all" id="login-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" required type="password">
              <button class="toggle-password absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors" type="button">
                <span class="material-symbols-outlined">visibility</span>
              </button>
            </div>
          </div>
          <div class="flex items-center justify-between mt-2">
            <label class="flex items-center gap-3 cursor-pointer group">
              <div class="relative flex items-center justify-center">
                <input class="peer sr-only" type="checkbox">
                <div class="w-5 h-5 rounded border border-outline-variant bg-surface-container peer-checked:bg-primary peer-checked:border-primary transition-colors"></div>
                <span class="material-symbols-outlined absolute text-on-primary-container text-[16px] opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" style="font-variation-settings:'FILL' 1;">check</span>
              </div>
              <span class="font-body-sm text-body-sm text-on-surface-variant group-hover:text-on-surface transition-colors">Remember Me</span>
            </label>
            <a class="font-label-sm text-label-sm text-primary hover:text-primary-fixed transition-colors" href="#">Forgot Password?</a>
          </div>
          <button class="mt-4 w-full h-[56px] bg-primary text-on-primary-container font-label-md text-label-md rounded-DEFAULT hover:bg-primary-fixed hover:shadow-[0_0_20px_rgba(195,245,255,0.2)] transition-all flex items-center justify-center gap-2" type="submit">
            Sign In <span class="material-symbols-outlined">arrow_forward</span>
          </button>
        </form>
        <div class="px-gutter pb-gutter pt-4 text-center border-t border-outline-variant/30">
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            New to KTech Solutions?
            <a class="switch-to-register font-label-md text-label-md text-primary hover:text-primary-fixed ml-1 transition-colors cursor-pointer">Create Account</a>
          </p>
        </div>
      </div>
    </div>

    <!-- REGISTER MODAL -->
    <div class="modal-overlay" id="register-modal">
      <div class="modal-card relative w-full max-w-md bg-surface-container border border-outline-variant/30 rounded-xl shadow-2xl shadow-primary-container/5 overflow-hidden flex flex-col">
        <div class="px-8 pt-8 pb-6 border-b border-outline-variant/20 relative">
          <button class="modal-close-btn absolute top-6 right-6 text-on-surface-variant hover:text-primary transition-colors focus:outline-none">
            <span class="material-symbols-outlined">close</span>
          </button>
          <div class="flex items-center gap-3 mb-2">
            <span class="material-symbols-outlined text-primary text-3xl">dns</span>
            <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold">KTech Solutions</h2>
          </div>
          <h3 class="font-headline-md text-headline-md text-on-surface">Create Account</h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant mt-2">Deploy your high-performance infrastructure today.</p>
        </div>
        <form class="px-8 py-6 space-y-5" id="register-form">
          <div class="space-y-1">
            <label class="font-label-md text-label-md text-on-surface" for="reg-fullname">Full Name</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant"><span class="material-symbols-outlined text-[20px]">person</span></div>
              <input class="w-full bg-surface-container-high border border-outline-variant text-on-surface font-body-md text-body-md rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[0_0_10px_rgba(0,229,255,0.1)] transition-all placeholder-on-surface-variant/50" id="reg-fullname" placeholder="Jane Doe" type="text" required>
            </div>
          </div>
          <div class="space-y-1">
            <label class="font-label-md text-label-md text-on-surface" for="reg-email">Business Email</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant"><span class="material-symbols-outlined text-[20px]">mail</span></div>
              <input class="w-full bg-surface-container-high border border-outline-variant text-on-surface font-body-md text-body-md rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[0_0_10px_rgba(0,229,255,0.1)] transition-all placeholder-on-surface-variant/50" id="reg-email" placeholder="jane@company.com" type="email" required>
            </div>
          </div>
          <div class="space-y-1">
            <label class="font-label-md text-label-md text-on-surface" for="reg-password">Password</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant"><span class="material-symbols-outlined text-[20px]">lock</span></div>
              <input class="w-full bg-surface-container-high border border-outline-variant text-on-surface font-body-md text-body-md rounded-lg py-3 pl-10 pr-10 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[0_0_10px_rgba(0,229,255,0.1)] transition-all placeholder-on-surface-variant/50" id="reg-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" type="password" required>
              <button class="toggle-password absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-primary transition-colors focus:outline-none" type="button">
                <span class="material-symbols-outlined text-[20px]">visibility</span>
              </button>
            </div>
            <p class="font-label-sm text-label-sm text-on-surface-variant mt-1">Must be at least 12 characters and include a number.</p>
          </div>
          <div class="flex items-start mt-4 pt-2">
            <div class="flex items-center h-5">
              <input class="w-4 h-4 rounded border-outline-variant bg-surface-container-high text-primary focus:ring-primary focus:ring-offset-surface-container focus:ring-offset-2" id="reg-terms" type="checkbox">
            </div>
            <div class="ml-3 text-sm">
              <label class="font-body-sm text-body-sm text-on-surface-variant" for="reg-terms">
                I agree to the <a class="text-primary hover:text-primary-container underline underline-offset-2 transition-colors" href="#">Terms of Service</a> and <a class="text-primary hover:text-primary-container underline underline-offset-2 transition-colors" href="#">Privacy Policy</a>.
              </label>
            </div>
          </div>
          <div class="pt-4 pb-2">
            <button class="w-full h-14 bg-primary text-on-primary-container font-label-md text-label-md rounded-lg hover:bg-primary-container focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-surface-container transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,229,255,0.2)]" type="submit">
              Create Account <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
          </div>
        </form>
        <div class="px-8 py-4 border-t border-outline-variant/20 bg-surface-container-lowest text-center">
          <p class="font-body-sm text-body-sm text-on-surface-variant">
            Already have an account? <a class="switch-to-login text-primary font-label-md text-label-md hover:text-primary-container underline underline-offset-2 transition-colors cursor-pointer">Log in</a>
          </p>
        </div>
      </div>
    </div>`;
  }

  // ═══════════════════════════════════════════
  // 6. INJECT INTO DOM
  // ═══════════════════════════════════════════
  const navRoot = document.getElementById("navbar-root");
  const modalRoot = document.getElementById("modal-root");

  if (navRoot) navRoot.innerHTML = buildNavbar();
  if (modalRoot) modalRoot.innerHTML = buildModals();

  // ═══════════════════════════════════════════
  // 7. AUTH UI UPDATER
  // ═══════════════════════════════════════════
  function updateAuthUI(user) {
    const area = document.getElementById("nav-auth-area");
    if (!area) return;

    if (user) {
      const initial = (user.displayName || user.email || "U").charAt(0).toUpperCase();
      area.innerHTML = `
        <div class="relative">
          <div class="ktech-avatar" id="avatar-btn" title="${user.displayName || user.email}">${initial}</div>
          <div class="ktech-dropdown" id="avatar-dropdown">
            <div class="ktech-dropdown-header">
              <div class="name">${user.displayName || "User"}</div>
              <div class="email">${user.email || ""}</div>
            </div>
            <div class="ktech-dropdown-divider"></div>
            <a href="dashboard.html" class="ktech-dropdown-item" style="text-decoration: none;">
              <span class="material-symbols-outlined" style="font-size:18px">dashboard</span>
              Dashboard
            </a>
            <div class="ktech-dropdown-item" id="signout-btn">
              <span class="material-symbols-outlined" style="font-size:18px">logout</span>
              Sign Out
            </div>
          </div>
        </div>`;

      // Avatar dropdown toggle
      const avatarBtn = document.getElementById("avatar-btn");
      const dropdown = document.getElementById("avatar-dropdown");
      avatarBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("open");
      });
      document.addEventListener("click", () => dropdown.classList.remove("open"));

      // Sign out
      document.getElementById("signout-btn").addEventListener("click", () => {
        dropdown.classList.remove("open");
        signOut(auth).catch(err => console.error(err));
      });
    } else {
      area.innerHTML = `
        <button id="open-login-btn" class="font-label-md text-label-md text-primary border border-primary px-6 py-3 rounded hover:bg-primary/10 hover:scale-[1.02] transition-all duration-300 h-[48px] flex items-center justify-center">
          Login
        </button>`;

      // Wire login button
      document.getElementById("open-login-btn").addEventListener("click", () => openModal(loginModal));
    }
  }

  // ═══════════════════════════════════════════
  // 8. MODAL LOGIC
  // ═══════════════════════════════════════════
  const loginModal = document.getElementById("login-modal");
  const registerModal = document.getElementById("register-modal");

  function openModal(m) { if (m) { m.classList.add("open"); document.body.style.overflow = "hidden"; } }
  function closeModal(m) { if (m) { m.classList.remove("open"); document.body.style.overflow = ""; } }
  function closeAll() { closeModal(loginModal); closeModal(registerModal); }

  // Close buttons
  document.querySelectorAll(".modal-close-btn").forEach(btn =>
    btn.addEventListener("click", closeAll)
  );

  // Backdrop click
  [loginModal, registerModal].forEach(m => {
    if (m) m.addEventListener("click", e => { if (e.target === m) closeAll(); });
  });

  // Escape
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });

  // Switch modals
  document.querySelectorAll(".switch-to-register").forEach(a =>
    a.addEventListener("click", e => { e.preventDefault(); closeModal(loginModal); setTimeout(() => openModal(registerModal), 200); })
  );
  document.querySelectorAll(".switch-to-login").forEach(a =>
    a.addEventListener("click", e => { e.preventDefault(); closeModal(registerModal); setTimeout(() => openModal(loginModal), 200); })
  );

  // Toggle password visibility
  document.querySelectorAll(".toggle-password").forEach(btn =>
    btn.addEventListener("click", () => {
      const input = btn.closest(".relative").querySelector("input");
      const icon = btn.querySelector(".material-symbols-outlined");
      if (input.type === "password") { input.type = "text"; icon.textContent = "visibility_off"; }
      else { input.type = "password"; icon.textContent = "visibility"; }
    })
  );

  // Login form submit
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", e => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;
      signInWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
          closeAll();
          loginForm.reset();
          
          try {
              const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
              if (userDoc.exists() && userDoc.data().role === 'admin') {
                  window.location.href = "admin.html#appointments";
              } else {
                  window.location.href = "dashboard.html#appointments";
              }
          } catch (e) {
              window.location.href = "dashboard.html#appointments";
          }
        })
        .catch(err => showToast("Login failed: " + err.message, 'error'));
    });
  }

  // Register form submit
  const regForm = document.getElementById("register-form");
  if (regForm) {
    regForm.addEventListener("submit", e => {
      e.preventDefault();
      const name = document.getElementById("reg-fullname").value;
      const email = document.getElementById("reg-email").value;
      const password = document.getElementById("reg-password").value;
      createUserWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
          const user = userCredential.user;
          await updateProfile(user, { displayName: name });
          
          // Create user document in Firestore
          await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: name,
            email: email,
            role: 'client',
            createdAt: serverTimestamp()
          });

          return user;
        })
        .then(() => {
          closeAll();
          regForm.reset();
          updateAuthUI(auth.currentUser);
          window.location.href = "dashboard.html#appointments";
        })
        .catch(err => showToast("Registration failed: " + err.message, 'error'));
    });
  }

  // ═══════════════════════════════════════════
  // 9. LISTEN TO AUTH CHANGES
  // ═══════════════════════════════════════════
  onAuthStateChanged(auth, updateAuthUI);

  // ═══════════════════════════════════════════
  // 10. PAGE SPECIFIC LOGIC
  // ═══════════════════════════════════════════
  const heroGetStartedBtn = document.getElementById("hero-get-started-btn");
  if (heroGetStartedBtn) {
    heroGetStartedBtn.addEventListener("click", () => {
      if (auth.currentUser) {
        getDoc(doc(db, "users", auth.currentUser.uid)).then(docSnap => {
            if (docSnap.exists() && docSnap.data().role === 'admin') {
                window.location.href = "admin.html#appointments";
            } else {
                window.location.href = "dashboard.html#appointments";
            }
        }).catch(() => {
            window.location.href = "dashboard.html#appointments";
        });
      } else {
        openModal(loginModal);
      }
    });
  }


