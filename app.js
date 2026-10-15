import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const cfg=window.VCS_CONFIG; const sb=createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
let me=null,myProfile=null,channel=null; const $=id=>document.getElementById(id); const esc=s=>(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); const dt=v=>new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});

window.go=async(id,btn)=>{if(id==='inicio')window.scrollTo({top:0,left:0,behavior:'auto'});document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$(id).classList.add('active');document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active');if(id==='inicio'){await loadFeed();try{await loadStories();}catch(e){console.warn('Stories:',e)}}if(id==='pessoas')await loadPeople();if(id==='oracoes')await loadPrayers();if(id==='reels')await loadReels();if(id==='testemunhos')await loadTestimonies();if(id==='palavra')await loadWords();if(id==='podcast')await loadPodcasts();if(id==='louvores')await loadSongs();if(id==='mensagens')await loadChatUsers();if(id==='notificacoes')await loadNotifications();if(id==='perfil')await loadProfile();scrollTo({top:0,behavior:'smooth'});};
window.signup=async()=>{const name=$('authName').value.trim(),email=$('authEmail').value.trim(),password=$('authPass').value;if(!name||!email||password.length<6){$('authMsg').textContent='Preencha nome, e-mail e senha com pelo menos 6 caracteres.';return}const {data,error}=await sb.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:location.origin}});$('authMsg').textContent=error?error.message:(data.session?'Conta criada e conectada!':'Conta criada. Confirme o e-mail e depois entre.');};
window.login=async()=>{const {error}=await sb.auth.signInWithPassword({email:$('authEmail').value.trim(),password:$('authPass').value});$('authMsg').textContent=error?error.message:'';}; window.logout=()=>sb.auth.signOut();
async function ensureProfile(){let {data}=await sb.from('profiles').select('*').eq('id',me.id).maybeSingle();if(!data){const name=me.user_metadata?.display_name||me.email.split('@')[0]||'Membro';const r=await sb.from('profiles').insert({id:me.id,display_name:name}).select().single();data=r.data}myProfile=data;}
async function upload(bucket,file){if(!file)return null;const ext=(file.name.split('.').pop()||'bin').toLowerCase();const path=`${me.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;const {error}=await sb.storage.from(bucket).upload(path,file,{upsert:false});if(error)throw error;return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;}
async function start(session){me=session?.user||null;if(!me){$('auth').classList.remove('hidden');$('app').classList.add('hidden');return}await ensureProfile();$('auth').classList.add('hidden');$('app').classList.remove('hidden');$('topAvatar').src=myProfile?.avatar_url||'./icon-192.png';await Promise.all([loadFeed(),loadNotifCount(),loadStories().catch(e=>console.warn('Stories:',e))]);if(channel)sb.removeChannel(channel);channel=sb.channel('vcp-live').on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`user_id=eq.${me.id}`},loadNotifCount).subscribe();}

window.createPost=async()=>{const content=$('postText').value.trim(),file=$('postImage').files[0];if(!content&&!file)return;try{const image_url=file?await upload('post-images',file):null;const {error}=await sb.from('posts').insert({user_id:me.id,content:content||'📷',image_url});if(error)throw error;$('postText').value='';$('postImage').value='';await loadFeed()}catch(e){$('postMsg').textContent=e.message}};
async function loadFeed(){const {data:posts,error}=await sb.from('posts').select('id,user_id,content,image_url,created_at,profiles!posts_user_id_fkey(display_name,avatar_url)').order('created_at',{ascending:false}).limit(50);if(error){$('feed').innerHTML=`<div class="card">${esc(error.message)}</div>`;return}const ids=(posts||[]).map(p=>p.id);const {data:likes}=ids.length?await sb.from('likes').select('post_id,user_id').in('post_id',ids):{data:[]};const {data:comments}=ids.length?await sb.from('comments').select('id,post_id,user_id,content,created_at,profiles!comments_user_id_fkey(display_name)').in('post_id',ids).order('created_at'):{data:[]};$('feed').innerHTML=(posts||[]).map(p=>{const pl=(likes||[]).filter(x=>x.post_id===p.id),mine=pl.some(x=>x.user_id===me.id),pc=(comments||[]).filter(x=>x.post_id===p.id);return `<article class="post"><div class="posthead"><img class="ava" src="${p.profiles?.avatar_url||'./icon-192.png'}"><div><b style="color:var(--gold)">${esc(p.profiles?.display_name||'Membro')}</b><div class="muted">${dt(p.created_at)}</div></div></div>${p.image_url?`<img class="postimg" src="${esc(p.image_url)}">`:''}<div class="postbody">${esc(p.content).replace(/\n/g,'<br>')}</div><div class="actions"><button class="${mine?'on':''}" onclick="toggleLike(${p.id},${mine},'${p.user_id}')">❤️ ${pl.length}</button><button>💬 ${pc.length}</button></div><div class="commentbox">${pc.map(c=>`<div class="comment"><b>${esc(c.profiles?.display_name||'Membro')}:</b> ${esc(c.content)}</div>`).join('')}<div class="row"><input id="c-${p.id}" class="field grow" maxlength="500" placeholder="Comentar..."><button class="btn" onclick="addComment(${p.id},'${p.user_id}')">Enviar</button></div></div></article>`}).join('')||'<div class="empty">Ainda não há publicações.</div>';}
window.toggleLike=async(id,on,owner)=>{if(on)await sb.from('likes').delete().eq('post_id',id).eq('user_id',me.id);else{const {error}=await sb.from('likes').insert({post_id:id,user_id:me.id});if(error)return alert(error.message);if(owner!==me.id)await notify(owner,'like',String(id),`${myProfile.display_name} curtiu sua publicação.`)}await loadFeed();};
window.addComment=async(id,owner)=>{const input=$('c-'+id),content=input.value.trim();if(!content)return;const {error}=await sb.from('comments').insert({post_id:id,user_id:me.id,content});if(error)return alert(error.message);input.value='';if(owner!==me.id)await notify(owner,'comment',String(id),`${myProfile.display_name} comentou na sua publicação.`);await loadFeed();};

window.createPrayer=async()=>{const content=$('prayerText').value.trim();if(!content)return;const {error}=await sb.from('prayers').insert({user_id:me.id,content,is_testimony:false});if(error)return alert(error.message);$('prayerText').value='';await loadPrayers();};
async function loadPrayers(){const {data:p,error}=await sb.from('prayers').select('id,user_id,content,created_at,profiles!prayers_user_id_fkey(display_name,avatar_url)').eq('is_testimony',false).order('created_at',{ascending:false});if(error){$('prayerList').innerHTML=`<div class="card">${esc(error.message)}</div>`;return}const ids=(p||[]).map(x=>x.id);const {data:s}=ids.length?await sb.from('prayer_support').select('prayer_id,user_id').in('prayer_id',ids):{data:[]};$('prayerList').innerHTML=(p||[]).map(x=>{const a=(s||[]).filter(y=>y.prayer_id===x.id),mine=a.some(y=>y.user_id===me.id);return `<div class="prayer"><b>${esc(x.profiles?.display_name||'Membro')}</b><div class="muted">${dt(x.created_at)}</div><p>${esc(x.content)}</p><button class="btn ${mine?'alt':''}" onclick="togglePrayer(${x.id},'${x.user_id}',${mine})">🤲 ${mine?'Orando':'Estou orando'} (${a.length})</button></div>`}).join('')||'<div class="empty">Nenhum pedido de oração ainda.</div>';}
window.togglePrayer=async(id,owner,on)=>{if(on)await sb.from('prayer_support').delete().eq('prayer_id',id).eq('user_id',me.id);else{await sb.from('prayer_support').insert({prayer_id:id,user_id:me.id});if(owner!==me.id)await notify(owner,'prayer',String(id),`${myProfile.display_name} está orando por você.`)}await loadPrayers();};

window.createTestimony=async()=>{const content=$('testimonyText').value.trim(),file=$('testimonyImage').files[0];if(!content)return;try{$('testimonyMsg').textContent='Publicando...';const image_url=file?await upload('post-images',file):null;const {error}=await sb.from('testimonies').insert({user_id:me.id,content,image_url});if(error)throw error;$('testimonyText').value='';$('testimonyImage').value='';$('testimonyMsg').textContent='Testemunho publicado!';await loadTestimonies()}catch(e){$('testimonyMsg').textContent=e.message}};
async function loadTestimonies(){const {data,error}=await sb.from('testimonies').select('id,user_id,content,image_url,created_at,profiles!testimonies_user_id_fkey(display_name,avatar_url)').order('created_at',{ascending:false});if(error){$('testimonyList').innerHTML=`<div class="card">${esc(error.message)}</div>`;return}$('testimonyList').innerHTML=(data||[]).map(x=>`<article class="testimony-card"><h4>✨ ${esc(x.profiles?.display_name||'Membro')}</h4><div class="muted">${dt(x.created_at)}</div>${x.image_url?`<img class="media-img" src="${esc(x.image_url)}">`:''}<p class="testimony-text">${esc(x.content)}</p></article>`).join('')||'<div class="empty">Nenhum testemunho publicado ainda.</div>';}

window.createWord=async()=>{const title=$('wordTitle').value.trim(),ref=$('wordRef').value.trim(),content=$('wordText').value.trim();if(!title||!content)return;const {error}=await sb.from('devotionals').insert({user_id:me.id,title,bible_reference:ref,content});$('wordMsg').textContent=error?error.message:'Palavra publicada!';if(!error){$('wordTitle').value='';$('wordRef').value='';$('wordText').value='';await loadWords()}};
async function loadWords(){const {data,error}=await sb.from('devotionals').select('id,title,bible_reference,content,created_at,profiles!devotionals_user_id_fkey(display_name)').order('created_at',{ascending:false});if(error){$('wordList').innerHTML=`<div class="card">${esc(error.message)}</div>`;return}$('wordList').innerHTML=(data||[]).map(x=>`<article class="word-card"><h4>📖 ${esc(x.title)}</h4><div class="word-ref">${esc(x.bible_reference||'')}</div><p class="word-text">${esc(x.content)}</p><div class="muted">${esc(x.profiles?.display_name||'Membro')} • ${dt(x.created_at)}</div></article>`).join('')||'<div class="empty">Nenhuma Palavra publicada ainda.</div>';}

window.createPodcast=async()=>{const title=$('podTitle').value.trim(),guest=$('podGuest').value.trim(),description=$('podDesc').value.trim(),file=$('podFile').files[0];if(!title||!file){$('podMsg').textContent='Informe o título e escolha um áudio MP3.';return}try{$('podMsg').textContent='Enviando áudio...';const audio_url=await upload('media-audio',file);const {error}=await sb.from('podcast_episodes').insert({user_id:me.id,title,guest,description,audio_url});if(error)throw error;$('podTitle').value='';$('podGuest').value='';$('podDesc').value='';$('podFile').value='';$('podMsg').textContent='Episódio publicado!';await loadPodcasts()}catch(e){$('podMsg').textContent=e.message}};
async function loadPodcasts(){const {data,error}=await sb.from('podcast_episodes').select('id,title,guest,description,audio_url,created_at,profiles!podcast_episodes_user_id_fkey(display_name)').order('created_at',{ascending:false});if(error){$('podcastList').innerHTML=`<div class="card">${esc(error.message)}</div>`;return}let rows=data||[];if(!rows.length){rows=[{title:'Podcast Vem Comigo Records — Episódio 01',guest:'Léo Lima & Fernandes',description:'Música, fé e propósito.',audio_url:'./assets/podcast-episodio-01.mp3',created_at:new Date().toISOString(),profiles:{display_name:'Vem Comigo Records'}}]}$('podcastList').innerHTML=rows.map(x=>`<article class="media-card"><h4>🎙️ ${esc(x.title)}</h4><div class="media-meta">${esc(x.guest||'')} • ${esc(x.profiles?.display_name||'')}</div><p>${esc(x.description||'')}</p><audio controls preload="none" src="${esc(x.audio_url)}"></audio></article>`).join('');}

window.createSong=async()=>{const title=$('songTitle').value.trim(),artist=$('songArtist').value.trim(),file=$('songFile').files[0];if(!title||!file){$('songMsg').textContent='Informe o nome do louvor e escolha um MP3.';return}try{$('songMsg').textContent='Enviando louvor...';const audio_url=await upload('media-audio',file);const {error}=await sb.from('songs').insert({user_id:me.id,title,artist,audio_url});if(error)throw error;$('songTitle').value='';$('songArtist').value='';$('songFile').value='';$('songMsg').textContent='Louvor publicado!';await loadSongs()}catch(e){$('songMsg').textContent=e.message}};
async function loadSongs(){const {data,error}=await sb.from('songs').select('id,title,artist,audio_url,created_at,profiles!songs_user_id_fkey(display_name)').order('created_at',{ascending:false});if(error){$('songList').innerHTML=`<div class="card">${esc(error.message)}</div>`;return}$('songList').innerHTML=(data||[]).map(x=>`<article class="media-card"><h4>🎵 ${esc(x.title)}</h4><div class="media-meta">${esc(x.artist||'Vem Comigo Records')}</div><audio controls preload="none" src="${esc(x.audio_url)}"></audio></article>`).join('')||'<div class="empty">Nenhum louvor publicado ainda. Use o formulário acima para enviar o primeiro MP3.</div>';}

window.loadPeople=async()=>{const q=($('peopleSearch')?.value||'').toLowerCase();const {data:people}=await sb.from('profiles').select('id,display_name,bio,avatar_url').neq('id',me.id).order('display_name');const {data:follows}=await sb.from('follows').select('following_id').eq('follower_id',me.id);const set=new Set((follows||[]).map(x=>x.following_id));$('peopleList').innerHTML=(people||[]).filter(p=>!q||(p.display_name||'').toLowerCase().includes(q)).map(p=>`<div class="person"><img class="ava" src="${p.avatar_url||'./icon-192.png'}"><div class="grow"><b>${esc(p.display_name)}</b><div class="muted">${esc(p.bio||'')}</div></div><button class="btn ${set.has(p.id)?'alt':''}" onclick="toggleFollow('${p.id}',${set.has(p.id)})">${set.has(p.id)?'Seguindo':'Seguir'}</button></div>`).join('');};
window.toggleFollow=async(id,on)=>{if(on)await sb.from('follows').delete().eq('follower_id',me.id).eq('following_id',id);else{const {error}=await sb.from('follows').insert({follower_id:me.id,following_id:id});if(error)return alert(error.message);await notify(id,'follow',me.id,`${myProfile.display_name} começou a seguir você.`)}await loadPeople();};
async function loadChatUsers(){const {data}=await sb.from('profiles').select('id,display_name').neq('id',me.id).order('display_name');$('chatUser').innerHTML='<option value="">Escolha uma pessoa</option>'+ (data||[]).map(p=>`<option value="${p.id}">${esc(p.display_name)}</option>`).join('');}
window.loadChat=async()=>{const other=$('chatUser').value;if(!other){$('chat').innerHTML='';return}const {data}=await sb.from('messages').select('*').or(`and(sender_id.eq.${me.id},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${me.id})`).order('created_at');$('chat').innerHTML=(data||[]).map(m=>`<div class="bubble ${m.sender_id===me.id?'mine':''}">${esc(m.content)}<div class="muted">${dt(m.created_at)}</div></div>`).join('');await sb.from('messages').update({read_at:new Date().toISOString()}).eq('sender_id',other).eq('receiver_id',me.id).is('read_at',null);};
window.sendMessage=async()=>{const other=$('chatUser').value,content=$('chatText').value.trim();if(!other||!content)return;const {error}=await sb.from('messages').insert({sender_id:me.id,receiver_id:other,content});if(error)return alert(error.message);$('chatText').value='';await notify(other,'message',me.id,`${myProfile.display_name} enviou uma mensagem.`);await loadChat();};
async function notify(user_id,type,entity_id,text){await sb.from('notifications').insert({user_id,actor_id:me.id,type,entity_id,text});}
async function loadNotifCount(){const {count}=await sb.from('notifications').select('*',{count:'exact',head:true}).eq('user_id',me.id).is('read_at',null);$('notifCount').textContent=count||0;$('notifCount').classList.toggle('hidden',!(count>0));}
async function loadNotifications(){const {data}=await sb.from('notifications').select('*').eq('user_id',me.id).order('created_at',{ascending:false});$('notifList').innerHTML=(data||[]).map(n=>`<div class="notif">${esc(n.text)}<div class="muted">${dt(n.created_at)}</div></div>`).join('')||'<div class="empty">Nenhuma notificação.</div>';}
window.markAllRead=async()=>{await sb.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',me.id).is('read_at',null);await Promise.all([loadNotifications(),loadNotifCount()]);};
async function loadProfile(){await ensureProfile();$('profileAvatar').src=myProfile.avatar_url||'./icon-192.png';$('profileName').textContent=myProfile.display_name;$('pName').value=myProfile.display_name||'';$('pBio').value=myProfile.bio||'';$('pVerse').value=myProfile.verse||'';const [{count:a},{count:b},{count:c}]=await Promise.all([sb.from('follows').select('*',{count:'exact',head:true}).eq('following_id',me.id),sb.from('follows').select('*',{count:'exact',head:true}).eq('follower_id',me.id),sb.from('posts').select('*',{count:'exact',head:true}).eq('user_id',me.id)]);$('profileCounts').textContent=`${c||0} posts · ${a||0} seguidores · ${b||0} seguindo`;}
window.saveProfile=async()=>{try{const file=$('pAvatarFile').files[0];let avatar_url=myProfile.avatar_url;if(file)avatar_url=await upload('avatars',file);const {error}=await sb.from('profiles').update({display_name:$('pName').value.trim()||'Membro',bio:$('pBio').value.trim(),verse:$('pVerse').value.trim(),avatar_url}).eq('id',me.id);if(error)throw error;$('profileMsg').textContent='Perfil salvo!';await ensureProfile();$('topAvatar').src=myProfile.avatar_url||'./icon-192.png';await loadProfile()}catch(e){$('profileMsg').textContent=e.message}};


let soundPreview=null;

window.openSoundPicker=async()=>{
  $('soundPicker').classList.remove('hidden');
  await loadReelSounds();
};

window.closeSoundPicker=()=>{
  $('soundPicker').classList.add('hidden');
  if(soundPreview){
    try{soundPreview.pause()}catch{}
    soundPreview=null;
  }
};

async function loadReelSounds(){
  const box=$('soundList');
  box.innerHTML='<div class="empty">Carregando sons...</div>';

  const {data,error}=await sb
    .from('reel_sounds')
    .select('id,title,artist,duration_seconds,audio_url,active')
    .eq('active',true)
    .order('id');

  if(error){
    box.innerHTML=`<div class="empty">${esc(error.message)}</div>`;
    return;
  }

  box.innerHTML=(data||[]).map(s=>`
    <div class="sound-item" id="sound-${s.id}">
      <button type="button" class="sound-play" onclick="previewSound(event,'${esc(s.audio_url)}',${s.id})">▶</button>
      <div class="sound-info" onclick="selectSound('${esc(s.audio_url)}','${esc(s.title)}',${s.id})">
        <strong>${esc(s.title)}</strong>
        <small>${esc(s.artist||'Sons Vem+')} • ${s.duration_seconds||30}s</small>
      </div>
      <button type="button" class="sound-use" onclick="selectSound('${esc(s.audio_url)}','${esc(s.title)}',${s.id})">Usar</button>
    </div>
  `).join('') || '<div class="empty">Nenhum Som Vem+ encontrado.</div>';
}

window.previewSound=(event,url,id)=>{
  event.stopPropagation();

  if(soundPreview){
    try{soundPreview.pause()}catch{}
    soundPreview=null;
  }

  const btn=event.currentTarget;

  const a=new Audio(url);
  soundPreview=a;
  btn.textContent='❚❚';

  a.play().catch(()=>{btn.textContent='▶'});

  a.onended=()=>{
    btn.textContent='▶';
    if(soundPreview===a)soundPreview=null;
  };

  setTimeout(()=>{
    if(soundPreview===a){
      try{a.pause()}catch{}
      btn.textContent='▶';
      soundPreview=null;
    }
  },12000);
};

window.selectSound=(url,title,id)=>{
  $('selectedSoundUrl').value=url;
  $('selectedSoundTitle').value=title;
  $('selectedSoundLabel').textContent='♫ '+title;

  document.querySelectorAll('.sound-item').forEach(x=>x.classList.remove('selected'));
  $('sound-'+id)?.classList.add('selected');

  if(soundPreview){
    try{soundPreview.pause()}catch{}
    soundPreview=null;
  }

  setTimeout(()=>closeSoundPicker(),250);
};

window.toggleReelCreator=()=>{
  $('reelCreator').classList.toggle('hidden');
};

window.createReel=async()=>{
  const image=$('reelImage').files[0];
  const caption=$('reelCaption').value.trim();
  const audio_url=$('selectedSoundUrl').value||null;

  if(!image){
    $('reelMsg').textContent='Adicione uma foto para criar o Reels.';
    return;
  }

  try{
    $('reelMsg').textContent='Publicando Reels...';

    const image_url=await upload('reels-images',image);

    const {error}=await sb.from('reels').insert({
      user_id:me.id,
      caption,
      image_url,
      audio_url
    });

    if(error)throw error;

    $('reelImage').value='';
    $('selectedSoundUrl').value='';$('selectedSoundTitle').value='';$('selectedSoundLabel').textContent='Adicionar música';
    $('reelCaption').value='';
    $('reelMsg').textContent='Reels publicado!';
    $('reelCreator').classList.add('hidden');
    await loadReels();
  }catch(e){
    $('reelMsg').textContent=e.message;
  }
};

async function loadReels(){
  const {data:reels,error}=await sb
    .from('reels')
    .select('id,user_id,caption,image_url,audio_url,created_at,profiles!reels_user_id_fkey(display_name,avatar_url)')
    .order('created_at',{ascending:false})
    .limit(50);

  if(error){
    $('reelsList').innerHTML=`<div class="card">${esc(error.message)}</div>`;
    return;
  }

  const ids=(reels||[]).map(x=>x.id);

  const {data:likes}=ids.length
    ? await sb.from('reel_likes').select('reel_id,user_id').in('reel_id',ids)
    : {data:[]};

  const {data:comments}=ids.length
    ? await sb.from('reel_comments')
        .select('id,reel_id,user_id,content,created_at,profiles!reel_comments_user_id_fkey(display_name)')
        .in('reel_id',ids)
        .order('created_at')
    : {data:[]};

  $('reelsList').innerHTML=(reels||[]).map(r=>{
    const rl=(likes||[]).filter(x=>x.reel_id===r.id);
    const liked=rl.some(x=>x.user_id===me.id);
    const rc=(comments||[]).filter(x=>x.reel_id===r.id);

    return `
      <article class="reel-full" id="reel-${r.id}" data-audio="${esc(r.audio_url||'')}">
        <img class="reel-full-bg" src="${esc(r.image_url)}" alt="Reels">

        <div class="reel-topbar">
          <button class="reel-back" onclick="go('inicio')">‹</button>
          <strong>Reels</strong>
          <button class="reel-camera" onclick="toggleReelCreator()">＋</button>
        </div>

        <div class="reel-right-actions">
          <button class="${liked?'on':''}" onclick="toggleReelLike(${r.id},${liked})">
            <span>♡</span><small>${rl.length}</small>
          </button>

          <button onclick="toggleReelComments(${r.id})">
            <span>💬</span><small>${rc.length}</small>
          </button>

          <button onclick="shareReel(${r.id})">
            <span>↗</span><small>Compartilhar</small>
          </button>

          ${r.audio_url ? `
          <button class="reel-music-btn" onclick="toggleReelSound(this,'${esc(r.audio_url)}')">
            <span>♫</span><small>Som</small>
          </button>` : ''}
        </div>

        <div class="reel-bottom-info">
          <div class="reel-user-row">
            <img class="reel-avatar" src="${esc(r.profiles?.avatar_url||'./icon-192.png')}" alt="">
            <strong>${esc(r.profiles?.display_name||'Membro')}</strong>
          </div>

          <div class="reel-caption">${esc(r.caption||'')}</div>

          ${r.audio_url ? `
            <div class="reel-music-label">♫ Som Vem+</div>
          ` : ''}

          ${rc.length ? `
            <button class="reel-see-comments" onclick="toggleReelComments(${r.id})">
              Ver ${rc.length} comentário${rc.length===1?'':'s'}
            </button>
          ` : ''}
        </div>

        <div id="reel-comments-${r.id}" class="reel-comments-sheet hidden">
          <div class="reel-comments-sheet-head">
            <strong>Comentários</strong>
            <button onclick="toggleReelComments(${r.id})">×</button>
          </div>

          <div class="reel-comments-list">
            ${rc.length
              ? rc.map(c=>`
                  <div class="reel-comment-row">
                    <div class="reel-comment-avatar">💬</div>
                    <div>
                      <b>${esc(c.profiles?.display_name||'Membro')}</b>
                      <p>${esc(c.content)}</p>
                    </div>
                  </div>
                `).join('')
              : '<div class="reel-no-comments">Seja o primeiro a comentar.</div>'
            }
          </div>

          <div class="reel-comment-compose">
            <input id="rc-${r.id}" maxlength="500" placeholder="Adicione um comentário...">
            <button onclick="addReelComment(${r.id})">Enviar</button>
          </div>
        </div>
      </article>
    `;
  }).join('') || '<div class="empty">Ainda não há Reels. Toque no + para criar o primeiro.</div>';

  setupReelAutoplay();
}
window.toggleReelLike=async(reelId,on)=>{
  if(on){
    await sb.from('reel_likes').delete().eq('reel_id',reelId).eq('user_id',me.id);
  }else{
    const {error}=await sb.from('reel_likes').insert({reel_id:reelId,user_id:me.id});
    if(error)return alert(error.message);
  }
  await loadReels();
};


window.toggleReelComments=(reelId)=>{
  const sheet=$('reel-comments-'+reelId);
  if(!sheet)return;

  const opening=sheet.classList.contains('hidden');

  document.querySelectorAll('.reel-comments-sheet')
    .forEach(x=>x.classList.add('hidden'));

  if(opening){
    sheet.classList.remove('hidden');
    setTimeout(()=>$('rc-'+reelId)?.focus(),120);
  }
};

window.addReelComment=async(reelId)=>{
  const input=$('rc-'+reelId);
  const content=input.value.trim();
  if(!content)return;

  const {error}=await sb.from('reel_comments').insert({
    reel_id:reelId,
    user_id:me.id,
    content
  });

  if(error)return alert(error.message);

  input.value='';
  $('reel-comments-'+reelId)?.classList.add('hidden');
  await loadReels();
};

window.shareReel=async(id)=>{
  const url=location.origin+location.pathname+'#reel-'+id;
  if(navigator.share){
    try{
      await navigator.share({title:'Reels Vem+',url});
      return;
    }catch{}
  }
  await navigator.clipboard?.writeText(url);
  alert('Link do Reels copiado!');
};


let reelAudio = null;
let reelAudioButton = null;
let reelSoundUnlocked = false;
let reelObserver = null;

function stopReelAudio(){
  if(reelAudio){
    try{ reelAudio.pause(); }catch{}
  }
  if(reelAudioButton){
    reelAudioButton.classList.remove('playing');
  }
  reelAudio = null;
  reelAudioButton = null;
}

async function startReelAudio(btn, url){
  if(!url) return false;

  if(reelAudio && reelAudioButton === btn){
    if(reelAudio.paused){
      try{
        reelAudio.muted = false;
        reelAudio.volume = 1;
        await reelAudio.play();
        btn.classList.add('playing');
        return true;
      }catch{
        return false;
      }
    }else{
      reelAudio.pause();
      btn.classList.remove('playing');
      return true;
    }
  }

  stopReelAudio();

  const audio = new Audio(url);
  audio.loop = true;
  audio.preload = 'auto';
  audio.muted = false;
  audio.volume = 1;

  reelAudio = audio;
  reelAudioButton = btn;

  audio.addEventListener('playing', ()=>{
    btn?.classList.add('playing');
  });

  audio.addEventListener('pause', ()=>{
    btn?.classList.remove('playing');
  });

  audio.addEventListener('error', ()=>{
    btn?.classList.remove('playing');
  });

  try{
    await audio.play();
    btn?.classList.add('playing');
    return true;
  }catch{
    return false;
  }
}

window.toggleReelSound = async (btn, url)=>{
  reelSoundUnlocked = true;

  const unlock = document.getElementById('reelSoundUnlock');
  unlock?.classList.add('hidden');

  const ok = await startReelAudio(btn, url);

  if(!ok){
    alert('Não foi possível tocar este som. Toque novamente ou escolha outro Som Vem+.');
  }
};

window.unlockReelSound = async ()=>{
  reelSoundUnlocked = true;

  const unlock = document.getElementById('reelSoundUnlock');
  unlock?.classList.add('hidden');

  const cards = [...document.querySelectorAll('.reel-full')];

  const visible = cards.find(card=>{
    const r = card.getBoundingClientRect();
    return r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.5;
  }) || cards[0];

  if(!visible) return;

  const url = visible.dataset.audio;
  const btn = visible.querySelector('.reel-music-btn');

  if(url && btn){
    const ok = await startReelAudio(btn, url);
    if(!ok) unlock?.classList.remove('hidden');
  }
};

function setupReelAutoplay(){
  if(reelObserver){
    try{ reelObserver.disconnect(); }catch{}
  }

  let unlock = document.getElementById('reelSoundUnlock');

  if(!unlock){
    unlock = document.createElement('button');
    unlock.id = 'reelSoundUnlock';
    unlock.className = 'reel-sound-unlock';
    unlock.innerHTML = '🔊 Toque para ativar o som';
    unlock.onclick = window.unlockReelSound;
    document.body.appendChild(unlock);
  }

  const cards = document.querySelectorAll('.reel-full');

  reelObserver = new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting || entry.intersectionRatio < 0.72) continue;

      const card = entry.target;
      const url = card.dataset.audio;
      const btn = card.querySelector('.reel-music-btn');

      if(!url || !btn) continue;

      if(!reelSoundUnlocked){
        unlock.classList.remove('hidden');
        continue;
      }

      if(reelAudioButton !== btn){
        startReelAudio(btn, url).then(ok=>{
          if(!ok) unlock.classList.remove('hidden');
        });
      }
    }
  }, {threshold:[0.72]});

  cards.forEach(card=>reelObserver.observe(card));
}


let storyRows=[];
let storyIndex=0;
let storyTimer=null;
let storyAudio=null;
let storyPreviewAudio=null;

window.toggleStoryCreator=()=>{
  const el=$('storyCreator');
  if(!el)return;
  el.classList.toggle('hidden');
};

window.openStorySoundPicker=async()=>{
  $('storySoundPicker').classList.remove('hidden');
  const box=$('storySoundList');
  box.innerHTML='<div class="empty">Carregando sons...</div>';

  const {data,error}=await sb
    .from('reel_sounds')
    .select('id,title,artist,duration_seconds,audio_url,active')
    .eq('active',true)
    .order('id');

  if(error){
    box.innerHTML=`<div class="empty">${esc(error.message)}</div>`;
    return;
  }

  box.innerHTML=(data||[]).map(s=>`
    <div class="story-sound-row">
      <button onclick="previewStorySound(event,'${esc(s.audio_url)}')">▶</button>
      <div>
        <strong>${esc(s.title)}</strong>
        <small>${esc(s.artist||'Sons Vem+')} • ${s.duration_seconds||30}s</small>
      </div>
      <button onclick="selectStorySound('${esc(s.audio_url)}','${esc(s.title)}')">Usar</button>
    </div>
  `).join('') || '<div class="empty">Nenhum som disponível.</div>';
};

window.closeStorySoundPicker=()=>{
  $('storySoundPicker').classList.add('hidden');
  if(storyPreviewAudio){
    try{storyPreviewAudio.pause()}catch{}
    storyPreviewAudio=null;
  }
};

window.previewStorySound=(event,url)=>{
  event.stopPropagation();

  if(storyPreviewAudio){
    try{storyPreviewAudio.pause()}catch{}
    storyPreviewAudio=null;
  }

  const a=new Audio(url);
  storyPreviewAudio=a;
  a.play().catch(()=>{});
  setTimeout(()=>{
    if(storyPreviewAudio===a){
      try{a.pause()}catch{}
      storyPreviewAudio=null;
    }
  },10000);
};

window.selectStorySound=(url,title)=>{
  $('storySoundUrl').value=url;
  $('storySoundTitle').value=title;
  $('storySoundLabel').textContent='♫ '+title;
  closeStorySoundPicker();
};

window.createStory=async()=>{
  const image=$('storyImage').files[0];
  const caption=$('storyCaption').value.trim();
  const audio_url=$('storySoundUrl').value||null;

  if(!image){
    $('storyMsg').textContent='Adicione uma foto para publicar o Story.';
    return;
  }

  try{
    $('storyMsg').textContent='Publicando Story...';

    const image_url=await upload('stories-images',image);

    const {error}=await sb.from('stories').insert({
      user_id:me.id,
      image_url,
      caption,
      audio_url
    });

    if(error)throw error;

    $('storyImage').value='';
    $('storyCaption').value='';
    $('storySoundUrl').value='';
    $('storySoundTitle').value='';
    $('storySoundLabel').textContent='Adicionar música';
    $('storyMsg').textContent='Story publicado!';
    $('storyCreator').classList.add('hidden');

    await loadStories();
  }catch(e){
    $('storyMsg').textContent=e.message;
  }
};

async function loadStories(){
  if(!me)return;
  const listEl=$('storiesList');
  if(!listEl)return;

  const myAvatar=$('myStoryAvatar');
  if(myProfile?.avatar_url && myAvatar){
    myAvatar.src=myProfile.avatar_url;
  }

  const since=new Date(Date.now()-24*60*60*1000).toISOString();

  const {data,error}=await sb
    .from('stories')
    .select('id,user_id,image_url,caption,audio_url,created_at,profiles!stories_user_id_fkey(display_name,avatar_url)')
    .gte('created_at',since)
    .order('created_at',{ascending:true});

  if(error){
    if(listEl)listEl.innerHTML='';
    return;
  }

  storyRows=data||[];

  // One bubble per user, using latest story index for that person.
  const latestByUser=new Map();
  storyRows.forEach((s,i)=>latestByUser.set(s.user_id,{story:s,index:i}));

  listEl.innerHTML=[...latestByUser.values()].map(({story,index})=>`
    <button class="story-item" onclick="openStoryViewer(${index})">
      <span class="story-avatar-wrap">
        <img src="${esc(story.profiles?.avatar_url||'./icon-192.png')}" alt="">
      </span>
      <small>${esc(story.profiles?.display_name||'Membro')}</small>
    </button>
  `).join('');
}

function storyTimeAgo(v){
  const min=Math.max(0,Math.floor((Date.now()-new Date(v).getTime())/60000));
  if(min<1)return 'agora';
  if(min<60)return `${min} min`;
  const h=Math.floor(min/60);
  return `${h} h`;
}

function stopStoryAudio(){
  if(storyAudio){
    try{storyAudio.pause()}catch{}
  }
  storyAudio=null;
  $('storySoundBtn')?.classList.remove('playing');
}

function renderStoryViewer(){
  const s=storyRows[storyIndex];
  if(!s)return closeStoryViewer();

  stopStoryAudio();

  $('storyViewerImage').src=s.image_url;
  $('storyViewerAvatar').src=s.profiles?.avatar_url||'./icon-192.png';
  $('storyViewerName').textContent=s.profiles?.display_name||'Membro';
  $('storyViewerTime').textContent=storyTimeAgo(s.created_at);
  $('storyViewerCaption').textContent=s.caption||'';

  const soundBtn=$('storySoundBtn');
  soundBtn.classList.toggle('hidden',!s.audio_url);
  soundBtn.classList.remove('playing');

  const progress=$('storyProgress');
  progress.innerHTML=storyRows.map((_x,i)=>`
    <span class="${i<storyIndex?'done':i===storyIndex?'active':''}"><b></b></span>
  `).join('');

  clearTimeout(storyTimer);
  storyTimer=setTimeout(()=>nextStory(),8000);
}

window.openStoryViewer=(index)=>{
  if(!storyRows.length)return;
  const viewer=$('storyViewer');
  if(!viewer)return;
  storyIndex=Math.max(0,Math.min(index,storyRows.length-1));
  viewer.classList.remove('hidden');
  renderStoryViewer();
};

window.closeStoryViewer=()=>{
  clearTimeout(storyTimer);
  stopStoryAudio();
  $('storyViewer')?.classList.add('hidden');
};

window.nextStory=()=>{
  if(storyIndex<storyRows.length-1){
    storyIndex++;
    renderStoryViewer();
  }else{
    closeStoryViewer();
  }
};

window.prevStory=()=>{
  if(storyIndex>0){
    storyIndex--;
    renderStoryViewer();
  }
};

window.toggleStoryViewerSound=async()=>{
  const s=storyRows[storyIndex];
  if(!s?.audio_url)return;

  const btn=$('storySoundBtn');

  if(storyAudio){
    if(storyAudio.paused){
      try{
        await storyAudio.play();
        btn.classList.add('playing');
      }catch{}
    }else{
      storyAudio.pause();
      btn.classList.remove('playing');
    }
    return;
  }

  const a=new Audio(s.audio_url);
  a.loop=true;
  storyAudio=a;

  try{
    await a.play();
    btn.classList.add('playing');
  }catch{
    btn.classList.remove('playing');
  }
};

if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});const {data:{session}}=await sb.auth.getSession();await start(session);sb.auth.onAuthStateChange((_e,s)=>setTimeout(()=>start(s),0));

function bindPrettyFileInput(inputId,labelId,emptyText){
  const input=document.getElementById(inputId);
  const label=document.getElementById(labelId);
  if(!input||!label)return;
  input.addEventListener('change',()=>{
    const file=input.files?.[0];
    label.textContent=file ? file.name : emptyText;
  });
}

bindPrettyFileInput('postImage','postImageLabel','Foto');
bindPrettyFileInput('testimonyImage','testimonyImageLabel','Adicionar foto');
bindPrettyFileInput('podFile','podFileLabel','Adicionar áudio MP3');
bindPrettyFileInput('songFile','songFileLabel','Adicionar louvor MP3');
bindPrettyFileInput('pAvatarFile','pAvatarFileLabel','Escolher foto do perfil');
