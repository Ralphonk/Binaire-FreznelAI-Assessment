export class FirebaseAuth {
  constructor(apiKey = process.env.FIREBASE_API_KEY, request = fetch) {
    this.apiKey = apiKey;
    this.request = request;
  }
  async authenticate(email, password, signup = false) {
    if (!this.apiKey)
      throw new Error("Set FIREBASE_API_KEY in .env first. See README.");
    if (!email.trim() || !password)
      throw new Error("Enter email and password.");
    const action = signup ? "signUp" : "signInWithPassword";
    const response = await this.request(
      `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          email: email.trim(),
          password,
          returnSecureToken: true,
        }),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      const code = data.error?.message ?? "";
      const messages = {
        EMAIL_EXISTS: "This email already has an account. Sign in instead.",
        INVALID_LOGIN_CREDENTIALS: "Email or password is incorrect.",
        INVALID_PASSWORD: "Email or password is incorrect.",
        EMAIL_NOT_FOUND: "Email or password is incorrect.",
        INVALID_EMAIL: "Enter a valid email address.",
        OPERATION_NOT_ALLOWED:
          "Enable Email/Password authentication in Firebase.",
        TOO_MANY_ATTEMPTS_TRY_LATER:
          "Too many attempts. Please try again later.",
      };
      throw new Error(
        messages[code] ??
        (code.startsWith("WEAK_PASSWORD")
          ? "Use a password of at least 6 characters."
          : "Authentication failed. Check Firebase configuration and connection."),
      );
    }
    // Credentials and tokens are never persisted to disk.
    return { email: data.email, uid: data.localId };
  }
}
