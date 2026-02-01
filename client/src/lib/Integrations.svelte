<script>
  import { playClick } from "./theme.js";

  export let onBack = () => {};
</script>

<div class="integrations-view">
  <header class="integrations-header">
    <button type="button" class="btn-back" onclick={() => { playClick(); onBack(); }}>Back</button>
    <h2 class="integrations-title">Integrations</h2>
  </header>

  <div class="integrations-content">
    <p class="integrations-intro">
      Connect SMS, Email, and other channels—Twilio and Africa's Talking style. Fully integrable messaging from one place.
    </p>

    <div class="integration-cards">
      <article class="integration-card">
        <div class="integration-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
        </div>
        <h3>SMS</h3>
        <p>Send and receive SMS via Twilio, Africa's Talking, or your provider.</p>
        <span class="integration-badge">Coming soon</span>
      </article>

      <article class="integration-card">
        <div class="integration-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </div>
        <h3>Email (Gmail)</h3>
        <p>Connect Gmail or SMTP for email-based conversations.</p>
        <span class="integration-badge">Coming soon</span>
      </article>

      <article class="integration-card">
        <div class="integration-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <h3>WhatsApp</h3>
        <p>Reach users on WhatsApp Business API.</p>
        <span class="integration-badge">Coming soon</span>
      </article>
    </div>
  </div>
</div>

<style>
  .integrations-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
  }

  .integrations-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .btn-back {
    background: var(--gray-100);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--gray-700);
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn-back:hover {
    background: var(--gray-200);
    border-color: var(--gray-300);
  }

  .integrations-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .integrations-content {
    flex: 1;
    overflow-y: auto;
  }

  .integrations-intro {
    margin: 0 0 1.5rem;
    font-size: 0.9375rem;
    color: var(--gray-600);
    line-height: 1.5;
  }

  .integration-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1rem;
  }

  .integration-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.25rem;
    position: relative;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .integration-card:hover {
    border-color: var(--navy-400);
    box-shadow: 0 4px 12px rgba(13, 33, 55, 0.06);
  }

  .integration-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--navy-100);
    border-radius: 10px;
    color: var(--navy-700);
    margin-bottom: 0.75rem;
  }

  .integration-card h3 {
    margin: 0 0 0.375rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .integration-card p {
    margin: 0 0 0.75rem;
    font-size: 0.8125rem;
    color: var(--gray-600);
    line-height: 1.4;
  }

  .integration-badge {
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--gray-500);
    background: var(--gray-100);
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
  }
</style>
