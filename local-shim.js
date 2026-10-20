/* Local replacement for the Claude-hosted runtime. Only used when window.claude is missing,
   so this page can run from the small Node server (server.js). */
(function(){
  if (window.claude) return;
  const ls = {
    get:k=>{try{return localStorage.getItem(k)}catch(_){return null}},
    set:(k,v)=>{try{localStorage.setItem(k,v)}catch(_){}},
    del:k=>{try{localStorage.removeItem(k)}catch(_){}}
  };
  let uid = ls.get('cmt_uid');
  if (!uid){ uid = 'u'+Math.random().toString(36).slice(2,10)+Date.now().toString(36); ls.set('cmt_uid',uid); }
  let admin = ls.get('cmt_admin') || '';
  let myName = ls.get('cmt_name') || '';

  async function api(method, url, body){
    const r = await fetch(url,{method,cache:'no-store',headers:{'Content-Type':'application/json','x-admin-key':admin},body:body?JSON.stringify(body):undefined});
    if(!r.ok){ const e=new Error('http '+r.status); e.code=r.status===401?'not_writer':'error'; throw e; }
    return r.json();
  }

  const watchers = new Set();
  const poll = () => { watchers.forEach(w=>w.tick()); health(); };
  setInterval(poll, 2500);

  const db = {
    collection: c => ({
      onSnapshot(ok){
        const w = { last:'', async tick(){
          try{
            const rows = await api('GET','/api/'+c), j = JSON.stringify(rows);
            if (j !== w.last){ w.last = j; ok({docs: rows.map(r=>({id:r.id, data:()=>r.data}))}); }
          }catch(_){ /* server unreachable: keep what we have and retry */ }
        }};
        watchers.add(w); w.tick();
        return () => watchers.delete(w);
      }
    }),
    doc: p => { const [c,id] = p.split('/'); return {
      set:    async d => { await api('PUT',   '/api/'+c+'/'+id, d); poll(); },
      update: async d => { await api('PATCH', '/api/'+c+'/'+id, d); poll(); },
      delete: async () => { await api('DELETE','/api/'+c+'/'+id);    poll(); }
    };}
  };

  const user = {
    isOwner: async () => !!admin,
    canEdit: async () => !!admin,
    can: async () => true,
    id: async () => uid,
    me: async () => ({id:uid, name:myName}),
    async profiles(ids){
      const rows = await api('GET','/api/users'), m = {};
      rows.forEach(r=>{ m[r.id] = r.data; });
      const out = {};
      ids.forEach(i=>{ out[i] = {name:(m[i]&&m[i].name)||'', isMe:i===uid}; });
      return out;
    }
  };

  const downloads = {
    async save({filename, data}){
      const type = /\.svg$/.test(filename)?'image/svg+xml':/\.md$/.test(filename)?'text/markdown':'application/octet-stream';
      const blob = data instanceof Blob ? data : new Blob([data],{type});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.append(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
      return 'saved';
    }
  };

  window.claude = { use: async n => ({db,user,downloads}[n] || null) };

  /* in-page dialog (window.prompt does not work in VS Code's built-in browser) */
  function ask(title, label, o){
    o = o || {};
    return new Promise(resolve=>{
      const d = document.createElement('dialog'), f = document.createElement('form');
      f.method = 'dialog';
      f.innerHTML = '<h2></h2><label class="f"><span></span><input autocomplete="off" required></label><p class="err" role="alert"></p><div class="dacts"><div></div><div><button type="button" class="btn">Cancel</button><button type="submit" class="btn primary">OK</button></div></div>';
      f.querySelector('h2').textContent = title;
      f.querySelector('span').textContent = label;
      const inp = f.querySelector('input'), err = f.querySelector('.err');
      inp.value = o.value || ''; if (o.password) inp.type = 'password';
      f.querySelector('button[type=button]').onclick = () => { d.close(); resolve(null); };
      f.onsubmit = async e => {
        e.preventDefault();
        const v = inp.value.trim(); if (!v) return;
        if (o.validate){ const m = await o.validate(v); if (m){ err.textContent = m; return; } }
        d.close(); resolve(v);
      };
      d.addEventListener('close', () => { d.remove(); resolve(null); });
      d.append(f); document.body.append(d); d.showModal(); inp.focus();
    });
  }

  async function saveName(n){ myName = n; ls.set('cmt_name',n); try{ await api('PUT','/api/users/'+uid,{name:n}); }catch(_){} }
  async function askName(){
    const n = await ask('Your name','Shown on the cards you add:',{value:myName});
    if (n){ await saveName(n.slice(0,60)); location.reload(); }
  }

  /* connection status light */
  let chip = null;
  async function health(){
    if (!chip) return;
    try{
      const r = await fetch('/api/health',{cache:'no-store'}), j = await r.json();
      if (!j.ok) throw 0;
      chip.textContent = 'Server connected · '+j.tasks+' tasks · '+j.cards+' cards';
      chip.style.background = 'var(--p1s)'; chip.style.color = 'var(--p1)';
    }catch(_){
      chip.textContent = 'Server NOT connected';
      chip.style.background = 'var(--warns)'; chip.style.color = 'var(--bad)';
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const bar = document.querySelector('.top .wrap'); if(!bar) return;
    const mk = (txt,fn) => { const b=document.createElement('button'); b.type='button'; b.className='btn small ghost'; b.textContent=txt; b.addEventListener('click',fn); return b; };
    chip = document.createElement('span'); chip.className = 'pill'; chip.textContent = 'Checking server…';
    chip.style.background = 'var(--line)'; chip.setAttribute('role','status');
    bar.append(
      chip,
      mk(myName ? 'Name: '+myName : 'Set your name', askName),
      mk(admin ? 'Editor: on (log out)' : 'Editor login', async () => {
        if (admin){ ls.del('cmt_admin'); location.reload(); return; }
        const key = await ask('Editor login','Editor passcode:',{password:true,validate:async v=>{
          try{ const r = await fetch('/api/auth',{headers:{'x-admin-key':v}}); return r.ok ? '' : 'That passcode is not correct.'; }
          catch(_){ return 'Cannot reach the server.'; }
        }});
        if (key){ ls.set('cmt_admin',key); location.reload(); }
      })
    );
    health();
    fetch('/api/health').then(r=>r.text()).then(t=>{ JSON.parse(t); }).catch(()=>{
      const d=document.createElement('div'); d.className='wrap'; d.style.paddingTop='16px';
      d.innerHTML='<div class="banner" role="alert"><span><b>Cannot reach the team server. </b>This page needs the small local server. In the VS Code terminal run <code>node server.js</code>, then open the address it prints (usually <code>http://localhost:3000</code>). Opening the file directly or with Live Server cannot save anything.</span></div>';
      document.querySelector('main').before(d);
    });
    if (myName) saveName(myName); else setTimeout(askName, 400);
  });
})();
