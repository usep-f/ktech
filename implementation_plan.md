# KTech Solutions: Full System Implementation Plan

This document outlines the end-to-end architecture and phased implementation strategy for the Admin Dashboard, User Dashboard improvements, and Firebase Cloud Functions backend.

## 1. System Architecture & Data Models

The system relies on Firebase Authentication, Cloud Firestore, Cloud Storage, and Cloud Functions. Below are the core database schemas:

### Firestore Collections
*   **`users/{uid}`**
    *   `uid` (string)
    *   `name` (string)
    *   `email` (string)
    *   `role` (string: `'client'` | `'admin'`)
    *   `createdAt` (timestamp)
*   **`appointments/{appointmentId}`**
    *   `userId` (string)
    *   `clientName` (string)
    *   `serviceType` (string)
    *   `description` (string)
    *   `filePath` (string - Storage URI)
    *   `status` (string: `'Pending'` | `'Denied'` | `'TBD'` | `'WIP'` | `'Accomplished'` | `'Cancelled'`)
    *   `createdAt` (timestamp)
*   **`appointments/{appointmentId}/messages/{messageId}`** *(Subcollection for Correspondence)*
    *   `senderId` (string)
    *   `senderRole` (string)
    *   `text` (string)
    *   `createdAt` (timestamp)
*   **`notifications/{notificationId}`**
    *   `recipientId` (string: user uid OR `'admin_group'`)
    *   `title` (string)
    *   `message` (string)
    *   `read` (boolean)
    *   `type` (string: `'appointment_update'` | `'new_message'` | `'system'`)
    *   `createdAt` (timestamp)

---

## 2. Implementation Phases

### Phase 1: Backend & Security Foundation (Cloud Functions)
This phase establishes the secure environment and automated server-side logic required for an enterprise application.
1.  **Initialize Cloud Functions**: Set up the Node.js environment via `firebase init functions`.
2.  **Custom Claims Script**: Write a one-off script to assign the `admin: true` Custom Claim to your designated admin email address.
3.  **Update Security Rules**:
    *   `firestore.rules`: Allow users to read/write their own data; allow admins global access.
    *   `storage.rules`: Allow admins to read all files in the `appointments/` directory.
4.  **Deploy Cloud Functions**:
    *   `adminManageUser`: A callable function allowing an admin to change a user's password or delete them from Firebase Auth.
    *   `onUserDeletedTrigger`: Automatically catches when a user is deleted and cascades a status update (`Cancelled`) to all their pending appointments.
    *   `onStatusChangeTrigger`: Listens for changes to an appointment's status and automatically generates a Notification document for the client.
    *   `onMessageSentTrigger`: Generates notifications for either the admin or the client when a new chat message is sent.

### Phase 2: User Dashboard Enhancements
This phase modernizes the client-facing UI to support the new data structures and interactive capabilities.
1.  **Notification System**:
    *   Build a notification bell icon with an unread counter.
    *   Create a dropdown or modal displaying real-time updates from the `notifications` collection.
2.  **Appointment Cards (3-Dots Menu)**:
    *   Add an interactive ellipsis menu to each appointment card.
    *   **View Service**: Opens a modal summarizing the initial request and current status.
    *   **Cancel Service**: Updates the document status to `Cancelled` (triggering an admin notification).
    *   **Check Message**: Opens a dedicated real-time chat interface connected to the `messages` subcollection for that specific appointment.
3.  **Account Deletion Flow**:
    *   Add a secure "Delete Account" button in the Profile tab.
    *   Require password re-authentication before deletion.

### Phase 3: Admin Dashboard (`admin.html`)
This phase creates a completely isolated and secure interface for internal management.
1.  **Secure Layout & Routing**:
    *   Create `admin.html` and `admin.js`.
    *   Implement strict client-side routing that kicks out any user without the `admin` role/claim.
2.  **Appointments Management Tab**:
    *   Build a comprehensive Data Table.
    *   Implement sorting and filtering by the 6 distinct statuses.
    *   Add controls to change an appointment's status, download the user's uploaded files, and open the correspondence chat interface.
3.  **User Management Tab**:
    *   Display a paginated list of all users.
    *   Integrate with the `adminManageUser` Cloud Function to allow password resets and account bans/deletions directly from the UI.

### Phase 4: Data Archiving & Maintenance
This phase introduces tools to keep the database lightweight and performant over time.
1.  **CSV Export Engine**:
    *   Implement a JavaScript library (like PapaParse or vanilla JS) to convert filtered appointment data into a downloadable `.csv` file.
2.  **Purge Collection Protocol**:
    *   Add an "Archive & Clear" button for admins.
    *   Write logic that securely deletes `Accomplished` or `Cancelled` appointments from Firestore and Cloud Storage after the CSV has been successfully generated.
