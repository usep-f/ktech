import { auth, db, storage } from './firebase.js';
import { onAuthStateChanged, updateProfile, updatePassword, signOut, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc, collection, addDoc, query, where, onSnapshot, serverTimestamp, deleteDoc, orderBy, getDoc, writeBatch, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { showToast, showConfirm, showPrompt } from './toast.js';
import { setupNotificationsListener } from './notifications.js';

document.addEventListener('DOMContentLoaded', () => {
    // ═══════════════════════════════════════════
    // 1. ROUTE PROTECTION & AUTH STATE
    // ═══════════════════════════════════════════
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            // User is not logged in, redirect to home
            window.location.replace('index.html');
        } else {
            // User is logged in, show dashboard and populate data
            document.getElementById('dashboard-wrapper').style.display = 'flex';
            const notifWidget = document.getElementById('global-notif-widget');
            if (notifWidget) notifWidget.style.display = 'block';
            populateUserData(user);
            setupHistoryListener(user.uid);
            setupNotificationsListener(user.uid);

            // Smoothly remove loading screen
            const loader = document.getElementById('loading-screen');
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.remove(), 350);
            }
        }
    });

    // ═══════════════════════════════════════════
    // 2. SIDEBAR NAVIGATION LOGIC
    // ═══════════════════════════════════════════
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    const tabSections = document.querySelectorAll('.tab-section');

    function switchTab(targetId) {
        // Hide all sections
        tabSections.forEach(section => {
            section.classList.add('hidden');
            section.classList.remove('block');
        });

        // Show target section
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.remove('hidden');
            targetSection.classList.add('block');
        }

        // Update Desktop Sidebar active states
        sidebarLinks.forEach(link => {
            if (link.dataset.target === targetId) {
                link.classList.add('sidebar-link-active');
                link.classList.remove('sidebar-link-inactive');
            } else {
                link.classList.remove('sidebar-link-active');
                link.classList.add('sidebar-link-inactive');
            }
        });

        // Update Mobile Nav active states
        mobileNavLinks.forEach(link => {
            if (link.dataset.target === targetId) {
                link.classList.add('text-primary-container');
                link.classList.remove('text-on-surface-variant');
            } else {
                link.classList.remove('text-primary-container');
                link.classList.add('text-on-surface-variant');
            }
        });

        // Update URL hash
        const hashMapping = {
            'appointments-section': '#appointments',
            'history-section': '#history',
            'profile-section': '#profile'
        };
        if(hashMapping[targetId]) {
            window.history.replaceState(null, null, hashMapping[targetId]);
        }
    }

    // Attach click listeners to sidebar
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(link.dataset.target);
        });
    });

    // Attach click listeners to mobile nav
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(link.dataset.target);
        });
    });

    // Read initial hash from URL to open correct tab
    const initialHash = window.location.hash;
    if (initialHash === '#appointments') {
        switchTab('appointments-section');
    } else if (initialHash === '#history') {
        switchTab('history-section');
    } else {
        // Default to profile
        switchTab('profile-section');
    }

    // ═══════════════════════════════════════════
    // 3. PROFILE MANAGEMENT LOGIC
    // ═══════════════════════════════════════════
    function populateUserData(user) {
        // Sidebar
        const nameDisplay = user.displayName || 'User';
        const initial = nameDisplay.charAt(0).toUpperCase();
        document.getElementById('sidebar-user-name').textContent = nameDisplay;
        document.getElementById('sidebar-avatar-initial').textContent = initial;

        // Form
        document.getElementById('profile-name').value = user.displayName || '';
        document.getElementById('profile-email').value = user.email || '';
    }

    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = document.getElementById('profile-name').value;
            const newPassword = document.getElementById('profile-password').value;
            const user = auth.currentUser;

            if (!user) return;

            try {
                if (newName !== user.displayName) {
                    await updateProfile(user, { displayName: newName });
                    // Also update the user document in Firestore
                    const userRef = doc(db, "users", user.uid);
                    await updateDoc(userRef, { name: newName });
                    
                    populateUserData(user); // refresh UI
                    showToast('Profile name updated successfully.', 'success');
                }
                
                if (newPassword.trim() !== '') {
                    if (newPassword.length < 8) {
                        showToast('Password must be at least 8 characters long.', 'error');
                        return;
                    }
                    await updatePassword(user, newPassword);
                    showToast('Password updated successfully.', 'success');
                    document.getElementById('profile-password').value = '';
                }
            } catch (error) {
                showToast('Error updating profile: ' + error.message, 'error');
            }
        });
    }

    document.getElementById('sidebar-logout-btn')?.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.replace('index.html');
        });
    });

    document.getElementById('delete-account-btn')?.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) return;
        const confirmDelete = await showConfirm('Are you sure you want to delete your account? This action cannot be undone.');
        if (!confirmDelete) return;

        const password = await showPrompt('Please enter your password to confirm account deletion:', 'password');
        if (!password) return;

        try {
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            
            // Delete user doc from Firestore
            try {
                await deleteDoc(doc(db, "users", user.uid));
            } catch(e) {
                console.warn("Could not delete user doc", e);
            }

            await deleteUser(user);
            showToast('Your account has been deleted.', 'success');
            window.location.replace('index.html');
        } catch (error) {
            showToast('Error deleting account: ' + error.message, 'error');
        }
    });

    // ═══════════════════════════════════════════
    // 4. APPOINTMENT LOGIC & FILE UPLOADS
    // ═══════════════════════════════════════════
    const serviceSelect = document.getElementById('appt-service');
    const startDateInput = document.getElementById('appt-start-date');
    const endDateInput = document.getElementById('appt-end-date');
    const fileInput = document.getElementById('appt-file-upload');
    const fileListDisplay = document.getElementById('appt-file-list');
    let selectedFiles = [];

    // File selection handling
    fileInput?.addEventListener('change', (e) => {
        selectedFiles = Array.from(e.target.files);
        updateFileListUI();
        updateSummary();
    });

    function updateFileListUI() {
        if (!fileListDisplay) return;
        fileListDisplay.innerHTML = selectedFiles.map((f, index) => `
            <div class="flex items-center justify-between bg-surface-container p-2 rounded border border-outline-variant/30 w-full" onclick="event.preventDefault(); event.stopPropagation();">
                <span class="text-label-sm text-on-surface truncate">${f.name}</span>
                <button type="button" class="text-error hover:text-error-container material-symbols-outlined text-[16px]" onclick="removeFile(${index})">close</button>
            </div>
        `).join('');
    }

    window.removeFile = function(index) {
        selectedFiles.splice(index, 1);
        updateFileListUI();
        updateSummary();
    };

    function updateSummary() {
        if (!serviceSelect || !startDateInput || !endDateInput) return;

        const service = serviceSelect.value;
        let dates = 'Select dates';
        
        if (startDateInput.value && endDateInput.value) {
            dates = `${startDateInput.value} — ${endDateInput.value}`;
        } else if (startDateInput.value) {
            dates = `Starts: ${startDateInput.value}`;
        }

        document.getElementById('summary-service').textContent = service;
        document.getElementById('summary-dates').textContent = dates;
        
        const attachEl = document.getElementById('summary-attachments');
        if (attachEl) {
            attachEl.textContent = `${selectedFiles.length} Files Provided`;
        }
    }

    serviceSelect?.addEventListener('change', updateSummary);
    startDateInput?.addEventListener('change', updateSummary);
    endDateInput?.addEventListener('change', updateSummary);

    // Book appointment (Write to Firestore)
    const bookApptBtn = document.getElementById('book-appt-btn');
    bookApptBtn?.addEventListener('click', async () => {
        if (!startDateInput.value) {
            showToast('Please select a start date.', 'warning');
            return;
        }

        const user = auth.currentUser;
        if (!user) return;

        // Visual feedback
        const originalText = bookApptBtn.innerHTML;
        bookApptBtn.innerHTML = 'Submitting...';
        bookApptBtn.disabled = true;

        try {
            // Upload files if any
            const fileUrls = [];
            for (const file of selectedFiles) {
                const fileRef = ref(storage, `appointments/${user.uid}/${Date.now()}_${file.name}`);
                const snapshot = await uploadBytes(fileRef, file);
                const url = await getDownloadURL(snapshot.ref);
                fileUrls.push({ name: file.name, url: url });
            }

            const specifics = document.getElementById('appt-specifics').value;
            await addDoc(collection(db, "appointments"), {
                userId: user.uid,
                userName: user.displayName || user.email,
                userEmail: user.email,
                serviceCategory: serviceSelect.value,
                technicalSpecifics: specifics,
                attachments: fileUrls,
                startDate: startDateInput.value,
                endDate: endDateInput.value || null,
                status: 'Pending',
                createdAt: serverTimestamp()
            });

            showToast('Appointment request submitted successfully!', 'success');
            
            // Reset form
            startDateInput.value = '';
            endDateInput.value = '';
            document.getElementById('appt-specifics').value = '';
            selectedFiles = [];
            if(fileInput) fileInput.value = '';
            updateFileListUI();
            updateSummary();

            // Optionally switch to history tab
            switchTab('history-section');
        } catch (error) {
            showToast('Error submitting appointment: ' + error.message, 'error');
        } finally {
            bookApptBtn.innerHTML = originalText;
            bookApptBtn.disabled = false;
        }
    });

    // ═══════════════════════════════════════════
    // 5. HISTORY DATA FETCHING (Firestore Real-time)
    // ═══════════════════════════════════════════
    function setupHistoryListener(userId) {
        const historyTbody = document.getElementById('history-table-body');
        if (!historyTbody) return;

        const q = query(
            collection(db, "appointments"), 
            where("userId", "==", userId)
            // Note: to use orderBy("createdAt", "desc") with where(), you may need a composite index in Firestore.
            // For now, we'll fetch and sort in memory if needed, or rely on default ordering.
        );

        onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                historyTbody.innerHTML = `
                    <tr class="hover:bg-surface-container-high/20 transition-colors group">
                        <td colspan="4" class="px-8 py-6 text-center text-on-surface-variant font-body-md">
                            No appointments found.
                        </td>
                    </tr>`;
                return;
            }

            const appointments = [];
            snapshot.forEach((doc) => {
                appointments.push({ id: doc.id, ...doc.data() });
            });

            // Sort by createdAt descending locally
            appointments.sort((a, b) => {
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
                return timeB - timeA;
            });

            // Make appointments array globally accessible for the modal functions
            window.__appointments = appointments;

            historyTbody.innerHTML = appointments.map(item => {
                let statusClass = '';
                let dotClass = '';
                let icon = '';

                switch (item.status) {
                    case 'Accomplished':
                        statusClass = 'bg-secondary-container/20 text-secondary border-secondary/20';
                        dotClass = 'bg-secondary';
                        icon = 'check_circle';
                        break;
                    case 'WIP':
                        statusClass = 'bg-primary-container/20 text-primary border-primary/20';
                        dotClass = 'bg-primary animate-pulse';
                        icon = 'build';
                        break;
                    case 'TBD':
                        statusClass = 'bg-tertiary-container/10 text-tertiary border-tertiary/20';
                        dotClass = 'bg-tertiary';
                        icon = 'chat_bubble';
                        break;
                    case 'Denied':
                    case 'Cancelled':
                        statusClass = 'bg-error-container/10 text-error border-error/20';
                        dotClass = 'bg-error';
                        icon = 'cancel';
                        break;
                    default: // Pending
                        statusClass = 'bg-surface-variant text-on-surface border-outline-variant';
                        dotClass = 'bg-outline';
                        icon = 'schedule';
                        break;
                }

                // Format Date safely
                let displayDate = 'Just now';
                if (item.createdAt && typeof item.createdAt.toDate === 'function') {
                    const d = item.createdAt.toDate();
                    displayDate = d.toISOString().split('T')[0] + ' | ' + d.toTimeString().split(' ')[0].substring(0, 5);
                } else if (item.createdAt && item.createdAt.seconds) {
                    const d = new Date(item.createdAt.seconds * 1000);
                    displayDate = d.toISOString().split('T')[0] + ' | ' + d.toTimeString().split(' ')[0].substring(0, 5);
                }

                return `
                <tr class="hover:bg-surface-container-high/20 transition-colors group">
                    <td class="px-8 py-6">
                        <div class="flex items-center gap-3">
                            <div class="w-2 h-2 rounded-full ${dotClass}"></div>
                            <span class="font-body-md text-on-surface">${item.serviceCategory || 'Service'}</span>
                        </div>
                    </td>
                    <td class="px-8 py-6 text-body-sm text-on-surface-variant font-mono">${displayDate}</td>
                    <td class="px-8 py-6">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm border ${statusClass}">
                            <span class="material-symbols-outlined text-[14px]">${icon}</span>
                            ${item.status || 'Pending'}
                        </span>
                    </td>
                    <td class="px-8 py-6 text-right relative">
                        <button class="text-on-surface-variant hover:text-primary transition-colors focus:outline-none" onclick="toggleMenu('${item.id}')">
                            <span class="material-symbols-outlined">more_vert</span>
                        </button>
                        <div id="menu-${item.id}" class="hidden absolute right-8 top-12 w-48 bg-surface-container-high border border-outline-variant/50 rounded-lg shadow-xl z-50 overflow-hidden text-left">
                            <button onclick="viewAppointment('${item.id}')" class="w-full text-left px-4 py-3 hover:bg-surface-variant/30 text-on-surface transition-colors flex items-center gap-2 font-body-sm border-b border-outline-variant/30">
                                <span class="material-symbols-outlined text-[18px]">visibility</span> View Service
                            </button>
                            <button onclick="openChat('${item.id}', '${item.serviceCategory || 'Service'}')" class="w-full text-left px-4 py-3 hover:bg-surface-variant/30 text-on-surface transition-colors flex items-center gap-2 font-body-sm border-b border-outline-variant/30">
                                <span class="material-symbols-outlined text-[18px]">chat</span> Check Message
                            </button>
                            ${item.status !== 'Cancelled' && item.status !== 'Accomplished' ? `
                            <button onclick="cancelAppointment('${item.id}')" class="w-full text-left px-4 py-3 hover:bg-error-container/20 text-error transition-colors flex items-center gap-2 font-body-sm">
                                <span class="material-symbols-outlined text-[18px]">cancel</span> Cancel Service
                            </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
                `;
            }).join('');
        }, (error) => {
            console.error("Error fetching appointments:", error);
            historyTbody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-8 py-6 text-center text-error">
                        Failed to load history.
                    </td>
                </tr>`;
        });
    }
});

