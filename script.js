/* ========= UTIL ========= */
let avisoTimer=null;
const showMsg=m=>{
  aviso.textContent=m;aviso.style.display='block';
  clearTimeout(avisoTimer);avisoTimer=setTimeout(()=>aviso.style.display='none',6000);
};
const mmss2sql=v=>v&&/^\d{1,2}:\d{2}$/.test(v)?`00:${v.padStart(5,'0')}`:null;
const sql2mmss=v=>v?v.slice(3):'';          // 00:mm:ss → mm:ss

/* ========= CARREGA ========= */
async function carregar(){
  const {data,error}=await supabase.from('todos')
    .select('*').order('status',{ascending:true}).order('ordem',{ascending:true});
  if(error){console.error(error);return;}

  const labels={urgente:'Urgente',nao_iniciado:'Não Iniciado',
    em_andamento:'Em Andamento',com_data:'Com Data',concluido:'Concluído'};
  kanban.innerHTML='';
  Object.entries(labels).forEach(([k,l])=>{
    kanban.insertAdjacentHTML('beforeend',`<div class="column" data-col="${k}"><h2>${l}</h2></div>`);
  });

  data.forEach(t=>{
    const col=document.querySelector(`.column[data-col="${t.status}"]`); if(!col) return;
    const c=document.createElement('div'); c.className='card'; c.dataset.id=t.id;
    c.innerHTML=`
      <div class="title">${t.task}</div>
      ${t.descricao?`<div class="desc">${t.descricao}</div>`:''}
      ${t.prioridade?`<div class="date">Prioridade: ${t.prioridade}</div>`:''}
      ${t.contexto?`<div class="date">Contexto: ${t.contexto}</div>`:''}
      ${t.tempo_estimado?`<div class="date">Tempo: ${sql2mmss(t.tempo_estimado)}</div>`:''}
      ${t.responsavel?`<div class="date">Resp: ${t.responsavel}</div>`:''}
      <button class="edit-btn">Editar</button>
    `;
    c.onclick=e=>{ if(e.target.className!=='edit-btn') abrirRead(t); };
    c.querySelector('.edit-btn').onclick=e=>{ e.stopPropagation(); abrirEdit(t); };
    col.appendChild(c);
  });

  /* drag & drop – só inicia após 1,5 s de press */
  let isDragging=false;
  document.querySelectorAll('.column').forEach(col=>{
    Sortable.create(col,{
      group:'kanban',
      animation:150,
      delay:1500,
      delayOnTouchOnly:false,     // aplica também a mouse
      filter:'h2',
      onStart:()=>{isDragging=true;},
      onEnd: async evt=>{
        const destino=evt.to.dataset.col;
        const cards=[...evt.to.querySelectorAll('.card')];
        for(let i=0;i<cards.length;i++){
          await supabase.from('todos')
            .update({ordem:i,status:destino,moved_at:new Date().toISOString()})
            .eq('id',cards[i].dataset.id);
        }
        isDragging=false;
        showMsg('Tarefa movida!');
      }
    });
  });

  /* impede click após drag */
  kanban.addEventListener('click',e=>{
    if(isDragging) e.stopPropagation();
  },true);
}

/* ========= NOVA ========= */
form.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target;
  const {data:max}=await supabase.from('todos').select('ordem')
        .eq('status',f.status.value).order('ordem',{ascending:false})
        .limit(1).single();
  const nova={
    task:f.titulo.value,descricao:f.descricao.value||null,
    status:f.status.value,tempo_estimado:mmss2sql(f.tempo_estimado.value),
    prioridade:f.prioridade.value,contexto:f.contexto.value,
    responsavel:f.responsavel.value,ordem:(max?.ordem||0)+1,
    user_id:'00000000-0000-0000-0000-000000000000'
  };
  const {error}=await supabase.from('todos').insert([nova]);
  if(error){alert('Erro');console.error(error);return;}
  f.reset();showMsg('Tarefa salva!');carregar();
});

/* ========= MODAL LEITURA ========= */
function abrirRead(t){
  readTitulo.textContent=t.task;
  readDescricao.textContent=t.descricao||'(sem descrição)';
  readTempo.textContent=t.tempo_estimado?'Tempo: '+sql2mmss(t.tempo_estimado):'';
  readPrioridade.textContent=t.prioridade?'Prioridade: '+t.prioridade:'';
  readContexto.textContent=t.contexto?'Contexto: '+t.contexto:'';
  readResp.textContent='Resp: '+(t.responsavel||'-');
  readOverlay.style.display=readModal.style.display='block';
}
fecharRead.onclick=readOverlay.onclick=()=>{readOverlay.style.display=readModal.style.display='none';};

/* ========= MODAL EDIÇÃO ========= */
function abrirEdit(t){
  const f=editForm;
  f.id.value=t.id;f.titulo.value=t.task;f.descricao.value=t.descricao||'';
  f.status.value=t.status;f.tempo_estimado.value=sql2mmss(t.tempo_estimado);
  f.prioridade.value=t.prioridade||'normal';
  f.contexto.value=t.contexto||'Faculdade';
  f.responsavel.value=t.responsavel||'';
  overlay.style.display=editModal.style.display='block';
}
cancelEdit.onclick=()=>{overlay.style.display=editModal.style.display='none';};
editForm.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target;
  const upd={
    task:f.titulo.value,descricao:f.descricao.value||null,
    status:f.status.value,tempo_estimado:mmss2sql(f.tempo_estimado.value),
    prioridade:f.prioridade.value,contexto:f.contexto.value,
    responsavel:f.responsavel.value
  };
  const {error}=await supabase.from('todos').update(upd).eq('id',f.id.value);
  if(error){alert('Erro');console.error(error);return;}
  overlay.style.display=editModal.style.display='none';
  showMsg('Tarefa atualizada!');carregar();
});

/* ========= START ========= */
carregar();
