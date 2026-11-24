// Transparent, consent-based session analytics.
// Only sends heartbeats if the user has consented (server also double-checks consent).
(function () {
  let heartbeatInterval = null;

  function startHeartbeat() {
    if (heartbeatInterval) return;
    heartbeatInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        api.heartbeat().catch(() => {});
      }
    }, 30000); // ~every 30 seconds, matching spec
  }

  function stopHeartbeat() {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Best-effort session end on page hide / unload.
  // Note: browsers do not guarantee this fires in every scenario (e.g. app killed,
  // device loses power) — hence "best-effort", never presented as an exact departure time.
  function sendEndBeacon() {
    const url = `${API_BASE}/activity/end`;
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({})], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      sendEndBeacon();
    }
  });

  window.addEventListener('pagehide', sendEndBeacon);

  // Expose start so pages can call it only after confirming consent is true
  window.activityTracker = { start: startHeartbeat, stop: stopHeartbeat };
})();