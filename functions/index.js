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
