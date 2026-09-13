/* Puzzle Sus shared-login timing fix. */
(() => {
  'use strict';
  const getUser = async () => {
    const sb = window.susGamesSupabase;
    if (!sb?.auth) return null;
    try {
      const { data: { session } } = await sb.auth.getSession();
      return session?.user || null;
    } catch (_) { return null; }
  };
  const patch = () => {
    if (typeof window.requirePuzzleLogin !== 'function' || window.__puzzleSharedLoginGateFixed) return;
    window.__puzzleSharedLoginGateFixed = true;
    window.requirePuzzleLogin = async function() {
      const user = await getUser();
      if (user) return user;
      if (typeof window.openLogin === 'function') window.openLogin();
      if (typeof window.toast === 'function') window.toast('Please login with your Sus Games account first.');
      return null;
    };
  };
  patch();
  const timer = setInterval(() => {
    patch();
    if (window.__puzzleSharedLoginGateFixed) clearInterval(timer);
  }, 100);
  setTimeout(() => clearInterval(timer), 10000);
})();
