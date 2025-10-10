import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	async headers() {
		return [
			{
				// Apply to all routes
				source: '/(.*)',
				headers: [
					{
						key: 'Content-Security-Policy',
						// Explicitly allow embedding the site in iframes anywhere
						// Note: If your hosting/platform also sets a CSP with a more restrictive
						// frame-ancestors (e.g., 'none'), browsers will combine policies and the
						// most restrictive wins. Remove or relax upstream CSP/X-Frame-Options there.
						value: 'frame-ancestors *;',
					},
				],
			},
		];
	},
};

export default nextConfig;
