/**
 * Lifecycle Synchronizations
 * 
 * These synchronizations coordinate cross-concept lifecycle events:
 * - User registration flow (User -> Profile -> UserHistory)
 * - User deletion cascade (User -> Profile)
 */

import { User, Profile, UserHistory } from "@concepts";
import { actions, Sync } from "@engine";

// ============================================================================
// User Registration Lifecycle
// ============================================================================

/**
 * UserRegistrationLifecycle
 * 
 * Purpose: Automatically create profile and initialize history when a new user registers
 * 
 * When a user successfully registers, this sync:
 * 1. Creates a Profile with default settings
 * 2. Records the account creation in UserHistory
 */
export const UserRegistrationLifecycle: Sync = ({ userId, username }) => ({
  when: actions(
    [User.register, { username }, { userId }],
  ),
  then: actions(
    [Profile.createProfile, { 
      userId, 
      displayName: username, 
      experienceLevel: "beginner" 
    }],
    [UserHistory.recordActivity, { 
      userId, 
      activityType: "account_created", 
      activityData: {}, 
      visibility: "private" 
    }],
  ),
});

// ============================================================================
// User Deletion Cascade
// ============================================================================

/**
 * UserDeletionCascade
 * 
 * Purpose: Clean up related data when a user account is deleted
 * 
 * When a user is deleted, this sync:
 * 1. Deletes their Profile
 * 
 * Note: UserHistory entries are preserved for data integrity,
 * but are marked as belonging to a deleted user.
 * 
 * TODO: This sync is disabled because the User concept doesn't have a deleteUser action yet.
 * To enable user deletion:
 * 1. Add a deleteUser action to UserConcept.ts
 * 2. Uncomment this sync
 */
/*
export const UserDeletionCascade: Sync = ({ userId }) => ({
  when: actions(
    [User.deleteUser, { userId }, { success: true }],
  ),
  then: actions(
    [Profile.deleteProfile, { userId }],
  ),
});
*/

