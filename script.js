/* ========= UTIL ========= */
let avisoTimer=null;
const showMsg=m=>{
  const el=document.getElementById('aviso');
  el.textContent=m; el.style.display='block';
  clearTimeout(avisoTimer);
  avisoTimer=setTimeout(()=>el.style.display='none',6000);
};
const mmss2sql=v=>v&&/^\d{1,2}:\d{2}$/.test(v)?`00:${v.padStart(5,'0')}`:null;
const sql2mmss=v=>v?v.slice(3):''; // 00:mm:ss → mm:ss

/* ========= CARREGA & RENDERIZA ========= */
async function carregar(){
  const {data,error}=await supabase
    .from('todos')
    .select('*')
    .order('status',{ascending:true})
    .order('ordem',{ascending:true});
  if(error){console.error(error);return;}

  const labels={
    urgente:'Urgente',
    nao_iniciado:'Não Iniciado',
    em_andamento:'Em Andamento',
    com_data:'Com Data',
    concluido:'Concluído'
  };
  const kanban=document.getElementById('kanban');
  kanban.innerHTML='';
  Object.entries(labels).forEach(([key,label])=>{
    kanban.insertAdjacentHTML('beforeend',
      `<div class="column" data-col="${key}"><h2>${label}</h2></div>`);
  });

  // renderiza tudo, mas na coluna “concluido” só pega top3 por moved_at desc
  const concluidas = data
    .filter(t=>t.status==='concluido')
    .sort((a,b)=> new Date(b.moved_at) - new Date(a.moved_at))
    .slice(0,3)
    .map(t=>t.id);

  data.forEach(t=>{
    if(t.status==='concluido' && !concluidas.includes(t.id)) return;
    const col=document.querySelector(`.column[data-col="${t.status}"]`);
    if(!col) return;
    const card=document.createElement('div');
    card.className='card'; card.dataset.id=t.id;
    card.innerHTML=`
      <div class="title">${t.task}</div>
      ${t.descricao?`<div class="desc">${t.descricao}</div>`:''}
      ${t.prioridade?`<div class="date">Prioridade: ${t.prioridade}</div>`:''}
      ${t.contexto?`<div class="date">Contexto: ${t.contexto}</div>`:''}
      ${t.tempo_estimado?`<div class="date">Tempo: ${sql2mmss(t.tempo_estimado)}</div>`:''}
      ${t.responsavel?`<div class="date">Resp: ${t.responsavel}</div>`:''}
      <button class="move-btn">Move</button>
      <button class="edit-btn">Editar</button>
    `;
    card.addEventListener('click',e=>{
      if(e.target.className==='move-btn'||e.target.className==='edit-btn') return;
      abrirLeitura(t);
    });
    card.querySelector('.edit-btn').onclick=e=>{
      e.stopPropagation(); abrirEdicao(t);
    };
    col.appendChild(card);
  });

  // drag&p
  let isDragging=false;
  document.querySelectorAll('.column').forEach(col=>{
    Sortable.create(col,{
      group:'kanban',
      animation:150,
      handle:'.move-btn',
      filter:'h2',
      onStart:()=>isDragging=true,
      onEnd:async evt=>{
        const dest=evt.to.dataset.col;
        const cards=[...evt.to.querySelectorAll('.card')];
        for(let i=0;i<cards.length;i++){
          const id=cards[i].dataset.id;
          // atualiza tarefas
          await supabase.from('todos')
            .update({status:dest,ordem:i,moved_at:new Date().toISOString()})
            .eq('id',id);
          // se passou pra concluido, insere no log
          if(dest==='concluido' && !/** já gravada? **/[i]){
            const t = data.find(x=>x.id===id);
            await supabase.from('concluded').insert([{
              todo_id:     id,
              task:        t.task,
              contexto:    t.contexto,
              responsavel: t.responsavel,
              concluded_at:new Date().toISOString()
            }]);
          }
        }
        isDragging=false;
        showMsg('Tarefa movida!');
        carregar();
      }
    });
  });
  kanban.addEventListener('click',e=>{
    if(isDragging) e.stopPropagation();
  },true);
}

