export const onRequest = async ({ request, env }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return new Response("Missing code", { status: 400 });
  }

  const client_id = (env.GITHUB_CLIENT_ID || "").trim();
  const client_secret = (env.GITHUB_CLIENT_SECRET || "").trim();

  if (!client_id || !client_secret) {
    return new Response("Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET env vars", { status: 500 });
  }

  try {
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        client_id,
        client_secret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return new Response(JSON.stringify(tokenData), { status: 400 });
    }

    const token = tokenData.access_token;
    const provider = "github";

    // Security: Only allow trusted origins to receive the token
    // This prevents malicious sites from opening the popup and stealing the token
    const allowedOrigins = [
      "http://localhost:4321",         // Local dev
      "http://127.0.0.1:4321",         // Local dev IP
      "https://mittiandmoss.pages.dev", // Cloudflare Pages production
      "https://mittiandmoss.com",       // Future custom domain
      "https://www.mittiandmoss.com",   // Future custom domain
    ];

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <script>
          const receiveMessage = (event) => {
            const origin = event.origin;
            
            // Allow specified origins OR any preview deployment on pages.dev
            const isAllowed = ${JSON.stringify(allowedOrigins)}.includes(origin) || 
                              /^https:\\/\\/[a-z0-9-]+\\.mittiandmoss\\.pages\\.dev$/.test(origin);

            if (!isAllowed) {
              console.warn("Blocked OAuth token request from unauthorized origin: " + origin);
              return;
            }

            // Valid origin: Send the token
            window.opener.postMessage(
              'authorization:github:success:${JSON.stringify({
      token: token,
      provider: provider
    })}',
              origin
            );
            window.removeEventListener("message", receiveMessage, false);
          }
          window.addEventListener("message", receiveMessage, false);
          
          // Notify opener (any origin) that we are ready to receive handshake
          // This is safe because it contains no sensitive data
          window.opener.postMessage("authorizing:github", "*");
        </script>
      </head>
      <body>
        Verifying via GitHub...
      </body>
      </html>
    `;

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
};
