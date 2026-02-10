export const onRequest = async ({ request, env }) => {
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider");
    const domain = url.searchParams.get("domain") || "github.com";

    if (provider !== "github") {
        return new Response("Only GitHub is supported", { status: 400 });
    }

    const client_id = env.GITHUB_CLIENT_ID;
    const client_secret = env.GITHUB_CLIENT_SECRET;

    if (!client_id || !client_secret) {
        return new Response("Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET env vars", { status: 500 });
    }

    const redirectParams = new URLSearchParams({
        client_id,
        scope: "repo,user",
        state: crypto.randomUUID(), // Ideally store this securely, but for simple MVP this is okay-ish to send
    });

    return Response.redirect(
        `https://github.com/login/oauth/authorize?${redirectParams.toString()}`,
        302
    );
};
