/* Sus Games shared-login bridge + puzzle score recording + compact auth UI. */
(() => {
  'use strict';
  const SUPABASE_URL='https://wnjsajfahsqunfesmetu.supabase.co';
  const SUPABASE_KEY='sb_publishable_S_ePD9oEegH0R0XR8LGvjQ_sMs9OZSm';
  const HUB='https://babysusplay.github.io/sus-games/';
  const SCORE_KEY='sus_games_recorded_puzzle_runs_v3';
  const load=()=>new Promise((resolve,reject)=>{if(window.supabase){resolve();return}const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
  const read=()=>{try{return new Set(JSON.parse(localStorage.getItem(SCORE_KEY)||'[]'))}catch{return new Set()}};
  const write=s=>{try{localStorage.setItem(SCORE_KEY,JSON.stringify([...s].slice(-300)))}catch{}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let activePuzzle=null,activeRun=null,sharedUser=null,sharedProfile=null,sb=null;

  async function record(user,puzzle,score){
    if(!user||!puzzle||!activeRun)return;
    const seen=read();if(seen.has(activeRun))return;
    const payload={user_id:user.id,game_type:'puzzle',score:Number(score)||0,created_at:new Date().toISOString()};
    try{
      let r=await sb.from('game_scores').insert({...payload,game_id:String(puzzle.id||'')});
      if(r.error)r=await sb.from('game_scores').insert(payload);
      if(r.error){console.warn('[Sus Games puzzle score]',r.error);return}
      seen.add(activeRun);write(seen);
      window.dispatchEvent(new CustomEvent('sus-game-score-recorded',{detail:{gameType:'puzzle',score:Number(score)||0}}));
    }catch(e){console.warn('[Sus Games puzzle score]',e)}
  }

  function displayName(){
    return String(
      sharedProfile?.display_name||
      sharedUser?.user_metadata?.display_name||
      sharedUser?.user_metadata?.full_name||
      sharedUser?.user_metadata?.name||
      sharedUser?.email?.split('@')[0]||
      'Player'
    ).trim().slice(0,40)||'Player';
  }

  function installAuthUI(){
    if(document.getElementById('sus-puzzle-auth-ui-style'))return;
    const style=document.createElement('style');
    style.id='sus-puzzle-auth-ui-style';
    style.textContent=`
      .ps-shared-login-modal{position:relative!important;width:min(525px,calc(100vw - 32px))!important;max-width:none!important;padding:38px 38px 36px!important;border-radius:24px!important;background:#181b23!important;border:1px solid rgba(255,255,255,.16)!important;box-shadow:0 28px 90px rgba(0,0,0,.58)!important;text-align:center!important}
      .ps-login-close{position:absolute;right:17px;top:13px;border:0;background:transparent;color:#aaa;font-size:28px;font-weight:800;cursor:pointer;line-height:1}.ps-login-close:hover{color:#fff}
      .ps-login-title{font-size:31px;font-weight:900;color:#f7f7fb;margin-bottom:34px;text-align:left}.ps-login-text{font-size:16px;color:#a8adb8;margin-bottom:21px}
      .ps-oauth-btn{width:100%;height:58px;border-radius:13px;display:flex;align-items:center;justify-content:center;gap:14px;font-size:16px;font-weight:800;cursor:pointer;transition:.16s ease}
      .ps-google-btn{background:#fff;color:#171717;border:1px solid #fff}.ps-google-btn:hover{background:#f1f1f1;transform:translateY(-1px)}
      .ps-discord-btn{background:#2b2e36;color:#fff;border:1px solid #4a4d56;margin-top:15px}.ps-discord-btn:hover{background:#343741;transform:translateY(-1px)}
      .ps-google-icon{font-family:Arial,sans-serif;font-size:26px;font-weight:900;line-height:1}.ps-discord-icon{width:25px;height:25px;border-radius:7px;display:grid;place-items:center;font-size:15px;background:#fff;color:#2b2e36;font-weight:900}
      .ps-login-status{min-height:18px;margin-top:12px;color:#9ea5b2;font-size:12px}
      .ps-auth-wrap{position:relative;display:inline-flex}.ps-auth-user{border:1px solid #302b4b!important;background:#211d37!important;color:#e9e5f4!important;border-radius:10px!important;padding:9px 12px!important;font-weight:800!important;cursor:pointer!important;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ps-auth-menu{position:absolute;right:0;top:calc(100% + 7px);min-width:150px;padding:6px;border:1px solid #393253;border-radius:12px;background:#19172a;box-shadow:0 16px 40px rgba(0,0,0,.45);z-index:100000;display:none}.ps-auth-menu.open{display:block}
      .ps-auth-menu button{width:100%;border:0;background:transparent;color:#fff;text-align:left;padding:10px 11px;border-radius:8px;cursor:pointer;font-weight:700}.ps-auth-menu button:hover{background:rgba(255,255,255,.08)}
      @media(max-width:520px){.ps-shared-login-modal{padding:31px 21px 25px!important}.ps-login-title{font-size:28px;margin-bottom:28px}.ps-oauth-btn{height:54px;font-size:15px}}
    `;
    document.head.appendChild(style);
  }

  function renderAuthArea(){
    const area=document.getElementById('authArea');if(!area)return;
    if(sharedUser){
      const name=displayName();
      area.innerHTML=`<span class="ps-auth-wrap"><button type="button" class="ps-auth-user" onclick="togglePuzzleAuthMenu()">👤 ${esc(name)} ▾</button><span id="psAuthMenu" class="ps-auth-menu"><button type="button" onclick="logoutLocal()">Logout</button></span></span>`;
      try{localStorage.setItem('puzzle_sus_name',name.slice(0,24))}catch{}
    }else{
      area.innerHTML='<button class="auth-btn" onclick="openLogin()">🔐 Login</button>';
    }
  }

  window.togglePuzzleAuthMenu=()=>document.getElementById('psAuthMenu')?.classList.toggle('open');
  document.addEventListener('click',e=>{if(!e.target.closest('.ps-auth-wrap'))document.getElementById('psAuthMenu')?.classList.remove('open')});

  function renderLoginModal(){
    const modal=document.getElementById('loginModal');
    const box=modal?.querySelector('.modal');
    if(!box)return;
    box.classList.add('ps-shared-login-modal');
    box.innerHTML=`<button type="button" class="ps-login-close" onclick="closeLogin()" aria-label="Close">×</button><div class="ps-login-title">Login</div><div class="ps-login-text">Please login first to continue.</div><button type="button" class="ps-oauth-btn ps-google-btn" onclick="loginWithProvider('google')"><span class="ps-google-icon">G</span><span>Continue with Google</span></button><button type="button" class="ps-oauth-btn ps-discord-btn" onclick="loginWithProvider('discord')"><span class="ps-discord-icon">◉</span><span>Continue with Discord</span></button><div id="puzzleAuthStatus" class="ps-login-status"></div>`;
  }

  const originalOpenLogin=window.openLogin;
  window.openLogin=async function(){
    installAuthUI();
    if(sharedUser){renderAuthArea();return}
    renderLoginModal();
    document.getElementById('loginModal')?.classList.remove('hidden');
  };

  window.closeLogin=function(){document.getElementById('loginModal')?.classList.add('hidden')};

  const originalUpdateAuthArea=window.updateAuthArea;
  window.updateAuthArea=function(){renderAuthArea()};

  const originalLogout=window.logoutLocal;
  window.logoutLocal=async function(){
    if(sb)await sb.auth.signOut();
    sharedUser=null;sharedProfile=null;window.susGamesCurrentUser=null;window.susGamesCurrentName=null;
    renderAuthArea();
    if(typeof toast==='function')toast('Logged out from Sus Games.');
  };

  const boot=async()=>{
    try{
      installAuthUI();
      await load();
      sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      window.susGamesSupabase=sb;
      const h=new URLSearchParams(location.hash.replace(/^#/,''));
      const access=h.get('access_token'),refresh=h.get('refresh_token');
      if(access&&refresh){const {error}=await sb.auth.setSession({access_token:access,refresh_token:refresh});if(!error)history.replaceState(null,'',location.pathname+location.search)}
      const {data:{session}}=await sb.auth.getSession();
      sharedUser=session?.user||null;
      if(sharedUser){
        try{const q=await sb.from('profiles').select('id,user_id,display_name,avatar_url').eq('id',sharedUser.id).maybeSingle();sharedProfile=q.data||null}catch{}
        const name=displayName();
        window.susGamesCurrentUser={...sharedUser,profile:sharedProfile};
        window.susGamesCurrentName=name;
        localStorage.setItem('puzzle_sus_shared_user',JSON.stringify({id:sharedUser.id,name,avatar:sharedProfile?.avatar_url||null}));
        window.getLocalAuth=()=>({username:name,shared:true,user_id:sharedUser.id,user:sharedUser});
        renderAuthArea();
        const logo=document.querySelector('.logo');
        if(logo){logo.style.cursor='pointer';logo.title='Back to Sus Games';logo.onclick=()=>location.href=HUB}
        if(!document.getElementById('susHubBack')){const back=document.createElement('button');back.id='susHubBack';back.textContent='Sus Games';back.title='Back to Sus Games';back.style.cssText='position:fixed;right:18px;bottom:18px;z-index:6000;border:1px solid rgba(139,92,246,.45);background:#211d37;color:#fff;border-radius:11px;padding:9px 13px;font-weight:800;cursor:pointer;box-shadow:0 8px 25px rgba(0,0,0,.3)';back.onclick=()=>location.href=HUB;document.body.appendChild(back)}
      }else renderAuthArea();

      sb.auth.onAuthStateChange(async(_event,session2)=>{
        sharedUser=session2?.user||null;sharedProfile=null;
        if(sharedUser){try{const q=await sb.from('profiles').select('id,user_id,display_name,avatar_url').eq('id',sharedUser.id).maybeSingle();sharedProfile=q.data||null}catch{}}
        renderAuthArea();
      });

      const originalStart=window.startGame;
      if(typeof originalStart==='function'&&!window.__susPuzzleStartWrapped){window.__susPuzzleStartWrapped=true;window.startGame=function(puzzle){activePuzzle=puzzle||null;activeRun=(crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now()+'-'+Math.random());return originalStart.apply(this,arguments)}}
      const originalResult=window.openResultModal;
      if(typeof originalResult==='function'&&!window.__susPuzzleResultWrapped){window.__susPuzzleResultWrapped=true;window.openResultModal=function(score,time,bonus){const result=originalResult.apply(this,arguments);record(sharedUser,activePuzzle,score);return result}}
    }catch(e){console.warn('[Sus Games SSO]',e)}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
