const originalFetch = window.fetch.bind(window);
const authConfig = window.AUTH_CONFIG || {};
const authEnabled = authConfig.clientId && !authConfig.clientId.startsWith('SEU_');
let authReady = Promise.resolve(null);
let msalInstance = null;

if (authEnabled) {
    authReady = import('https://cdn.jsdelivr.net/npm/@azure/msal-browser@4.13.1/+esm').then(async ({ PublicClientApplication }) => {
        msalInstance = new PublicClientApplication({
            auth: {
                clientId: authConfig.clientId,
                authority: authConfig.authority,
                redirectUri: window.location.origin + window.location.pathname,
            },
            cache: { cacheLocation: 'sessionStorage' },
        });
        await msalInstance.initialize();
        const result = await msalInstance.handleRedirectPromise();
        if (result?.account) msalInstance.setActiveAccount(result.account);
        return msalInstance;
    });
}

async function getAccessToken() {
    const client = await authReady;
    if (!client) return null;
    const account = client.getActiveAccount() || client.getAllAccounts()[0];
    if (!account) {
        await client.loginRedirect({ scopes: [authConfig.apiScope] });
        return null;
    }
    try {
        const result = await client.acquireTokenSilent({ account, scopes: [authConfig.apiScope] });
        return result.accessToken;
    } catch {
        await client.acquireTokenRedirect({ account, scopes: [authConfig.apiScope] });
        return null;
    }
}

window.loginMicrosoft = async () => {
    const client = await authReady;
    if (client) await client.loginRedirect({ scopes: [authConfig.apiScope] });
};

window.logoutMicrosoft = async () => {
    const client = await authReady;
    if (client) await client.logoutRedirect({ postLogoutRedirectUri: window.location.origin + window.location.pathname });
};

window.getAuthenticatedUser = async () => {
    const token = await getAccessToken();
    if (!token || !window.API_BASE_URL) return null;
    const response = await originalFetch(window.API_BASE_URL + '/me', { headers: { Authorization: `Bearer ${token}` } });
    return response.ok ? response.json() : null;
};

window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const apiBase = window.API_BASE_URL || '';
    if (!authEnabled || !apiBase || !url.startsWith(apiBase)) return originalFetch(input, init);
    const token = await getAccessToken();
    if (!token) return new Response(JSON.stringify({ error: 'Autenticacao em andamento' }), { status: 401 });
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
    headers.set('Authorization', `Bearer ${token}`);
    return originalFetch(input, { ...init, headers });
};
