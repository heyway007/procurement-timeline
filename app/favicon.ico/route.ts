const faviconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="TCEB">
  <rect width="64" height="64" rx="16" fill="#4f46e5"/>
  <path d="M19 17h26v7H19zM23 27h18v7H23zM19 39h26v7H19z" fill="#fff"/>
  <circle cx="32" cy="32" r="25" fill="none" stroke="#c7d2fe" stroke-width="2"/>
</svg>`;

export function GET() {
  return new Response(faviconSvg, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "image/svg+xml",
    },
  });
}
