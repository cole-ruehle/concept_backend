import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

/**
 * User concept
 * 
 * **purpose**: Enable users to maintain authenticated state across multiple requests 
 * without repeatedly providing credentials
 * 
 * **principle**: After a user authenticates with valid credentials, the system creates 
 * a session; subsequent requests using that session are associated with the authenticated 
 * user until the session is explicitly ended or expires
 */

// Collection prefix
const PREFIX = "User.";

// Generic types
type User = ID;
type Session = ID;

/**
 * a set of Users with
 *   username String
 *   passwordHash String
 *   email String
 *   createdAt Date
 */
interface Users {
  _id: User;
  username: string;
  passwordHash: string;
  email: string;
  createdAt: Date;
}

/**
 * a set of Sessions with
 *   userId (reference to User)
 *   token String
 *   createdAt Date
 *   expiresAt Date
 *   lastAccessedAt Date
 */
interface Sessions {
  _id: Session;
  userId: User;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  lastAccessedAt: Date;
}

export default class UserConcept {
  users: Collection<Users>;
  sessions: Collection<Sessions>;

  constructor(private readonly db: Db) {
    this.users = this.db.collection(PREFIX + "users");
    this.sessions = this.db.collection(PREFIX + "sessions");

    // Create indexes
    this.users.createIndex({ username: 1 }, { unique: true });
    this.users.createIndex({ email: 1 }, { unique: true });
    this.sessions.createIndex({ token: 1 }, { unique: true });
    this.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  }

  /**
   * register(username: String, password: String, email: String): (userId: String)
   * 
   * **requires** username is not already taken, username length >= 3, password length >= 8, 
   * email is valid format
   * 
   * **effects** creates new User with hashed password, generates unique userId, returns userId
   */
  async register({ username, password, email }: { 
    username: string; 
    password: string; 
    email: string 
  }): Promise<{ userId: string } | { error: string }> {
    // Validate inputs
    if (!username || username.length < 3) {
      return { error: "Username must be at least 3 characters long" };
    }
    if (!password || password.length < 8) {
      return { error: "Password must be at least 8 characters long" };
    }
    if (!email || !this.isValidEmail(email)) {
      return { error: "Invalid email format" };
    }

    // Check if username already exists
    const existingUser = await this.users.findOne({ username });
    if (existingUser) {
      return { error: "Username already taken" };
    }

    // Check if email already exists
    const existingEmail = await this.users.findOne({ email });
    if (existingEmail) {
      return { error: "Email already registered" };
    }

    // Hash password (using bcrypt-like approach)
    const passwordHash = await this.hashPassword(password);

    // Create new user
    const userId = freshID();
    await this.users.insertOne({
      _id: userId,
      username,
      passwordHash,
      email,
      createdAt: new Date(),
    });

    return { userId: userId as string };
  }

  /**
   * login(username: String, password: String): (sessionToken: String, userId: String)
   * 
   * **requires** username exists, password matches stored passwordHash
   * 
   * **effects** creates new Session with random secure token, sets expiration time 
   * (e.g., 7 days from now), returns session token and userId
   */
  async login({ username, password }: { 
    username: string; 
    password: string 
  }): Promise<{ sessionToken: string; userId: string } | { error: string }> {
    // Find user
    const user = await this.users.findOne({ username });
    if (!user) {
      return { error: "Invalid username or password" };
    }

    // Verify password
    const isValid = await this.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return { error: "Invalid username or password" };
    }

    // Create session
    const sessionToken = this.generateSecureToken();
    const sessionId = freshID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.sessions.insertOne({
      _id: sessionId,
      userId: user._id,
      token: sessionToken,
      createdAt: now,
      expiresAt,
      lastAccessedAt: now,
    });

    return { sessionToken, userId: user._id as string };
  }

  /**
   * authenticate(sessionToken: String): (userId: String)
   * 
   * **requires** sessionToken exists in Sessions, session has not expired 
   * (current time < expiresAt)
   * 
   * **effects** updates lastAccessedAt to current time, returns associated userId
   */
  async authenticate({ sessionToken }: { 
    sessionToken: string 
  }): Promise<{ userId: string } | { error: string }> {
    const session = await this.sessions.findOne({ token: sessionToken });
    if (!session) {
      return { error: "Invalid session token" };
    }

    // Check if session has expired
    if (new Date() > session.expiresAt) {
      await this.sessions.deleteOne({ _id: session._id });
      return { error: "Session expired" };
    }

    // Update last accessed time
    await this.sessions.updateOne(
      { _id: session._id },
      { $set: { lastAccessedAt: new Date() } }
    );

    return { userId: session.userId as string };
  }

  /**
   * logout(sessionToken: String): (success: Boolean)
   * 
   * **requires** sessionToken exists in Sessions
   * 
   * **effects** removes Session from state, returns true
   */
  async logout({ sessionToken }: { 
    sessionToken: string 
  }): Promise<{ success: boolean } | { error: string }> {
    const result = await this.sessions.deleteOne({ token: sessionToken });
    
    if (result.deletedCount === 0) {
      return { error: "Session not found" };
    }

    return { success: true };
  }

  /**
   * system expireSessions(): (expiredCount: Number)
   * 
   * **requires** current time is after expiresAt for one or more Sessions
   * 
   * **effects** removes all expired Sessions, returns count of removed sessions
   */
  async expireSessions(): Promise<{ expiredCount: number }> {
    const now = new Date();
    const result = await this.sessions.deleteMany({
      expiresAt: { $lt: now }
    });

    return { expiredCount: result.deletedCount };
  }

  /**
   * updatePassword(userId: String, oldPassword: String, newPassword: String): (success: Boolean)
   * 
   * **requires** userId exists, oldPassword matches current passwordHash, 
   * newPassword length >= 8
   * 
   * **effects** updates passwordHash with new hashed password, returns true
   */
  async updatePassword({ userId, oldPassword, newPassword }: { 
    userId: string; 
    oldPassword: string; 
    newPassword: string 
  }): Promise<{ success: boolean } | { error: string }> {
    const user = await this.users.findOne({ _id: userId as User });
    if (!user) {
      return { error: "User not found" };
    }

    // Verify old password
    const isValid = await this.verifyPassword(oldPassword, user.passwordHash);
    if (!isValid) {
      return { error: "Current password is incorrect" };
    }

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      return { error: "New password must be at least 8 characters long" };
    }

    // Hash and update password
    const passwordHash = await this.hashPassword(newPassword);
    await this.users.updateOne(
      { _id: userId as User },
      { $set: { passwordHash } }
    );

    return { success: true };
  }

  /**
   * getUserProfile(userId: String): (username: String, email: String, createdAt: Date)
   * 
   * **requires** userId exists in Users
   * 
   * **effects** returns username, email, and account creation date for the user
   */
  async getUserProfile({ userId }: { 
    userId: string 
  }): Promise<{ username: string; email: string; createdAt: Date } | { error: string }> {
    const user = await this.users.findOne({ _id: userId as User });
    if (!user) {
      return { error: "User not found" };
    }

    return {
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    };
  }

  // Private helper methods

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private generateSecureToken(): string {
    // Generate a cryptographically secure random token (32 bytes)
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private async hashPassword(password: string): Promise<string> {
    // In a real implementation, use bcrypt or similar
    // For now, using Web Crypto API's subtle crypto
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    const passwordHash = await this.hashPassword(password);
    return passwordHash === hash;
  }
}

