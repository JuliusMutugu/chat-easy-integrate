<script>
  /**
   * Auth component - Login, Signup with account types, and KYC forms
   */
  export let mode = "login"; // "login", "signup", or "kyc"
  export let onSuccess = () => {};
  export let serverUrl = "";
  export let inviteToken = null; // If user came from invite link

  let email = "";
  let password = "";
  let name = "";
  let isCustomer = false;
  let isBusiness = false;
  let loading = false;
  let error = "";

  // KYC form fields
  let kycBusinessName = "";
  let kycRegistrationNumber = "";
  let kycAddress = "";
  let kycBusinessType = "";
  let kycContactPhone = "";
  let kycTaxId = "";
  let kycMessage = "";

  // User data after signup (used for KYC step)
  let pendingUser = null;

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
    if (mode === "signup" && !isCustomer && !isBusiness) {
      error = "Please select at least one account type";
      return;
    }

    loading = true;
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login"
        ? { email, password }
        : { email, password, name, isCustomer, isBusiness };

      const res = await fetch(`${serverUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const text = await res.text();
      const data = (text?.trimStart().startsWith("{") ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null) || {};
      if (!res.ok) {
        error = data.error || "Failed to " + mode;
        return;
      }

      // If signup with business account, go to KYC
      if (mode === "signup" && data.requiresKyc) {
        pendingUser = data.user;
        mode = "kyc";
        return;
      }

      // Success - pass user and whether there's an invite
      onSuccess(data.user, { inviteToken });
    } catch (err) {
      error = err.message || "Network error";
    } finally {
      loading = false;
    }
  }

  async function handleKycSubmit() {
    error = "";
    kycMessage = "";
    if (!kycBusinessName.trim()) {
      error = "Business name is required";
      return;
    }

    loading = true;
    try {
      const res = await fetch(`${serverUrl}/api/kyc/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          businessName: kycBusinessName.trim(),
          registrationNumber: kycRegistrationNumber.trim() || null,
          address: kycAddress.trim() || null,
          businessType: kycBusinessType || null,
          contactPhone: kycContactPhone.trim() || null,
          taxId: kycTaxId.trim() || null,
        }),
      });

      const text = await res.text();
      const data = (text?.trimStart().startsWith("{") ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null) || {};
      if (!res.ok) {
        error = data.error || "Failed to submit KYC";
        return;
      }

      kycMessage = data.message || "KYC submitted! Your account is pending review.";
      // After KYC submission, proceed to app
      setTimeout(() => {
        onSuccess(pendingUser, { inviteToken, kycPending: true });
      }, 2000);
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

  function skipKyc() {
    // Allow user to skip and complete KYC later
    onSuccess(pendingUser, { inviteToken, kycPending: true });
  }
</script>

<div class="auth-container">
  <div class="auth-card">
    {#if mode === "kyc"}
      <h2 class="auth-title">Business Verification</h2>
      <p class="auth-subtitle">Complete KYC to verify your business account. This helps us ensure trust and security.</p>

      <form class="auth-form" onsubmit={(e) => { e.preventDefault(); handleKycSubmit(); }}>
        <label class="auth-label">
          <span class="auth-label-text">Business Name <span class="required">*</span></span>
          <input
            type="text"
            class="auth-input"
            bind:value={kycBusinessName}
            placeholder="Your company name"
            disabled={loading}
            required
          />
        </label>

        <label class="auth-label">
          <span class="auth-label-text">Business Type</span>
          <select class="auth-input" bind:value={kycBusinessType} disabled={loading}>
            <option value="">Select type...</option>
            <option value="sole_proprietor">Sole Proprietor</option>
            <option value="partnership">Partnership</option>
            <option value="llc">LLC</option>
            <option value="corporation">Corporation</option>
            <option value="nonprofit">Non-profit</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label class="auth-label">
          <span class="auth-label-text">Registration Number</span>
          <input
            type="text"
            class="auth-input"
            bind:value={kycRegistrationNumber}
            placeholder="Company registration #"
            disabled={loading}
          />
        </label>

        <label class="auth-label">
          <span class="auth-label-text">Tax ID / VAT Number</span>
          <input
            type="text"
            class="auth-input"
            bind:value={kycTaxId}
            placeholder="Tax identification number"
            disabled={loading}
          />
        </label>

        <label class="auth-label">
          <span class="auth-label-text">Business Address</span>
          <input
            type="text"
            class="auth-input"
            bind:value={kycAddress}
            placeholder="Street, City, Country"
            disabled={loading}
          />
        </label>

        <label class="auth-label">
          <span class="auth-label-text">Contact Phone</span>
          <input
            type="tel"
            class="auth-input"
            bind:value={kycContactPhone}
            placeholder="+1 234 567 8900"
            disabled={loading}
          />
        </label>

        {#if error}
          <div class="auth-error" role="alert">{error}</div>
        {/if}

        {#if kycMessage}
          <div class="auth-success" role="status">{kycMessage}</div>
        {/if}

        <button type="submit" class="auth-submit" disabled={loading || !!kycMessage}>
          {loading ? "Submitting..." : "Submit Verification"}
        </button>

        <button type="button" class="auth-skip-btn" onclick={skipKyc} disabled={loading || !!kycMessage}>
          Complete later
        </button>
      </form>
    {:else}
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

        {#if mode === "signup"}
          <div class="auth-account-types">
            <span class="auth-label-text">Account Type</span>
            <p class="auth-account-hint">You can select both if needed</p>
            <div class="auth-checkbox-group">
              <label class="auth-checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={isCustomer}
                  disabled={loading}
                />
                <span class="auth-checkbox-text">
                  <strong>Customer</strong>
                  <small>Buy products, negotiate deals</small>
                </span>
              </label>
              <label class="auth-checkbox-label">
                <input
                  type="checkbox"
                  bind:checked={isBusiness}
                  disabled={loading}
                />
                <span class="auth-checkbox-text">
                  <strong>Business</strong>
                  <small>Sell products, manage workflows (requires KYC)</small>
                </span>
              </label>
            </div>
          </div>
        {/if}

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
    {/if}
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
    max-width: 460px;
    padding: 2.5rem;
    background: var(--card-bg);
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-height: 90vh;
    overflow-y: auto;
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

  .auth-label-text .required {
    color: #dc2626;
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

  select.auth-input {
    cursor: pointer;
  }

  .auth-account-types {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .auth-account-hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .auth-checkbox-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .auth-checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .auth-checkbox-label:hover {
    border-color: var(--green-600);
    background: rgba(34, 197, 94, 0.05);
  }

  .auth-checkbox-label input[type="checkbox"] {
    width: 1.125rem;
    height: 1.125rem;
    margin-top: 0.125rem;
    accent-color: var(--green-600);
    cursor: pointer;
  }

  .auth-checkbox-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .auth-checkbox-text strong {
    font-size: 0.9375rem;
    color: var(--text-primary);
  }

  .auth-checkbox-text small {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .auth-error {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    color: var(--white);
    background: #dc2626;
    border-radius: 8px;
  }

  .auth-success {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    color: var(--white);
    background: var(--green-600);
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

  .auth-skip-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.9375rem;
    font-weight: 500;
    font-family: inherit;
    color: var(--text-secondary);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .auth-skip-btn:hover:not(:disabled) {
    border-color: var(--text-secondary);
    color: var(--text-primary);
  }

  .auth-skip-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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
