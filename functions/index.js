const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();



// 2. Cascade Update on User Deletion
exports.onUserDeletedTrigger = functions.auth.user().onDelete(async (user) => {
    const uid = user.uid;
    console.log(`User ${uid} deleted. Triggering cleanup cascade...`);

    const batch = db.batch();

    // 1. Mark all their pending appointments as Cancelled
    const appointmentsSnapshot = await db.collection('appointments').where('userId', '==', uid).get();
    appointmentsSnapshot.forEach((doc) => {
        batch.update(doc.ref, {
            status: 'Cancelled',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    // 2. Delete their user document
    const userDocRef = db.collection('users').doc(uid);
    batch.delete(userDocRef);

    await batch.commit();
    console.log(`Successfully completed cleanup for user: ${uid}`);
});

// 3. Admin User Management (Delete / Change Password)
exports.adminManageUser = functions.https.onCall(async (data, context) => {
    // Verify caller is an admin
    if (!context.auth || context.auth.token.admin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can perform this action.');
    }

    const { action, targetUid, newPassword } = data;

    try {
        if (action === 'delete') {
            await admin.auth().deleteUser(targetUid);
            return { message: `User ${targetUid} deleted successfully.` };
        } else if (action === 'updatePassword') {
            if (!newPassword || newPassword.length < 6) {
                throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters.');
            }
            await admin.auth().updateUser(targetUid, { password: newPassword });
            return { message: `Password updated for user ${targetUid}.` };
        } else {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid action type.');
        }
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// 4. Notify client when admin changes appointment status
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

// 5. Notify recipient when a new message is sent in a chat
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
