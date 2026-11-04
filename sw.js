const C='shumno-v4';
const CARDS=[...'6789'.split(''),'10','J','Q','K','A'].flatMap(r=>['s','h','d','c'].map(x=>'cards/'+r+x+'.webp'));
const SHELL=['./','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();
 e.waitUntil(caches.open(C).then(c=>Promise.allSettled([...SHELL,...CARDS].map(u=>c.add(u)))))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET')return;
 const u=new URL(r.url);if(u.origin!==location.origin)return;
 const put=res=>{if(res&&res.ok&&res.type==='basic'){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp)).catch(()=>{})}return res};
 if(/\/(cards\/|icon-)/.test(u.pathname)){ // картинки: сначала кеш
  e.respondWith(caches.match(r).then(m=>m||fetch(r).then(put).catch(()=>Response.error())));return}
 e.respondWith(fetch(r).then(put).catch(()=>caches.match(r).then(m=>m||(r.mode==='navigate'?caches.match('./'):null)).then(m=>m||Response.error())))});