// ═══════════════════════════════════════════
// 6. GLOBAL FUNCTIONS (Modals & Actions)
// ═══════════════════════════════════════════

// Click outside to close menus
document.addEventListener('click', (e) => {
    if (!e.target.closest('td.relative')) {
        document.querySelectorAll('[id^="menu-"]').forEach(menu => {
            menu.classList.add('hidden');
        });
    }
});

window.toggleMenu = (id) => {
    // Hide all other menus first
    document.querySelectorAll('[id^="menu-"]').forEach(menu => {
        if (menu.id !== `menu-${id}`) menu.classList.add('hidden');
    });
    // Toggle targeted menu
    const menu = document.getElementById(`menu-${id}`);
    if (menu) {
        menu.classList.toggle('hidden');
    }
};

window.viewAppointment = (id) => {
    const appt = (window.__appointments || []).find(a => a.id === id);
    if (!appt) return;

    const modal = document.getElementById('appt-details-modal');
    const content = document.getElementById('appt-details-content');
    
    content.innerHTML = `
        <div class="flex flex-col gap-4">
            <div class="bg-surface-container p-4 rounded-lg border border-outline-variant/30">
                <p class="font-label-sm text-outline mb-1">Service Category</p>
                <p class="font-body-md text-on-surface">${appt.serviceCategory}</p>
            </div>
            <div class="bg-surface-container p-4 rounded-lg border border-outline-variant/30">
                <p class="font-label-sm text-outline mb-1">Technical Specifics</p>
                <p class="font-body-md text-on-surface whitespace-pre-wrap">${appt.specifics || 'No additional details provided.'}</p>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-surface-container p-4 rounded-lg border border-outline-variant/30">
                    <p class="font-label-sm text-outline mb-1">Status</p>
                    <p class="font-body-md text-on-surface font-bold">${appt.status || 'Pending'}</p>
                </div>
                <div class="bg-surface-container p-4 rounded-lg border border-outline-variant/30">
                    <p class="font-label-sm text-outline mb-1">Date Requested</p>
                    <p class="font-body-md text-on-surface">${appt.createdAt ? new Date(appt.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</p>
                </div>
            </div>
        </div>
    `;
    modal.classList.add('open');
};

