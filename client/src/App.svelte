<script>
  import MessagingModule from './lib/MessagingModule.svelte';
  
  let showModule = false;
  let config = {
    serverUrl: 'http://localhost:3000',
    username: 'User' + Math.floor(Math.random() * 1000),
    theme: 'modern'
  };

  function toggleModule() {
    showModule = !showModule;
  }

  function handleClose() {
    showModule = false;
  }
</script>

<main>
  <div class="demo-container">
    <h1>🚀 Simple Messaging Platform Demo</h1>
    
    <div class="intro">
      <p>A lightweight, embeddable messaging module for group negotiations and temporary conversations.</p>
      <p>Built with Node.js and Svelte 5 for easy integration into any application.</p>
    </div>

    <div class="controls">
      <div class="config-section">
        <h3>Configuration</h3>
        <div class="input-group">
          <label for="username">Username:</label>
          <input id="username" bind:value={config.username} placeholder="Enter your username" />
        </div>
        <div class="input-group">
          <label for="serverUrl">Server URL:</label>
          <input id="serverUrl" bind:value={config.serverUrl} placeholder="http://localhost:3000" />
        </div>
      </div>
      
      <button class="launch-btn" onclick={toggleModule}>
        {showModule ? '✕ Close Messaging' : '💬 Launch Messaging'}
      </button>
    </div>

    <div class="features">
      <h3>✨ Features</h3>
      <ul>
        <li>🏠 Create and join chat rooms</li>
        <li>💬 Real-time messaging</li>
        <li>🤝 Group negotiation with voting</li>
        <li>👥 User presence indicators</li>
        <li>📱 Responsive design</li>
        <li>🔧 Easy integration</li>
      </ul>
    </div>

    <div class="integration-example">
      <h3>Integration Example</h3>
      <pre><code>&lt;script&gt;
  import MessagingModule from './MessagingModule.svelte';
  
  let config = &#123;
    serverUrl: 'http://your-server.com',
    username: 'user123',
    theme: 'modern'
  &#125;;
&lt;/script&gt;

&lt;MessagingModule &#123;config&#125; onClose=&#123;handleClose&#125; /&gt;</code></pre>
    </div>
  </div>

  {#if showModule}
    <MessagingModule {config} onClose={handleClose} />
  {/if}
</main>

<style>
  main {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
  }

  .demo-container {
    background: white;
    border-radius: 20px;
    padding: 40px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
    margin-bottom: 20px;
  }

  h1 {
    text-align: center;
    color: #333;
    margin-bottom: 20px;
    font-size: 2.5em;
  }

  .intro {
    text-align: center;
    margin-bottom: 30px;
    color: #666;
    line-height: 1.6;
  }

  .intro p {
    margin-bottom: 10px;
  }

  .controls {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 30px;
    flex-wrap: wrap;
    gap: 20px;
  }

  .config-section {
    flex: 1;
    min-width: 300px;
  }

  .config-section h3 {
    margin-bottom: 15px;
    color: #333;
  }

  .input-group {
    margin-bottom: 15px;
  }

  .input-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
    color: #555;
  }

  .input-group input {
    width: 100%;
    padding: 10px;
    border: 2px solid #e1e5e9;
    border-radius: 8px;
    font-size: 14px;
    transition: border-color 0.3s;
  }

  .input-group input:focus {
    outline: none;
    border-color: #667eea;
  }

  .launch-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 15px 30px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    white-space: nowrap;
  }

  .launch-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
  }

  .features {
    margin-bottom: 30px;
  }

  .features h3 {
    margin-bottom: 15px;
    color: #333;
  }

  .features ul {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 10px;
  }

  .features li {
    padding: 10px;
    background: #f8f9fa;
    border-radius: 8px;
    font-size: 14px;
  }

  .integration-example {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 12px;
  }

  .integration-example h3 {
    margin-bottom: 15px;
    color: #333;
  }

  .integration-example pre {
    background: #2d3748;
    color: #e2e8f0;
    padding: 20px;
    border-radius: 8px;
    overflow-x: auto;
    font-size: 14px;
    line-height: 1.5;
  }

  @media (max-width: 768px) {
    .demo-container {
      padding: 20px;
    }
    
    .controls {
      flex-direction: column;
      align-items: stretch;
    }
    
    .features ul {
      grid-template-columns: 1fr;
    }
  }
</style>
