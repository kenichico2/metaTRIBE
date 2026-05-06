/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The TRIBEv2 backend is run separately by the user.
  // Cross-origin video / mesh / preds binaries are loaded directly from that backend.
  // The user must enable CORS on their backend (see README).
};

export default nextConfig;
