const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Helper: Verify if the caller is an admin (checks custom claim OR Firestore role)
async function isAdmin(context) {
    if (!context.auth) return false;
    // Check custom claim first (fast path)
    if (context.auth.token.admin === true) return true;
    // Fallback: check Firestore user document role
    try {
        const userDoc = await db.collection('users').doc(context.auth.uid).get();
        return userDoc.exists && userDoc.data().role === 'admin';
    } catch (e) {
        return false;
    }
}

// 2. Cascade Update on User Deletion
// When a user is deleted from Firebase Auth, their records are PRESERVED.
// Only active appointments (Pending, WIP, TBD) are auto-cancelled.
// Accomplished and Denied appointments remain untouched.
exports.onUserDeletedTrigger = functions.auth.user().onDelete(async (user) => {
    const uid = user.uid;
    console.log(`User ${uid} deleted. Triggering cleanup cascade...`);

    const batch = db.batch();
    const protectedStatuses = ['Accomplished', 'Denied', 'Cancelled'];

    // 1. Mark only active/pending appointments as Cancelled (preserve Accomplished, Denied, already Cancelled)
    const appointmentsSnapshot = await db.collection('appointments').where('userId', '==', uid).get();
    let cancelledCount = 0;
    let preservedCount = 0;

    appointmentsSnapshot.forEach((doc) => {
        const currentStatus = doc.data().status;
        if (!protectedStatuses.includes(currentStatus)) {
            batch.update(doc.ref, {
                status: 'Cancelled',
                cancelReason: 'User account deleted',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            cancelledCount++;
        } else {
            preservedCount++;
        }
    });

    // 2. Soft-delete: mark user doc as deleted instead of removing it
    // This preserves user info for historical record-keeping
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    if (userDoc.exists) {
        batch.update(userDocRef, {
            isDeleted: true,
            deletedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'deleted'
        });
    }

    await batch.commit();
    console.log(`Cleanup for user ${uid}: ${cancelledCount} appointments cancelled, ${preservedCount} preserved (Accomplished/Denied/Cancelled).`);
});

// 3. Admin User Management (Delete / Change Password / Update Profile)
exports.adminManageUser = functions.https.onCall(async (data, context) => {
    // Verify caller is an admin (custom claim OR Firestore role)
    if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can perform this action.');
    }

    const { action, targetUid, newPassword, displayName, email, disabled } = data;

    try {
        if (action === 'delete') {
            // Deleting from Auth triggers onUserDeletedTrigger which handles the cascade
            await admin.auth().deleteUser(targetUid);
            return { message: `User ${targetUid} deleted successfully. Active appointments have been cancelled.` };

        } else if (action === 'updatePassword') {
            if (!newPassword || newPassword.length < 6) {
                throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters.');
            }
            await admin.auth().updateUser(targetUid, { password: newPassword });
            return { message: `Password updated for user ${targetUid}.` };

        } else if (action === 'updateProfile') {
            const updatePayload = {};
            if (displayName !== undefined) updatePayload.displayName = displayName;
            if (email !== undefined) updatePayload.email = email;
            if (disabled !== undefined) updatePayload.disabled = disabled;

            if (Object.keys(updatePayload).length === 0) {
                throw new functions.https.HttpsError('invalid-argument', 'No fields provided to update.');
            }

            await admin.auth().updateUser(targetUid, updatePayload);

            // Also sync to Firestore user doc
            const firestoreUpdate = {};
            if (displayName !== undefined) firestoreUpdate.name = displayName;
            if (email !== undefined) firestoreUpdate.email = email;
            if (disabled !== undefined) firestoreUpdate.disabled = disabled;
            firestoreUpdate.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await db.collection('users').doc(targetUid).update(firestoreUpdate);

            return { message: `Profile updated for user ${targetUid}.` };

        } else if (action === 'toggleDisable') {
            const userRecord = await admin.auth().getUser(targetUid);
            const newDisabledState = !userRecord.disabled;
            await admin.auth().updateUser(targetUid, { disabled: newDisabledState });
            
            await db.collection('users').doc(targetUid).update({
                disabled: newDisabledState,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return { 
                message: `User ${targetUid} has been ${newDisabledState ? 'disabled' : 'enabled'}.`,
                disabled: newDisabledState
            };

        } else {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid action type.');
        }
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// 4. Admin Get User Details (Auth record + Appointment Analytics)
exports.adminGetUserDetails = functions.https.onCall(async (data, context) => {
    // Verify caller is an admin (custom claim OR Firestore role)
    if (!(await isAdmin(context))) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can perform this action.');
    }

    const { targetUid } = data;
    if (!targetUid) {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid is required.');
    }

    try {
        // 1. Get Auth record (credentials, metadata)
        const userRecord = await admin.auth().getUser(targetUid);

        // 2. Get Firestore user doc
        const userDoc = await db.collection('users').doc(targetUid).get();
        const userData = userDoc.exists ? userDoc.data() : {};

        // 3. Get appointment analytics
        const appointmentsSnapshot = await db.collection('appointments').where('userId', '==', targetUid).get();
        
        const analytics = {
            total: 0,
            pending: 0,
            wip: 0,
            tbd: 0,
            accomplished: 0,
            denied: 0,
            cancelled: 0
        };

        const recentAppointments = [];

        appointmentsSnapshot.forEach((doc) => {
            const appt = doc.data();
            analytics.total++;

            switch (appt.status) {
                case 'Pending': analytics.pending++; break;
                case 'WIP': analytics.wip++; break;
                case 'TBD': analytics.tbd++; break;
                case 'Accomplished': analytics.accomplished++; break;
                case 'Denied': analytics.denied++; break;
                case 'Cancelled': analytics.cancelled++; break;
            }

            recentAppointments.push({
                id: doc.id,
                serviceCategory: appt.serviceCategory || 'N/A',
                status: appt.status || 'Pending',
                createdAt: appt.createdAt ? appt.createdAt.toDate().toISOString() : null
            });
        });

        // Sort recent appointments by date descending
        recentAppointments.sort((a, b) => {
            if (!a.createdAt) return 1;
            if (!b.createdAt) return -1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Calculate completion rate
        const completionRate = analytics.total > 0 
            ? Math.round((analytics.accomplished / analytics.total) * 100) 
            : 0;

        return {
            auth: {
                uid: userRecord.uid,
                email: userRecord.email || null,
                displayName: userRecord.displayName || null,
                photoURL: userRecord.photoURL || null,
                phoneNumber: userRecord.phoneNumber || null,
                disabled: userRecord.disabled,
                emailVerified: userRecord.emailVerified,
                creationTime: userRecord.metadata.creationTime,
                lastSignInTime: userRecord.metadata.lastSignInTime,
                providerData: userRecord.providerData.map(p => ({
                    providerId: p.providerId,
                    email: p.email
                }))
            },
            firestore: {
                role: userData.role || 'client',
                name: userData.name || null,
                email: userData.email || null,
                createdAt: userData.createdAt ? userData.createdAt.toDate().toISOString() : null,
                isDeleted: userData.isDeleted || false
            },
            analytics: {
                ...analytics,
                completionRate: completionRate
            },
            recentAppointments: recentAppointments.slice(0, 10) // Last 10
        };

    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            throw new functions.https.HttpsError('not-found', 'User not found in Firebase Auth.');
        }
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// 5. Notify client when admin changes appointment status
exports.onStatusChangeTrigger = functions.firestore
    .document('appointments/{appointmentId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        // Only fire if the status field actually changed
        if (before.status === after.status) return null;

        const appointmentId = context.params.appointmentId;
        const recipientId = after.userId;
        if (!recipientId) return null;

        const statusMessages = {
            'WIP': 'Your service request is now Work In Progress. Our team has started!',
            'TBD': 'Your service request needs further discussion. We will contact you shortly.',
            'Accomplished': 'Great news! Your service request has been completed.',
            'Denied': 'Your service request has been denied. Please contact us for more information.',
            'Cancelled': 'Your service request has been cancelled.',
            'Pending': 'Your service request has been set back to Pending.',
        };

        const message = statusMessages[after.status] || `Your appointment status changed to: ${after.status}`;

        await db.collection('notifications').add({
            recipientId: recipientId,
            title: `Status Update: ${after.status}`,
            message: message,
            appointmentId: appointmentId,
            type: 'appointment_update',
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Notification sent to user ${recipientId} for status change to ${after.status}`);
        return null;
    });

// 6. Notify recipient when a new message is sent in a chat
exports.onNewMessageTrigger = functions.firestore
    .document('appointments/{appointmentId}/messages/{messageId}')
    .onCreate(async (snap, context) => {
        const message = snap.data();
        const appointmentId = context.params.appointmentId;

        // Get the appointment to find the other party
        const apptDoc = await db.collection('appointments').doc(appointmentId).get();
        if (!apptDoc.exists) return null;
        const appt = apptDoc.data();

        let recipientId;
        let senderLabel;

        if (message.senderRole === 'admin') {
            // Admin sent a message -> notify the client
            recipientId = appt.userId;
            senderLabel = 'KTech Support';
        } else {
            // Client sent a message -> notify admin group
            recipientId = 'admin';
            senderLabel = appt.clientName || 'A client';
        }

        if (!recipientId) return null;

        await db.collection('notifications').add({
            recipientId: recipientId,
            title: `New Message from ${senderLabel}`,
            message: `Re: ${appt.serviceCategory || 'Your request'} — "${message.text.substring(0, 80)}${message.text.length > 80 ? '...' : ''}"`,
            appointmentId: appointmentId,
            type: 'new_message',
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return null;
    });
