purpose Enable users to maintain authenticated state across multiple requests without repeatedly providing credentials
principle After a user authenticates with valid credentials, the system creates a session; subsequent requests using that session are associated with the authenticated user until the session is explicitly ended or expires
state
A set of Users with ObjectId, username String, passwordHash String, email String, and createdAt Date
A set of Sessions with ObjectId, userId (reference to User), token String, createdAt Date, expiresAt Date, and lastAccessedAt Date
actions
register(username: String, password: String, email: String): (userId: String)
requires username is not already taken, username length >= 3, password length >= 8, email is valid format
effects creates new User with hashed password, generates unique userId, returns userId
login(username: String, password: String): (sessionToken: String, userId: String)
requires username exists, password matches stored passwordHash
effects creates new Session with random secure token, sets expiration time (e.g., 7 days from now), returns session token and userId
authenticate(sessionToken: String): (userId: String)
requires sessionToken exists in Sessions, session has not expired (current time < expiresAt)
effects updates lastAccessedAt to current time, returns associated userId
logout(sessionToken: String): (success: Boolean)
requires sessionToken exists in Sessions
effects removes Session from state, returns true
system expireSessions(): (expiredCount: Number)
requires current time is after expiresAt for one or more Sessions
effects removes all expired Sessions, returns count of removed sessions
updatePassword(userId: String, oldPassword: String, newPassword: String): (success: Boolean)
requires userId exists, oldPassword matches current passwordHash, newPassword length >= 8
effects updates passwordHash with new hashed password, returns true
getUserProfile(userId: String): (username: String, email: String, createdAt: Date)
requires userId exists in Users
effects returns username, email, and account creation date for the user
implementation notes
Use bcrypt or similar for password hashing (never store plaintext passwords)
Session tokens should be cryptographically secure random strings (e.g., 32+ bytes)
Consider sliding expiration: extend expiresAt on each access
MongoDB TTL index on Sessions.expiresAt for automatic cleanup
Rate limiting on login attempts to prevent brute force attacks
Consider adding optional 2FA support in future iterations