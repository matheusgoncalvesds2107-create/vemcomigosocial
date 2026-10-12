import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const cfg=window.VCS_CONFIG; const sb=createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
let me=null,myProfile=null,channel=null; const $=id=>document.getElementById(id); const esc=s=>(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); const dt=v=>new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});

window.go=async(id,btn)=>{document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));$(id).classList.add('active');document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active');if(id==='inicio')await loadFeed();if(id==='pessoas')await loadPeople();if(id==='oracoes')await loadPrayers();if(id==='reels')await loadReels();if(id==='testemunhos')await loadTestimonies();if(id==='palavra')await loadWords();if(id==='podcast')await loadPodcasts();if(id==='louvores')await loadSongs();if(id==='mensagens')await loadChatUsers();if(id==='notificacoes')await loadNotifications();if(id==='perfil')await loadProfile();scrollTo({top:0,behavior:'smooth'});};
window.signup=async()=>{const name=$('authName').value.trim(),email=$('authEmail').value.trim(),password=$('authPass').value;if(!name||!email||password.length<6){$('authMsg').textContent='Preencha nome, e-mail e senha com pelo menos 6 caracteres.';return}const {data,error}=await sb.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:location.origin}});$('authMsg').textContent=error?error.message:(data.session?'Conta criada e conectada!':'Conta criada. Confirme o e-mail e depois entre.');};
window.login=async()=>{const {error}=await sb.auth.signInWithPassword({email:$('authEmail').value.trim(),password:$('authPass').value});$('authMsg').textContent=error?error.message:'';}; window.logout=()=>sb.auth.signOut();
async function ensureProfile(){let {data}=await sb.from('profiles').select('*').eq('id',me.id).maybeSingle();if(!data){const name=me.user_metadata?.display_name||me.email.split('@')[0]||'Membro';const r=await sb.from('profiles').insert({id:me.id,display_name:name}).select().single();data=r.data}myProfile=data;}
async function upload(bucket,file){if(!file)return null;const ext=(file.name.split('.').pop()||'bin').toLowerCase();const path=`${me.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;const {error}=await sb.storage.from(bucket).upload(path,file,{upsert:false});if(error)throw error;return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;}
async function start(session){me=session?.user||null;if(!me){$('auth').classList.remove('hidden');$('app').classList.add('hidden');return}await ensureProfile();$('auth').classList.add('hidden');$('app').classList.remove('hidden');$('topAvatar').src=myProfile?.avatar_url||'./icon-192.png';await Promise.all([loadFeed(),loadNotifCount()]);if(channel)sb.removeChannel(channel);channel=sb.channel('vcp-live').on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`user_id=eq.${me.id}`},loadNotifCount).subscribe();}

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
      <article class="reel-card">
        <div class="reel-media">
          <img src="${esc(r.image_url)}" alt="Reels">
          <div class="reel-overlay">
            <div class="reel-user">${esc(r.profiles?.display_name||'Membro')}</div>
            <div class="reel-caption">${esc(r.caption||'')}</div>
            ${r.audio_url ? `<div class="reel-audio-title">🎵 Som Vem+</div><audio class="reel-audio" controls preload="none" src="${esc(r.audio_url)}"></audio>` : ''}
          </div>
        </div>

        <div class="reel-actions">
          <button class="${liked?'on':''}" onclick="toggleReelLike(${r.id},${liked})">❤️ ${rl.length}</button>
          <button onclick="$('rc-${r.id}').focus()">💬 ${rc.length}</button>
          <button onclick="shareReel(${r.id})">🔗 Compartilhar</button>
        </div>

        <div class="reel-comments">
          ${rc.map(c=>`<div class="comment"><b>${esc(c.profiles?.display_name||'Membro')}:</b> ${esc(c.content)}</div>`).join('')}
          <div class="row">
            <input id="rc-${r.id}" class="field grow" maxlength="500" placeholder="Comentar...">
            <button class="btn" onclick="addReelComment(${r.id})">Enviar</button>
          </div>
        </div>
      </article>
    `;
  }).join('') || '<div class="empty">Ainda não há Reels. Toque no + para criar o primeiro.</div>';
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

if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});const {data:{session}}=await sb.auth.getSession();await start(session);sb.auth.onAuthStateChange((_e,s)=>setTimeout(()=>start(s),0));