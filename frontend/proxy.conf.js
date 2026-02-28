
// Proxy configuration (JS) for the Angular dev server.
// This file is loaded by `ng serve --proxy-config frontend/proxy.conf.js`.
// It reads the BACKEND_HOST environment variable (format: "<IP>:<PORT>")
// and falls back to 'localhost:3000' when the variable is not set.
// This setup allows the frontend to proxy API requests to the backend during development, even when the backend is running on a different machine (e.g., a VR headset on the same LAN).
module.exports = {
  '/api': {
    // Use the BACKEND_HOST env var if present, otherwise default to localhost:3000
    // Requests from the browser to `/api/...` (e.g. https://<MY_IP>:4200/api/...) are intercepted by the dev server and forwarded to the `target` below (the backend)
    target: `http://${process.env.BACKEND_HOST || 'localhost:3000'}`,
    // Do not require SSL validation for the target (development)
    secure: false,
    // Change the origin header to the target URL
    changeOrigin: true
  }
};