/* ========= NOVA TAREFA ========= */
document.getElementById('form').addEventListener('submit',async e=>{
  e.preventDefault(); const f=e.target;
  const {data:max}=await supabase.from('todos')
    .select('ordem')
    .eq('status',f.status.value)
    .order('ordem',{ascending:false})
    .limit(1).single();
  const nova={
    task:f.titulo.value,
    descricao:f.descricao.value||null,
    status:f.status.value,
    tempo_estimado:mmss2sql(f.tempo_estimado.value),
    prioridade:f.prioridade.value,
    contexto:f.contexto.value,
    responsavel:f.responsavel.value,
    ordem:(max?.ordem||0)+1,
    user_id:'00000000-0000-0000-0000-000000000000'
  };
  const {error}=await supabase.from('todos').insert([nova]);
  if(error){alert('Erro');console.error(error);return;}
  f.reset(); showMsg('Tarefa salva!'); carregar();
});

/* ========= MODAL LEITURA ========= */
function abrirLeitura(t){
  readTitulo.textContent     = t.task;
  readDescricao.textContent = t.descricao||'(sem descrição)';
  readTempo.textContent     = t.tempo_estimado?'Tempo: '+sql2mmss(t.tempo_estimado):'';
  readPrioridade.textContent= t.prioridade?'Prioridade: '+t.prioridade:'';
  readContexto.textContent  = t.contexto?'Contexto: '+t.contexto:'';
  readResp.textContent      = 'Resp: '+(t.responsavel||'-');
  readOverlay.style.display=readModal.style.display='block';
}
fecharRead.onclick=readOverlay.onclick=()=>{
  readOverlay.style.display=readModal.style.display='none';
};

/* ========= MODAL EDIÇÃO ========= */
function abrirEdicao(t){
  const f=editForm;
  f.id.value=t.id;
  f.titulo.value=t.task;
  f.descricao.value=t.descricao||'';
  f.status.value=t.status;
  f.tempo_estimado.value=sql2mmss(t.tempo_estimado);
  f.prioridade.value=t.prioridade||'normal';
  f.contexto.value=t.contexto||'Faculdade';
  f.responsavel.value=t.responsavel||'';
  overlay.style.display=editModal.style.display='block';
}
cancelEdit.onclick=()=>{
  overlay.style.display=editModal.style.display='none';
};
editForm.addEventListener('submit',async e=>{
  e.preventDefault(); const f=e.target;
  const upd={
    task:f.titulo.value,
    descricao:f.descricao.value||null,
    status:f.status.value,
    tempo_estimado:mmss2sql(f.tempo_estimado.value),
    prioridade:f.prioridade.value,
    contexto:f.contexto.value,
    responsavel:f.responsavel.value
  };
  const {error}=await supabase.from('todos').update(upd).eq('id',f.id.value);
  if(error){alert('Erro');console.error(error);return;}
  overlay.style.display=editModal.style.display='none';
  showMsg('Tarefa atualizada!'); carregar();
});

/* ========= VER CONCLUÍDAS ── */
document.getElementById('btn-concluidas').onclick=async()=>{
  const modal=document.getElementById('modal-concluidas');
  const lista=document.getElementById('lista-concluidas');
  modal.style.display='block';
  lista.innerHTML='<p>Carregando…</p>';
  const {data,error}=await supabase.from('concluded')
    .select('*')
    .order('concluded_at',{ascending:false});
  if(error){lista.innerHTML='<p>Erro ao carregar.</p>';return;}
  if(!data.length){lista.innerHTML='<p>Nenhuma conclusão ainda.</p>';return;}
  lista.innerHTML='';
  data.forEach(r=>{
    const d=new Date(r.concluded_at).toLocaleString();
    lista.insertAdjacentHTML('beforeend',`
      <div class="card">
        <div class="title">${r.task}</div>
        <div class="date">Contexto: ${r.contexto}</div>
        <div class="date">Resp: ${r.responsavel}</div>
        <div class="date">Em: ${d}</div>
      </div>
    `);
  });
};

/* ========= START ========= */
carregar();
