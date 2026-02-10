export const onRequest = async ({ env }) => {
    const clientId = env.GITHUB_CLIENT_ID || "";
    const lastChar = clientId.length > 0 ? clientId.charCodeAt(clientId.length - 1) : "N/A";
    const hasNewline = clientId.includes("\n") || clientId.includes("\r");

    const info = {
        length: clientId.length,
        lastCharCode: lastChar,
        hasNewline: hasNewline,
        clientIdPreview: clientId.substring(0, 5) + "***" + clientId.substring(clientId.length - 2)
    };

    return new Response(JSON.stringify(info, null, 2), {
        headers: { "Content-Type": "application/json" }
    });
};
