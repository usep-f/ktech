/**
 * KTech Solutions — Shared Notification System
 * Call setupNotificationsListener(uid) after a user is authenticated.
 * For admin, pass recipientId = 'admin'.
 */

import { db } from './firebase.js';
import { collection, query, where, onSnapshot, orderBy, writeBatch, doc, limit } from 'firebase/firestore';

/**
 * @param {string} recipientId - The UID for a user, or 'admin' for the admin portal.
 */
export function setupNotificationsListener(recipientId) {
    const bellBtns = Array.from(document.querySelectorAll('.notif-bell-btn, #notif-bell-btn'));
    if (bellBtns.length === 0) return;

    // Toggle panel open/close for each bell
    bellBtns.forEach((bellBtn) => {
        const parent = bellBtn.parentElement;
        const panel = parent?.querySelector('.notif-panel, #notif-panel');
        if (!panel) return;

        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close all other panels first
            bellBtns.forEach((otherBtn) => {
                if (otherBtn !== bellBtn) {
                    const otherPanel = otherBtn.parentElement?.querySelector('.notif-panel, #notif-panel');
                    otherPanel?.classList.remove('open');
                }
            });
            panel.classList.toggle('open');
        });
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
        bellBtns.forEach((bellBtn) => {
            const parent = bellBtn.parentElement;
            const panel = parent?.querySelector('.notif-panel, #notif-panel');
            if (panel && !panel.contains(e.target) && !bellBtn.contains(e.target)) {
                panel.classList.remove('open');
            }
        });
    });

    // Mark all as read
    const markAllBtns = document.querySelectorAll('.mark-all-read-btn, #mark-all-read-btn');
    markAllBtns.forEach((markAllBtn) => {
        markAllBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const snapshot = await new Promise((resolve) => {
                const q = query(
                    collection(db, 'notifications'),
                    where('recipientId', '==', recipientId),
                    where('read', '==', false)
                );
                const unsub = onSnapshot(q, (snap) => {
                    unsub();
                    resolve(snap);
                });
            });

            if (snapshot.empty) return;

            const batch = writeBatch(db);
            snapshot.forEach((docSnap) => {
                batch.update(doc(db, 'notifications', docSnap.id), { read: true });
            });
            await batch.commit();
        });
    });

    // Clear all notifications completely
    const clearAllBtns = document.querySelectorAll('.clear-all-notifs-btn, #clear-all-notifs-btn');
    clearAllBtns.forEach((clearAllBtn) => {
        clearAllBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const snapshot = await new Promise((resolve) => {
                const q = query(
                    collection(db, 'notifications'),
                    where('recipientId', '==', recipientId)
                );
                const unsub = onSnapshot(q, (snap) => {
                    unsub();
                    resolve(snap);
                });
            });

            if (snapshot.empty) return;

            const batch = writeBatch(db);
            snapshot.forEach((docSnap) => {
                batch.delete(doc(db, 'notifications', docSnap.id));
            });
            await batch.commit();
        });
    });

    // Listen for real-time notifications
    const q = query(
        collection(db, 'notifications'),
        where('recipientId', '==', recipientId),
        orderBy('createdAt', 'desc'),
        limit(30)
    );

    onSnapshot(q, (snapshot) => {
        const notifications = [];
        snapshot.forEach((docSnap) => {
            notifications.push({ id: docSnap.id, ...docSnap.data() });
        });

        const unreadCount = notifications.filter(n => !n.read).length;

        // Update each bell widget instance
        bellBtns.forEach((bellBtn) => {
            const parent = bellBtn.parentElement;
            const badge = parent?.querySelector('.notif-badge, #notif-badge');
            const listEl = parent?.querySelector('.notif-list, #notif-list');

            // Update badge
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    badge.classList.add('visible');
                } else {
                    badge.classList.remove('visible');
                }
            }

            // Render list
            if (listEl) {
                if (notifications.length === 0) {
                    listEl.innerHTML = `<p class="text-center text-on-surface-variant font-body-sm py-8 px-4">No notifications yet.</p>`;
                    return;
                }

                listEl.innerHTML = notifications.map(n => {
                    const time = n.createdAt
                        ? new Date(n.createdAt.seconds * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '';
                    const icon = n.type === 'new_message' ? 'chat' : 'info';
                    const statusClass = n.read ? 'read' : 'unread';

                    return `
                    <div class="notif-item ${statusClass}" data-id="${n.id}">
                        <div class="flex items-start gap-3">
                            <span class="material-symbols-outlined text-[18px] mt-0.5 ${n.read ? 'text-outline' : 'text-primary'} shrink-0">${icon}</span>
                            <div class="flex-1 min-w-0">
                                <p class="font-label-md text-[13px] ${n.read ? 'text-on-surface-variant' : 'text-on-surface'} leading-tight">${n.title}</p>
                                <p class="font-body-sm text-[12px] text-on-surface-variant mt-0.5 leading-snug">${n.message}</p>
                                <p class="text-[10px] text-outline mt-1">${time}</p>
                            </div>
                            ${!n.read ? `<div class="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5"></div>` : ''}
                        </div>
                    </div>`;
                }).join('');

                // Click individual notification to mark as read
                listEl.querySelectorAll('.notif-item').forEach(item => {
                    item.addEventListener('click', async () => {
                        const id = item.dataset.id;
                        const notifRef = doc(db, 'notifications', id);
                        const batch = writeBatch(db);
                        batch.update(notifRef, { read: true });
                        await batch.commit();
                        item.classList.replace('unread', 'read');
                    });
                });
            }
        });
    });
}
