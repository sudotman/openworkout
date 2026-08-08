function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener(
    "load",
    () => {
      const baseURL = new URL(import.meta.env.BASE_URL, window.location.href);
      const serviceWorkerURL = new URL("sw.js", baseURL);

      navigator.serviceWorker
        .register(serviceWorkerURL, { scope: baseURL.pathname })
        .catch(() => {});
    },
    { once: true },
  );
}

registerServiceWorker();
