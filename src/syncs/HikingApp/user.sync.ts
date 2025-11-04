/**
 * User Concept Synchronizations
 * 
 * These synchronizations handle request/response patterns for User concept actions:
 * - register, login, authenticate, logout, updatePassword, getUserProfile
 */

import { Requesting, User } from "@concepts";
import { actions, Sync } from "@engine";

// ============================================================================
// User.register - Registration Request/Response
// ============================================================================

export const UserRegisterRequest: Sync = ({ request, username, password, email }) => ({
  when: actions([
    Requesting.request,
    { path: "/user/register", username, password, email },
    { request },
  ]),
  then: actions([User.register, { username, password, email }]),
});

export const UserRegisterResponse: Sync = ({ request, userId }) => ({
  when: actions(
    [Requesting.request, { path: "/user/register" }, { request }],
    [User.register, {}, { userId }],
  ),
  then: actions([Requesting.respond, { request, userId }]),
});

export const UserRegisterError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/user/register" }, { request }],
    [User.register, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// User.login - Login Request/Response
// ============================================================================

export const UserLoginRequest: Sync = ({ request, username, password }) => ({
  when: actions([
    Requesting.request,
    { path: "/user/login", username, password },
    { request },
  ]),
  then: actions([User.login, { username, password }]),
});

export const UserLoginResponse: Sync = ({ request, sessionToken, userId }) => ({
  when: actions(
    [Requesting.request, { path: "/user/login" }, { request }],
    [User.login, {}, { sessionToken, userId }],
  ),
  then: actions([Requesting.respond, { request, sessionToken, userId }]),
});

export const UserLoginError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/user/login" }, { request }],
    [User.login, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// User.authenticate - Authentication Request/Response
// ============================================================================

export const UserAuthenticateRequest: Sync = ({ request, sessionToken }) => ({
  when: actions([
    Requesting.request,
    { path: "/user/authenticate", sessionToken },
    { request },
  ]),
  then: actions([User.authenticate, { sessionToken }]),
});

export const UserAuthenticateResponse: Sync = ({ request, userId }) => ({
  when: actions(
    [Requesting.request, { path: "/user/authenticate" }, { request }],
    [User.authenticate, {}, { userId }],
  ),
  then: actions([Requesting.respond, { request, userId }]),
});

export const UserAuthenticateError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/user/authenticate" }, { request }],
    [User.authenticate, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// User.logout - Logout Request/Response
// ============================================================================

export const UserLogoutRequest: Sync = ({ request, sessionToken }) => ({
  when: actions([
    Requesting.request,
    { path: "/user/logout", sessionToken },
    { request },
  ]),
  then: actions([User.logout, { sessionToken }]),
});

export const UserLogoutResponse: Sync = ({ request, success }) => ({
  when: actions(
    [Requesting.request, { path: "/user/logout" }, { request }],
    [User.logout, {}, { success }],
  ),
  then: actions([Requesting.respond, { request, success }]),
});

export const UserLogoutError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/user/logout" }, { request }],
    [User.logout, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// User.updatePassword - Update Password Request/Response
// ============================================================================

export const UserUpdatePasswordRequest: Sync = ({ request, userId, oldPassword, newPassword }) => ({
  when: actions([
    Requesting.request,
    { path: "/user/updatePassword", userId, oldPassword, newPassword },
    { request },
  ]),
  then: actions([User.updatePassword, { userId, oldPassword, newPassword }]),
});

export const UserUpdatePasswordResponse: Sync = ({ request, success }) => ({
  when: actions(
    [Requesting.request, { path: "/user/updatePassword" }, { request }],
    [User.updatePassword, {}, { success }],
  ),
  then: actions([Requesting.respond, { request, success }]),
});

export const UserUpdatePasswordError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/user/updatePassword" }, { request }],
    [User.updatePassword, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ============================================================================
// User.getUserProfile - Get User Profile Request/Response
// ============================================================================

export const UserGetUserProfileRequest: Sync = ({ request, userId }) => ({
  when: actions([
    Requesting.request,
    { path: "/user/getUserProfile", userId },
    { request },
  ]),
  then: actions([User.getUserProfile, { userId }]),
});

export const UserGetUserProfileResponse: Sync = ({ request, username, email, createdAt }) => ({
  when: actions(
    [Requesting.request, { path: "/user/getUserProfile" }, { request }],
    [User.getUserProfile, {}, { username, email, createdAt }],
  ),
  then: actions([Requesting.respond, { request, username, email, createdAt }]),
});

export const UserGetUserProfileError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/user/getUserProfile" }, { request }],
    [User.getUserProfile, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

