import { app, auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, onSnapshot, doc, updateDoc, serverTimestamp, orderBy, getDoc, getDocs, addDoc, deleteDoc, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { showToast, showConfirm, showPrompt } from './toast.js';
import { setupNotificationsListener } from './notifications.js';

const functions = getFunctions(app);
const adminManageUser = httpsCallable(functions, 'adminManageUser');
const adminGetUserDetails = httpsCallable(functions, 'adminGetUserDetails');

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

                // Smoothly remove loading screen
                const loader = document.getElementById('loading-screen');
                if (loader) {
                    loader.style.opacity = '0';
                    setTimeout(() => loader.remove(), 350);
                }
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
    let allUsersData = [];

    function setupUsersListener() {
        const usersTbody = document.getElementById('admin-users-table-body');
        
        onSnapshot(collection(db, "users"), async (snapshot) => {
            if (snapshot.empty) {
                usersTbody.innerHTML = `<tr><td colspan="5" class="px-8 py-6 text-center text-on-surface-variant font-body-md">No users found.</td></tr>`;
                return;
            }

            const users = [];
            snapshot.forEach((doc) => {
                users.push({ id: doc.id, ...doc.data() });
            });
            
            allUsersData = users;
            window.__adminUsers = users;

            // Get appointment counts per user
            const apptSnapshot = await getDocs(collection(db, "appointments"));
            const apptCounts = {};
            apptSnapshot.forEach(d => {
                const uid = d.data().userId;
                if (uid) apptCounts[uid] = (apptCounts[uid] || 0) + 1;
            });

            usersTbody.innerHTML = users.map(user => {
                const joinedDate = user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
                const roleColor = user.role === 'admin' ? 'text-primary bg-primary-container/10 border-primary/20' : 'text-on-surface-variant bg-surface-variant border-outline-variant/30';
                const isDeleted = user.isDeleted === true;
                const deletedBadge = isDeleted ? `<span class="inline-block ml-2 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest bg-error-container/20 text-error border border-error/20">Deleted</span>` : '';
                const apptCount = apptCounts[user.id] || 0;
                
                return `
                <tr class="hover:bg-surface-container-high/20 transition-colors group ${isDeleted ? 'opacity-60' : ''}">
                    <td class="px-8 py-6">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-full bg-surface-container-highest border border-outline-variant/30 flex items-center justify-center text-label-sm text-primary font-bold">
                                ${(user.name || user.email || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p class="font-body-md text-on-surface leading-tight">${user.name || 'Unnamed'}${deletedBadge}</p>
                                <p class="text-[11px] text-outline font-mono">${user.email || 'No email'}</p>
                            </div>
                        </div>
                    </td>
                    <td class="px-8 py-6">
                        <span class="inline-block px-3 py-1 rounded-full text-[10px] uppercase tracking-widest border ${roleColor}">
                            ${user.role || 'client'}
                        </span>
                    </td>
                    <td class="px-8 py-6 text-body-sm text-on-surface-variant">${joinedDate}</td>
                    <td class="px-8 py-6 text-center">
                        <span class="inline-flex items-center gap-1 text-body-sm text-on-surface-variant">
                            <span class="material-symbols-outlined text-[16px]">event_note</span>
                            ${apptCount}
                        </span>
                    </td>
                    <td class="px-8 py-6 text-right">
                        <div class="flex items-center justify-end gap-1">
                            <button onclick="viewUserProfile('${user.id}')" class="text-on-surface-variant hover:text-primary hover:bg-primary-container/10 p-2 rounded-lg transition-colors" title="View Profile">
                                <span class="material-symbols-outlined text-[18px]">person</span>
                            </button>
                            ${user.role !== 'admin' && !isDeleted ? `
                            <button onclick="editUserProfile('${user.id}')" class="text-on-surface-variant hover:text-tertiary hover:bg-tertiary-container/10 p-2 rounded-lg transition-colors" title="Edit User">
                                <span class="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button onclick="deleteUserAccount('${user.id}', '${(user.name || user.email || 'this user').replace(/'/g, "\\'")}')\" class="text-on-surface-variant hover:text-error hover:bg-error-container/10 p-2 rounded-lg transition-colors" title="Delete User">
                                <span class="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                            ` : ''}
                        </div>
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

// ═══════════════════════════════════════════
// 7. USER MANAGEMENT FUNCTIONS
// ═══════════════════════════════════════════

window.viewUserProfile = async (uid) => {
    const modal = document.getElementById('user-profile-modal');
    const content = document.getElementById('user-profile-content');
    if (!modal || !content) return;

    content.innerHTML = `<div class="flex items-center justify-center py-12"><span class="material-symbols-outlined text-primary animate-spin text-4xl">progress_activity</span></div>`;
    modal.classList.add('open');

    try {
        const result = await adminGetUserDetails({ targetUid: uid });
        const data = result.data;
        const a = data.auth;
        const analytics = data.analytics;
        const recent = data.recentAppointments || [];

        const statusColorMap = {
            'Pending': 'bg-surface-variant text-on-surface',
            'WIP': 'bg-primary-container/20 text-primary',
            'TBD': 'bg-tertiary-container/10 text-tertiary',
            'Accomplished': 'bg-secondary-container/20 text-secondary',
            'Denied': 'bg-error-container/10 text-error',
            'Cancelled': 'bg-error-container/10 text-error'
        };

        content.innerHTML = `
            <div class="flex flex-col gap-5">
                <!-- User Header -->
                <div class="flex items-center gap-4 pb-4 border-b border-outline-variant/20">
                    <div class="w-14 h-14 rounded-full bg-surface-container-highest border-2 border-primary/30 flex items-center justify-center text-headline-sm text-primary font-bold">
                        ${(a.displayName || a.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div class="flex-grow">
                        <h3 class="font-headline-sm text-on-surface">${a.displayName || 'Unnamed User'}</h3>
                        <p class="text-body-sm text-on-surface-variant">${a.email || 'No email'}</p>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="inline-block px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest ${a.disabled ? 'bg-error-container/20 text-error border border-error/20' : 'bg-secondary-container/20 text-secondary border border-secondary/20'}">${a.disabled ? 'Disabled' : 'Active'}</span>
                            ${a.emailVerified ? '<span class="inline-block px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest bg-primary-container/10 text-primary border border-primary/20">Verified</span>' : '<span class="inline-block px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest bg-surface-variant text-outline border border-outline-variant/30">Unverified</span>'}
                        </div>
                    </div>
                </div>

                <!-- Auth Credentials -->
                <div class="bg-surface-container p-4 rounded-lg border border-outline-variant/30">
                    <h4 class="font-label-sm text-primary uppercase tracking-widest mb-3 flex items-center gap-2"><span class="material-symbols-outlined text-[16px]">key</span>Credentials</h4>
                    <div class="grid grid-cols-2 gap-3 text-body-sm">
                        <div><p class="text-outline text-[11px]">UID</p><p class="text-on-surface font-mono text-[11px] break-all">${a.uid}</p></div>
                        <div><p class="text-outline text-[11px]">Provider</p><p class="text-on-surface">${a.providerData.map(p => p.providerId).join(', ') || 'N/A'}</p></div>
                        <div><p class="text-outline text-[11px]">Created</p><p class="text-on-surface">${a.creationTime ? new Date(a.creationTime).toLocaleDateString() : 'N/A'}</p></div>
                        <div><p class="text-outline text-[11px]">Last Sign In</p><p class="text-on-surface">${a.lastSignInTime ? new Date(a.lastSignInTime).toLocaleDateString() : 'Never'}</p></div>
                    </div>
                </div>

                <!-- Analytics Summary -->
                <div class="bg-surface-container p-4 rounded-lg border border-outline-variant/30">
                    <h4 class="font-label-sm text-primary uppercase tracking-widest mb-3 flex items-center gap-2"><span class="material-symbols-outlined text-[16px]">analytics</span>Appointment Analytics</h4>
                    <div class="grid grid-cols-4 gap-2 mb-3">
                        <div class="bg-surface-container-lowest p-3 rounded-lg text-center border border-outline-variant/20">
                            <p class="text-headline-sm text-on-surface font-bold">${analytics.total}</p>
                            <p class="text-[10px] text-outline uppercase tracking-widest">Total</p>
                        </div>
                        <div class="bg-surface-container-lowest p-3 rounded-lg text-center border border-outline-variant/20">
                            <p class="text-headline-sm text-secondary font-bold">${analytics.accomplished}</p>
                            <p class="text-[10px] text-outline uppercase tracking-widest">Done</p>
                        </div>
                        <div class="bg-surface-container-lowest p-3 rounded-lg text-center border border-outline-variant/20">
                            <p class="text-headline-sm text-primary font-bold">${analytics.wip + analytics.pending + analytics.tbd}</p>
                            <p class="text-[10px] text-outline uppercase tracking-widest">Active</p>
                        </div>
                        <div class="bg-surface-container-lowest p-3 rounded-lg text-center border border-outline-variant/20">
                            <p class="text-headline-sm text-error font-bold">${analytics.cancelled + analytics.denied}</p>
                            <p class="text-[10px] text-outline uppercase tracking-widest">Closed</p>
                        </div>
                    </div>
                    <!-- Completion Rate Bar -->
                    <div class="mt-2">
                        <div class="flex justify-between text-[11px] text-on-surface-variant mb-1">
                            <span>Completion Rate</span>
                            <span class="text-secondary font-bold">${analytics.completionRate}%</span>
                        </div>
                        <div class="w-full h-2 bg-surface-container-lowest rounded-full overflow-hidden border border-outline-variant/20">
                            <div class="h-full bg-secondary rounded-full transition-all duration-500" style="width:${analytics.completionRate}%"></div>
                        </div>
                    </div>
                </div>

                <!-- Recent Appointments -->
                ${recent.length > 0 ? `
                <div class="bg-surface-container p-4 rounded-lg border border-outline-variant/30">
                    <h4 class="font-label-sm text-primary uppercase tracking-widest mb-3 flex items-center gap-2"><span class="material-symbols-outlined text-[16px]">history</span>Recent Appointments</h4>
                    <div class="flex flex-col gap-2 max-h-[180px] overflow-y-auto">
                        ${recent.map(r => `
                        <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant/10">
                            <div>
                                <p class="text-body-sm text-on-surface">${r.serviceCategory}</p>
                                <p class="text-[10px] text-outline">${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}</p>
                            </div>
                            <span class="inline-block px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest ${statusColorMap[r.status] || 'bg-surface-variant text-on-surface'}">${r.status}</span>
                        </div>
                        `).join('')}
                    </div>
                </div>` : ''}
            </div>
        `;
    } catch (error) {
        console.error('Failed to fetch user details:', error);
        content.innerHTML = `<div class="text-center py-8 text-error"><span class="material-symbols-outlined text-4xl mb-2">error</span><p class="font-body-md">Failed to load user details.</p><p class="text-body-sm text-on-surface-variant mt-1">${error.message || 'Cloud Function may not be deployed yet.'}</p></div>`;
    }
};

window.editUserProfile = async (uid) => {
    const user = (window.__adminUsers || []).find(u => u.id === uid);
    if (!user) return;

    const modal = document.getElementById('edit-user-modal');
    if (!modal) return;

    document.getElementById('edit-user-name').value = user.name || '';
    document.getElementById('edit-user-email').value = user.email || '';
    document.getElementById('edit-user-password').value = '';
    modal.dataset.uid = uid;
    modal.classList.add('open');
};

window.saveUserEdits = async () => {
    const modal = document.getElementById('edit-user-modal');
    const uid = modal?.dataset.uid;
    if (!uid) return;

    const newName = document.getElementById('edit-user-name').value.trim();
    const newEmail = document.getElementById('edit-user-email').value.trim();
    const newPassword = document.getElementById('edit-user-password').value;
    const saveBtn = document.getElementById('save-user-edits-btn');

    if (!newName && !newEmail && !newPassword) {
        showToast('No changes to save.', 'warning');
        return;
    }

    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span> Saving...';
    saveBtn.disabled = true;

    try {
        // Update profile (name/email) via Cloud Function
        if (newName || newEmail) {
            const profilePayload = { action: 'updateProfile', targetUid: uid };
            if (newName) profilePayload.displayName = newName;
            if (newEmail) profilePayload.email = newEmail;
            await adminManageUser(profilePayload);
        }

        // Update password separately if provided
        if (newPassword) {
            if (newPassword.length < 6) {
                showToast('Password must be at least 6 characters.', 'warning');
                return;
            }
            await adminManageUser({ action: 'updatePassword', targetUid: uid, newPassword });
        }

        showToast('User updated successfully.', 'success');
        modal.classList.remove('open');
    } catch (error) {
        console.error('Failed to update user:', error);
        showToast('Failed to update user: ' + (error.message || 'Unknown error'), 'error');
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
};

window.deleteUserAccount = async (uid, name) => {
    const confirmed = await showConfirm(`Are you sure you want to delete "${name}"?\n\nThis will:\n• Remove their authentication account\n• Auto-cancel all active appointments\n• Preserve completed/denied records`);
    if (!confirmed) return;

    try {
        showToast('Deleting user account...', 'info');
        await adminManageUser({ action: 'delete', targetUid: uid });
        showToast('User account deleted. Active appointments have been cancelled.', 'success');
    } catch (error) {
        console.error('Failed to delete user:', error);
        showToast('Failed to delete user: ' + (error.message || 'Unknown error'), 'error');
    }
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
