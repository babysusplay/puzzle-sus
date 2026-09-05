/* Sus Games shared-login bridge. Keeps Puzzle's game logic intact. */
(() => {
  'use strict';
  const SUPABASE_URL='https://wnjsajfahsqunfesmetu.supabase.co';
  const SUPABASE_KEY='sb_publishable_S_ePD9oEegH0R0XR8LGvjQ_sMs9OZSm';
  const HUB='https://babysusplay.github.io/sus-games/';
  const load=()=>new Promise((resolve,reject)=>{if(window.supabase){resolve();return}const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
  const boot=async()=>{
    try{
      await load();
      const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
      window.susGamesSupabase=sb;
      const p=new URLSearchParams(location.hash.replace(/^#/,'')).get('access_token');
      const r=new URLSearchParams(location.hash.replace(/^#/,'')).get('refresh_token');
      if(p&&r){
        const {error}=await sb.auth.setSession({access_token:p,refresh_token:r});
        if(!error) history.replaceState(null,'',location.pathname+location.search);
      }
      const {data:{session}}=await sb.auth.getSession();
      if(session?.user){
        let profile=null;
        try{const q=await sb.from('profiles').select('id,user_id,display_name,avatar_url').eq('id',session.user.id).maybeSingle();profile=q.data||null}catch{}
        window.susGamesCurrentUser={...session.user,profile};
        const name=profile?.display_name||session.user.user_metadata?.full_name||session.user.email?.split('@')[0]||'Player';
        window.susGamesCurrentName=name;
        localStorage.setItem('puzzle_sus_shared_user',JSON.stringify({id:session.user.id,name,avatar:profile?.avatar_url||null}));
        const oldGet=window.getLocalAuth;
        window.getLocalAuth=()=>({username:name,shared:true,user_id:session.user.id});
        if(typeof window.updateAuthArea==='function')window.updateAuthArea();
        if(typeof window.saveName==='function' && (!window.state?.name))window.saveName(name);
        const title=document.querySelector('.logo span');
        if(title&&!document.getElementById('susHubBack')){const a=document.createElement('button');a.id='susHubBack';a.textContent='Sus Games';a.style.cssText='position:fixed;right:18px;bottom:18px;z-index:6000;border:1px solid rgba(139,92,246,.45);background:#211d37;color:#fff;border-radius:11px;padding:9px 13px;font-weight:800;cursor:pointer;box-shadow:0 8px 25px rgba(0,0,0,.3)';a.onclick=()=>location.href=HUB;a.title='Back to Sus Games';document.body.appendChild(a)}
      }
    }catch(e){console.warn('[Sus Games SSO]',e)}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