window.cancelAppointment = async (id) => {
    const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
    const { db } = await import('./firebase.js');
    const { showConfirm, showToast } = await import('./toast.js');

    const confirmed = await showConfirm("Are you sure you want to cancel this service request?");
    if (confirmed) {
        try {
            await updateDoc(doc(db, "appointments", id), {
                status: 'Cancelled',
                updatedAt: serverTimestamp()
            });
            showToast("Service successfully cancelled.");
        } catch (error) {
            console.error("Cancel error:", error);
            showToast("Failed to cancel: " + error.message, "error");
        }
    }
};

// Global chat variables
let currentChatApptId = null;
let currentChatUnsubscribe = null;

window.openChat = async (id, title) => {
    const { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } = await import('firebase/firestore');
    const { auth, db } = await import('./firebase.js');
    
    currentChatApptId = id;
    document.getElementById('chat-subtitle').textContent = `Re: ${title}`;
    const modal = document.getElementById('chat-modal');
    const msgContainer = document.getElementById('chat-messages-container');
    
    modal.classList.add('open');
    msgContainer.innerHTML = `<div class="text-center text-on-surface-variant font-body-sm py-4">Loading messages...</div>`;

    // Unsubscribe from previous listener if any
    if (currentChatUnsubscribe) {
        currentChatUnsubscribe();
    }

    // Set up real-time listener for messages
    const q = query(
        collection(db, "appointments", id, "messages"),
        orderBy("createdAt", "asc")
    );

    currentChatUnsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            msgContainer.innerHTML = `<div class="text-center text-on-surface-variant font-body-sm py-4">No correspondence yet. Send a message to begin.</div>`;
            return;
        }

        const messages = [];
        snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));

        msgContainer.innerHTML = messages.map(msg => {
            const isMe = msg.senderId === auth.currentUser.uid;
            const time = msg.createdAt ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sending...';
            
            return `
            <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} w-full mb-2">
                <div class="px-4 py-3 rounded-2xl max-w-[80%] ${isMe ? 'bg-primary text-on-primary rounded-tr-sm' : 'bg-surface-container-high text-on-surface rounded-tl-sm border border-outline-variant/30'}">
                    <p class="font-body-md whitespace-pre-wrap">${msg.text}</p>
                </div>
                <span class="text-[10px] text-outline mt-1 px-1">${isMe ? 'You' : 'Admin'} • ${time}</span>
            </div>
            `;
        }).join('');

        // Auto-scroll to bottom
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }, (error) => {
        console.error("Chat error:", error);
        msgContainer.innerHTML = `<div class="text-center text-error font-body-sm py-4">Failed to load messages.</div>`;
    });
};

// Handle Chat Form Submission
document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            const text = input.value.trim();
            if (!text || !currentChatApptId) return;

            input.value = '';
            const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
            const { auth, db } = await import('./firebase.js');

            try {
                await addDoc(collection(db, "appointments", currentChatApptId, "messages"), {
                    senderId: auth.currentUser.uid,
                    senderRole: 'client',
                    text: text,
                    createdAt: serverTimestamp()
                });
            } catch (error) {
                console.error("Message send error:", error);
                const { showToast } = await import('./toast.js');
                showToast("Failed to send message", "error");
            }
        });
    }

});
