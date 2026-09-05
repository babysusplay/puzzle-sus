/* Sus Games shared-login bridge + shared score recording. */
(() => {
  'use strict';

  const SUPABASE_URL='https://wnjsajfahsqunfesmetu.supabase.co';
  const SUPABASE_KEY='sb_publishable_S_ePD9oEegH0R0XR8LGvjQ_sMs9OZSm';
  const HUB='https://babysusplay.github.io/sus-games/';
  const SCORE_KEY='sus_games_recorded_puzzle_runs_v1';

  const load=()=>new Promise((resolve,reject)=>{
    if(window.supabase){resolve();return;}
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.onload=resolve;
    s.onerror=reject;
    document.head.appendChild(s);
  });

  function readRecorded(){
    try{return new Set(JSON.parse(localStorage.getItem(SCORE_KEY)||'[]'));}
    catch{return new Set();}
  }
  function writeRecorded(set){
    try{localStorage.setItem(SCORE_KEY,JSON.stringify([...set].slice(-200)));}catch{}
  }

  let activePuzzle=null;
  let activeRunId=null;

  async function recordPuzzleScore(sb,userId,puzzle,score,elapsed,runId){
    if(!sb||!userId||!puzzle||!runId||!Number.isFinite(Number(score)))return;

    const recorded=readRecorded();
    if(recorded.has(runId))return;

    const payload={
      user_id:userId,
      game_id:String(puzzle.id||''),
      game_type:'puzzle',
      score:Number(score),
      created_at:new Date().toISOString()
    };

    try{
      const {error}=await sb.from('game_scores').insert(payload);
      if(error){console.warn('[Sus Games score]',error);return;}
      recorded.add(runId);
      writeRecorded(recorded);
      window.dispatchEvent(new CustomEvent('sus-game-score-recorded',{detail:{gameType:'puzzle',gameId:puzzle.id,score:Number(score),elapsed:Number(elapsed)||0}}));
    }catch(e){console.warn('[Sus Games score]',e)}
  }

  const boot=async()=>{
    try{
      await load();
      const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
      window.susGamesSupabase=sb;

      const params=new URLSearchParams(location.hash.replace(/^#/,''));
      const access=params.get('access_token');
      const refresh=params.get('refresh_token');
      if(access&&refresh){
        const {error}=await sb.auth.setSession({access_token:access,refresh_token:refresh});
        if(!error)history.replaceState(null,'',location.pathname+location.search);
      }

      const {data:{session}}=await sb.auth.getSession();
      if(!session?.user)return;

      let profile=null;
      try{
        const q=await sb.from('profiles').select('id,user_id,display_name,avatar_url').eq('id',session.user.id).maybeSingle();
        profile=q.data||null;
      }catch{}

      const name=profile?.display_name||session.user.user_metadata?.full_name||session.user.email?.split('@')[0]||'Player';
      window.susGamesCurrentUser={...session.user,profile};
      window.susGamesCurrentName=name;
      localStorage.setItem('puzzle_sus_shared_user',JSON.stringify({id:session.user.id,name,avatar:profile?.avatar_url||null}));
      window.getLocalAuth=()=>({username:name,shared:true,user_id:session.user.id});
      if(typeof window.updateAuthArea==='function')window.updateAuthArea();

      const logo=document.querySelector('.logo');
      if(logo){logo.style.cursor='pointer';logo.title='Back to Sus Games';logo.onclick=()=>location.href=HUB;}

      if(!document.getElementById('susHubBack')){
        const back=document.createElement('button');
        back.id='susHubBack';
        back.textContent='Sus Games';
        back.title='Back to Sus Games';
        back.style.cssText='position:fixed;right:18px;bottom:18px;z-index:6000;border:1px solid rgba(139,92,246,.45);background:#211d37;color:#fff;border-radius:11px;padding:9px 13px;font-weight:800;cursor:pointer;box-shadow:0 8px 25px rgba(0,0,0,.3)';
        back.onclick=()=>location.href=HUB;
        document.body.appendChild(back);
      }

      /* Capture each real game run without replacing Puzzle's game logic. */
      const originalStart=window.startGame;
      if(typeof originalStart==='function'&&!window.__susPuzzleStartWrapped){
        window.__susPuzzleStartWrapped=true;
        window.startGame=function(puzzle){
          activePuzzle=puzzle||null;
          activeRunId=(crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now()+'-'+Math.random());
          return originalStart.apply(this,arguments);
        };
      }

      /* completeGame() schedules openResultModal(score,time,bonus), so this
         hook receives the final score after the completion bonus is applied. */
      const originalResult=window.openResultModal;
      if(typeof originalResult==='function'&&!window.__susPuzzleResultWrapped){
        window.__susPuzzleResultWrapped=true;
        window.openResultModal=function(score,time,bonus){
          const result=originalResult.apply(this,arguments);
          recordPuzzleScore(sb,session.user.id,activePuzzle,score,time,activeRunId);
          return result;
        };
      }

    }catch(e){console.warn('[Sus Games SSO]',e)}
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
