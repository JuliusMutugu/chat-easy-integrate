<script>
  /**
   * Auth component - Login and Signup forms
   */
  export let mode = "login"; // "login" or "signup"
  export let onSuccess = () => {};
  export let serverUrl = "";

  let email = "";
  let password = "";
  let name = "";
  let loading = false;
  let error = "";

  async function handleSubmit() {
    error = "";
    if (!email || !password) {
      error = "Email and password are required";
      return;
    }
    if (mode === "signup" && !name) {
      error = "Name is required";
      return;
    }
    if (password.length < 6) {
      error = "Password must be at least 6 characters";
      return;
    }

    loading = true;
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { email, password } : { email, password, name };
      
      const res = await fetch(`${serverUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        error = data.error || "Failed to " + mode;
        return;
      }

      onSuccess(data.user);
    } catch (err) {
      error = err.message || "Network error";
    } finally {
      loading = false;
    }
  }

  function switchMode() {
    mode = mode === "login" ? "signup" : "login";
    error = "";
  }
</script>

<div class="auth-container">
  <div class="auth-card">
    <h2 class="auth-title">{mode === "login" ? "Log in" : "Sign up"}</h2>
    <p class="auth-subtitle">
      {mode === "login" ? "Welcome back! Log in to continue." : "Create an account to get started."}
    </p>

    <form class="auth-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      {#if mode === "signup"}
        <label class="auth-label">
          <span class="auth-label-text">Name</span>
          <input
            type="text"
            class="auth-input"
            bind:value={name}
            placeholder="Your name"
            disabled={loading}
            required
          />
        </label>
      {/if}

      <label class="auth-label">
        <span class="auth-label-text">Email</span>
        <input
          type="email"
          class="auth-input"
          bind:value={email}
          placeholder="you@example.com"
          disabled={loading}
          required
        />
      </label>

      <label class="auth-label">
        <span class="auth-label-text">Password</span>
        <input
          type="password"
          class="auth-input"
          bind:value={password}
          placeholder="••••••••"
          disabled={loading}
          required
        />
      </label>

      {#if error}
        <div class="auth-error" role="alert">{error}</div>
      {/if}

      <button type="submit" class="auth-submit" disabled={loading}>
        {loading ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
      </button>
    </form>

    <div class="auth-switch">
      {mode === "login" ? "Don't have an account?" : "Already have an account?"}
      <button type="button" class="auth-switch-btn" onclick={switchMode} disabled={loading}>
        {mode === "login" ? "Sign up" : "Log in"}
      </button>
    </div>
  </div>
</div>

<style>
  .auth-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: linear-gradient(135deg, var(--navy-600) 0%, var(--navy-800) 100%);
  }

  .auth-card {
    width: 100%;
    max-width: 420px;
    padding: 2.5rem;
    background: var(--card-bg);
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .auth-title {
    margin: 0 0 0.5rem;
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
    text-align: center;
  }

  .auth-subtitle {
    margin: 0 0 2rem;
    font-size: 0.9375rem;
    color: var(--text-secondary);
    text-align: center;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .auth-label {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .auth-label-text {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .auth-input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.9375rem;
    font-family: inherit;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .auth-input:focus {
    outline: none;
    border-color: var(--green-600);
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
  }

  .auth-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .auth-error {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    color: var(--white);
    background: #dc2626;
    border-radius: 8px;
  }

  .auth-submit {
    width: 100%;
    padding: 0.875rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--white);
    background: var(--green-600);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.1s ease;
  }

  .auth-submit:hover:not(:disabled) {
    background: var(--green-700);
    transform: translateY(-1px);
  }

  .auth-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .auth-switch {
    margin-top: 1.5rem;
    text-align: center;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .auth-switch-btn {
    margin-left: 0.25rem;
    padding: 0;
    font-size: 0.875rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--green-600);
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: underline;
    transition: color 0.15s ease;
  }

  .auth-switch-btn:hover:not(:disabled) {
    color: var(--green-700);
  }

  .auth-switch-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
