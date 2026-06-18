<script lang="ts">
  // Shown when the backend reports the Google refresh token is missing/expired.
  // Tapping opens the one-time re-authorization flow.
</script>

<a class="banner" href="/api/auth/start">
  <span class="dot"></span>
  Google Calendar needs reconnecting — tap to authorize
</a>

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--danger);
    color: #fff;
    text-decoration: none;
    padding: 8px 16px;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #fff;
    animation: pulse 1.4s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
</style>
