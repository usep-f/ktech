import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, onSnapshot, doc, updateDoc, serverTimestamp, orderBy, getDoc, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { showToast, showConfirm } from './toast.js';
import { setupNotificationsListener } from './notifications.js';

document.addEventListener('DOMContentLoaded', () => {
    // ═══════════════════════════════════════════
    // 1. ROUTE PROTECTION & ADMIN VERIFICATION
    // ═══════════════════════════════════════════
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.replace('index.html');
            return;
        }

        try {
            // Verify admin status from Firestore
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists() && userDoc.data().role === 'admin') {
                document.getElementById('dashboard-wrapper').style.display = 'flex';
                document.getElementById('sidebar-user-name').textContent = user.displayName || 'Admin';
                
                // Initialize Listeners
                setupAppointmentsListener();
                setupUsersListener();
                setupNotificationsListener('admin');
            } else {
                showToast("Unauthorized. You are not an admin.", "error");
                await signOut(auth);
                window.location.replace('index.html');
            }
        } catch (error) {
            console.error("Auth verification failed:", error);
            window.location.replace('index.html');
        }
    });

    document.getElementById('sidebar-logout-btn')?.addEventListener('click', () => {
        signOut(auth).then(() => window.location.replace('index.html'));
    });

    // ═══════════════════════════════════════════
    // 2. NAVIGATION LOGIC
    // ═══════════════════════════════════════════
    const sections = ['appointments-section', 'users-section', 'export-section'];
    
    function switchTab(targetId) {
        // Hide all sections
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('block');
                el.classList.add('hidden');
            }
        });
        
        // Show target section
        const target = document.getElementById(targetId);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('block');
        }

        // Update Sidebar styling
        document.querySelectorAll('.sidebar-link').forEach(link => {
            if (link.dataset.target === targetId) {
                link.classList.add('sidebar-link-active');
                link.classList.remove('sidebar-link-inactive');
            } else {
                link.classList.remove('sidebar-link-active');
                link.classList.add('sidebar-link-inactive');
            }
        });
        
        // Update Mobile Nav styling
        document.querySelectorAll('.mobile-nav-link').forEach(link => {
            if (link.dataset.target === targetId) {
                link.classList.add('text-primary');
                link.classList.remove('text-on-surface-variant');
            } else {
                link.classList.remove('text-primary');
                link.classList.add('text-on-surface-variant');
            }
        });

        window.location.hash = targetId.split('-')[0];
    }

    // Handle initial hash routing
    if (window.location.hash) {
        const route = window.location.hash.replace('#', '') + '-section';
        if (sections.includes(route)) {
            switchTab(route);
        }
    }

    document.querySelectorAll('.sidebar-link, .mobile-nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = e.currentTarget.dataset.target;
            if (targetId) {
                switchTab(targetId);
            }
        });
    });

    // ═══════════════════════════════════════════
    // 3. APPOINTMENTS LOGIC (Master Schedule)
    // ═══════════════════════════════════════════
    let allAppointmentsData = [];

    function setupAppointmentsListener() {
        const appointmentsTbody = document.getElementById('admin-appointments-table-body');
        
        // Admins can query all appointments globally without a "where" clause restriction.
        const q = query(collection(db, "appointments"));

        onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                appointmentsTbody.innerHTML = `
                    <tr class="hover:bg-surface-container-high/20 transition-colors group">
                        <td colspan="5" class="px-8 py-6 text-center text-on-surface-variant font-body-md">
                            No appointments found.
                        </td>
                    </tr>`;
                return;
            }

            const appointments = [];
            snapshot.forEach((doc) => {
                appointments.push({ id: doc.id, ...doc.data() });
            });

            // Sort descending by creation date locally
            appointments.sort((a, b) => {
                const timeA = a.createdAt?.seconds || 0;
                const timeB = b.createdAt?.seconds || 0;
                return timeB - timeA;
            });

            allAppointmentsData = appointments;
            window.__adminAppointments = appointments; // Expose to global window

            appointmentsTbody.innerHTML = appointments.map(item => {
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

                const displayDate = item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
                // Just use first 8 characters of UID to save space if no email available
                const clientIdentifier = item.userId ? item.userId.substring(0, 8) : 'Unknown';

                return `
                <tr class="hover:bg-surface-container-high/20 transition-colors group">
                    <td class="px-8 py-6 text-body-sm font-mono text-on-surface-variant">
                        ${clientIdentifier}...
                    </td>
                    <td class="px-8 py-6">
                        <div class="flex items-center gap-3">
                            <div class="w-2 h-2 rounded-full ${dotClass}"></div>
                            <span class="font-body-md text-on-surface">${item.serviceCategory || 'Service'}</span>
                        </div>
                    </td>
                    <td class="px-8 py-6 text-body-sm text-on-surface-variant font-mono">${displayDate}</td>
                    <td class="px-8 py-6">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm border cursor-pointer hover:opacity-80 transition-opacity ${statusClass}" onclick="openStatusModal('${item.id}', '${item.status}')" title="Click to Change Status">
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
                            <button onclick="deleteAppointment('${item.id}')" class="w-full text-left px-4 py-3 hover:bg-error-container/20 text-error transition-colors flex items-center gap-2 font-body-sm">
                                <span class="material-symbols-outlined text-[18px]">delete</span> Delete Record
                            </button>
                        </div>
                    </td>
                </tr>
                `;
            }).join('');
        });
    }

    // ═══════════════════════════════════════════
    // 4. USERS LOGIC (Client Management)
    // ═══════════════════════════════════════════
    function setupUsersListener() {
        const usersTbody = document.getElementById('admin-users-table-body');
        
        onSnapshot(collection(db, "users"), (snapshot) => {
            if (snapshot.empty) {
                usersTbody.innerHTML = `<tr><td colspan="4" class="px-8 py-6 text-center text-on-surface-variant font-body-md">No users found.</td></tr>`;
                return;
            }

            const users = [];
            snapshot.forEach((doc) => {
                users.push({ id: doc.id, ...doc.data() });
            });

            usersTbody.innerHTML = users.map(user => {
                const joinedDate = user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
                const roleColor = user.role === 'admin' ? 'text-primary bg-primary-container/10 border-primary/20' : 'text-on-surface-variant bg-surface-variant border-outline-variant/30';
                
                return `
                <tr class="hover:bg-surface-container-high/20 transition-colors group">
                    <td class="px-8 py-6 text-body-sm font-mono text-on-surface">
                        ${user.id}
                        <br><span class="text-[10px] text-outline">${user.email || 'No email provided'}</span>
                    </td>
                    <td class="px-8 py-6">
                        <span class="inline-block px-3 py-1 rounded-full text-[10px] uppercase tracking-widest border ${roleColor}">
                            ${user.role || 'client'}
                        </span>
                    </td>
                    <td class="px-8 py-6 text-body-sm text-on-surface-variant">${joinedDate}</td>
                    <td class="px-8 py-6 text-right">
                        ${user.role !== 'admin' ? `
                        <button onclick="banUser('${user.id}')" class="text-error hover:bg-error-container/20 p-2 rounded-lg transition-colors border border-error/20" title="Delete User">
                            <span class="material-symbols-outlined text-[18px]">block</span>
                        </button>
                        ` : ''}
                    </td>
                </tr>
                `;
            }).join('');
        });
    }

    // ═══════════════════════════════════════════
    // 5. EXPORT LOGIC
    // ═══════════════════════════════════════════
    document.getElementById('export-csv-btn')?.addEventListener('click', () => {
        if (allAppointmentsData.length === 0) {
            showToast("No data to export", "warning");
            return;
        }

        const headers = ["ID", "Client UID", "Service Category", "Specifics", "Status", "Created At"];
        const rows = allAppointmentsData.map(a => {
            const date = a.createdAt ? new Date(a.createdAt.seconds * 1000).toISOString() : '';
            // Escape specifics which may contain commas or newlines
            const specifics = a.specifics ? `"${a.specifics.replace(/"/g, '""').replace(/\n/g, ' ')}"` : '""';
            return [
                a.id,
                a.userId || '',
                `"${a.serviceCategory || ''}"`,
                specifics,
                a.status || 'Pending',
                date
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `KTech_Appointments_Export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("Export successful!", "success");
    });
});

// ═══════════════════════════════════════════
// 6. GLOBAL FUNCTIONS (Admin Actions)
// ═══════════════════════════════════════════
document.addEventListener('click', (e) => {
    if (!e.target.closest('td.relative')) {
        document.querySelectorAll('[id^="menu-"]').forEach(menu => {
            menu.classList.add('hidden');
        });
    }
});

window.toggleMenu = (id) => {
    document.querySelectorAll('[id^="menu-"]').forEach(menu => {
        if (menu.id !== `menu-${id}`) menu.classList.add('hidden');
    });
    const menu = document.getElementById(`menu-${id}`);
    if (menu) menu.classList.toggle('hidden');
};

let currentStatusApptId = null;
window.openStatusModal = (id, currentStatus) => {
    currentStatusApptId = id;
    const select = document.getElementById('new-status-select');
    if (select) {
        select.value = currentStatus || 'Pending';
    }
    document.getElementById('status-modal').classList.add('open');
};

document.getElementById('save-status-btn')?.addEventListener('click', async () => {
    if (!currentStatusApptId) return;
    const select = document.getElementById('new-status-select');
    const newStatus = select.value;
    
    try {
        await updateDoc(doc(db, "appointments", currentStatusApptId), {
            status: newStatus,
            updatedAt: serverTimestamp()
        });
        showToast("Status successfully updated to " + newStatus, "success");
        document.getElementById('status-modal').classList.remove('open');
    } catch (error) {
        console.error(error);
        showToast("Failed to update status: " + error.message, "error");
    }
});

window.viewAppointment = (id) => {
    const appt = (window.__adminAppointments || []).find(a => a.id === id);
    if (!appt) return;

    const modal = document.getElementById('appt-details-modal');
    const content = document.getElementById('appt-details-content');
    
    content.innerHTML = `
        <div class="flex flex-col gap-4">
            <div class="bg-surface-container p-4 rounded-lg border border-outline-variant/30">
                <p class="font-label-sm text-outline mb-1">Client UID</p>
                <p class="font-mono text-xs text-on-surface">${appt.userId}</p>
            </div>
            <div class="bg-surface-container p-4 rounded-lg border border-outline-variant/30">
                <p class="font-label-sm text-outline mb-1">Service Category</p>
                <p class="font-body-md text-on-surface">${appt.serviceCategory}</p>
            </div>
            <div class="bg-surface-container p-4 rounded-lg border border-outline-variant/30 max-h-[150px] overflow-y-auto">
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

window.deleteAppointment = async (id) => {
    const confirmed = await showConfirm("Are you sure you want to completely delete this record? This action cannot be undone.");
    if (confirmed) {
        try {
            await deleteDoc(doc(db, "appointments", id));
            showToast("Record deleted successfully.", "success");
        } catch (error) {
            console.error(error);
            showToast("Failed to delete record.", "error");
        }
    }
};

window.banUser = async (uid) => {
    // In Phase 3, we would call the Cloud Function adminManageUser
    // For now, we will notify the admin that it's disabled.
    showToast("User deletion requires Cloud Function trigger implementation on frontend.", "info");
};

// Global chat variables
let currentChatApptId = null;
let currentChatUnsubscribe = null;

window.openChat = async (id, title) => {
    currentChatApptId = id;
    document.getElementById('chat-subtitle').textContent = `Re: ${title}`;
    const modal = document.getElementById('chat-modal');
    const msgContainer = document.getElementById('chat-messages-container');
    
    modal.classList.add('open');
    msgContainer.innerHTML = `<div class="text-center text-on-surface-variant font-body-sm py-4">Loading messages...</div>`;

    if (currentChatUnsubscribe) {
        currentChatUnsubscribe();
    }

    const q = query(collection(db, "appointments", id, "messages"), orderBy("createdAt", "asc"));

    currentChatUnsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            msgContainer.innerHTML = `<div class="text-center text-on-surface-variant font-body-sm py-4">No correspondence yet. Reply to start the conversation.</div>`;
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
                <span class="text-[10px] text-outline mt-1 px-1">${isMe ? 'Admin' : 'Client'} • ${time}</span>
            </div>
            `;
        }).join('');

        msgContainer.scrollTop = msgContainer.scrollHeight;
    }, (error) => {
        console.error("Chat error:", error);
        msgContainer.innerHTML = `<div class="text-center text-error font-body-sm py-4">Failed to load messages.</div>`;
    });
};

document.getElementById('chat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !currentChatApptId) return;

    input.value = '';

    try {
        await addDoc(collection(db, "appointments", currentChatApptId, "messages"), {
            senderId: auth.currentUser.uid,
            senderRole: 'admin',
            text: text,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Message send error:", error);
        showToast("Failed to send message", "error");
    }
});
