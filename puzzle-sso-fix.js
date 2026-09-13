/* Puzzle Sus shared-login timing + OAuth fix. */
(() => {
  'use strict';

  const getClient = () => window.susGamesSupabase || null;

  const getUser = async () => {
    const sb = getClient();
    if (!sb?.auth) return null;
    try {
      const { data: { session } } = await sb.auth.getSession();
      return session?.user || null;
    } catch (_) { return null; }
  };

  const patch = () => {
    if (typeof window.requirePuzzleLogin === 'function' && !window.__puzzleSharedLoginGateFixed) {
      window.__puzzleSharedLoginGateFixed = true;
      window.requirePuzzleLogin = async function() {
        const user = await getUser();
        if (user) return user;
        if (typeof window.openLogin === 'function') window.openLogin();
        if (typeof window.toast === 'function') window.toast('Please login with your Sus Games account first.');
        return null;
      };
    }

    /* Always use the shared Sus Games Supabase client for Google/Discord OAuth.
       This avoids the page's second Supabase client racing the shared session. */
    if (getClient()?.auth && !window.__puzzleSharedOAuthFixed) {
      window.__puzzleSharedOAuthFixed = true;
      window.loginWithProvider = async function(provider) {
        const sb = getClient();
        const status = document.getElementById('puzzleAuthStatus');
        const err = document.getElementById('loginError');
        const setStatus = msg => {
          if (status) status.textContent = msg;
          if (err) err.textContent = msg;
        };
        try {
          setStatus('Opening ' + provider + ' login…');
          const redirectTo = window.location.origin + window.location.pathname;
          const { error } = await sb.auth.signInWithOAuth({
            provider,
            options: { redirectTo }
          });
          if (error) setStatus(error.message);
        } catch (e) {
          setStatus(e?.message || 'Login failed. Please try again.');
        }
      };
    }
  };

  patch();
  const timer = setInterval(() => {
    patch();
    if (window.__puzzleSharedLoginGateFixed && window.__puzzleSharedOAuthFixed) clearInterval(timer);
  }, 100);
  setTimeout(() => clearInterval(timer), 15000);
})();
