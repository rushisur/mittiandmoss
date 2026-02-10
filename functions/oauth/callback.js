export const onRequest = async ({ request, env }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code) {
        return new Response("Missing code", { status: 400 });
    }

    const client_id = env.GITHUB_CLIENT_ID;
    const client_secret = env.GITHUB_CLIENT_SECRET;

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

        // Decap CMS expects a postMessage with the token
        const token = tokenData.access_token;
        const provider = "github";

        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <script>
          const receiveMessage = (message) => {
            window.opener.postMessage(
              'authorization:github:success:${JSON.stringify({
            token: token,
            provider: provider
        })}',
              message.origin
            );
            window.removeEventListener("message", receiveMessage, false);
          }
          window.addEventListener("message", receiveMessage, false);
          window.opener.postMessage("authorizing:github", "*");
        </script>
      </head>
      <body>
        Authorizing...
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
