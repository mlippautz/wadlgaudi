import type { ActivitySummary } from './activity-parser';

/**
 * Generates an Open Graph (OG) compatible image for cross-posting to Bluesky.
 * Creates an SVG dynamically with the activity stats.
 */
export async function generateOGImage(summary: ActivitySummary): Promise<Blob> {
    const distanceKm = (summary.distance / 1000).toFixed(2);
    const durationMin = Math.floor(summary.duration / 60);

    const svg = `
    <svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#1e1b4b;stop-opacity:1" />
            </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad1)" rx="16" />
        <text x="40" y="80" fill="#8b5cf6" font-family="sans-serif" font-size="48" font-weight="bold">${summary.sportType} Activity</text>
        <text x="40" y="160" fill="#f8fafc" font-family="sans-serif" font-size="32">Distance: ${distanceKm} km</text>
        <text x="40" y="220" fill="#f8fafc" font-family="sans-serif" font-size="32">Time: ${durationMin} min</text>
        <text x="40" y="320" fill="#10b981" font-family="sans-serif" font-size="24">Encrypted & Decentralized via Wadlgaudi</text>
    </svg>`;

    return new Blob([svg], { type: 'image/svg+xml' });
}
