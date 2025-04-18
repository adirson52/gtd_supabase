/* ========= UTIL ========= */
let avisoTimer = null;
const showMsg = m => {
  const el = document.getElementById('aviso');
  el.textContent = m; el.style.display = 'block';
  clearTimeout(avisoTimer); avisoTimer = setTimeout(()=>el.style.display='none',6000);
};
const mmss2sql = v => v && /^\d{1,2}:\d{2}$/.test(v) ? `00:${v.padStart(5,'0')}` : null;
const sql2mmss = v => v ? v.slice(3) : '';

/* ========= RENDER ========= */
async function carregar() {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('status',{ascending:true})
    .order('ordem',{ascending:true});
  if (error) return console.error(error);

  const labels = {
    urgente:'Urgente', nao_iniciado:'Não Iniciado',
    em_andamento:'Em Andamento', com_data:'Com Data', concluido:'Concluído'
  };
  const kanban = document.getElementById('kanban'); kanban.innerHTML='';
  Object.entries(labels).forEach(([k,l])=>{
    kanban.insertAdjacentHTML('beforeend',`<div class="column" data-col="${k}"><h2>${l}</h2></div>`);
  });

  data.forEach(t=>{
    const col=document.querySelector(`.column[data-col="${t.status}"]`); if(!col) return;
    const card=document.createElement('div'); card.className='card'; card.dataset.id=t.id;
    card.innerHTML=`
      <div class="title">${t.task}</div>
      ${t.descricao?`<div class="desc">${t.descricao}</div>`:''}
      ${t.prioridade?`<div class="date">Prioridade: ${t.prioridade}</div>`:''}
      ${t.contexto?`<div class="date">Contexto: ${t.contexto}</div>`:''}
      ${t.tempo_estimado?`<div class="date">Tempo: ${sql2mmss(t.tempo_estimado)}</div>`:''}
      ${t.responsavel?`<div class="date">Resp: ${t.responsavel}</div>`:''}
      <button class="edit-btn">Editar</button>
    `;
    card.onclick=e=>{if(e.target.className!=='edit-btn') abrirLeitura(t);};
    card.querySelector('.edit-btn').onclick=e=>{e.stopPropagation(); abrirEdicao(t);};
    col.appendChild(card);
  });

  /* drag & drop */
  document.querySelectorAll('.column').forEach(col=>{
    Sortable.create(col,{
      group:'kanban', animation:150, filter:'h2',
      onEnd: async evt=>{
        const id = evt.item.dataset.id;
        const destino = evt.to.dataset.col;
        const siblings=[...evt.to.querySelectorAll('.card')];
        /* atualiza ordem + status + moved_at */
        for (let i=0;i<siblings.length;i++){
          await supabase.from('todos')
            .update({ ordem:i, status:destino, moved_at:new Date().toISOString() })
            .eq('id', siblings[i].dataset.id);
        }
        showMsg('Tarefa movida!');
      }
    });
  });
}

/* ========= NOVA ========= */
document.getElementById('form').addEventListener('submit', async e=>{
  e.preventDefault(); const f=e.target;
  const { data:max } = await supabase
    .from('todos').select('ordem')
    .eq('status',f.status.value).order('ordem',{ascending:false})
    .limit(1).single();

  const nova={
    task:f.titulo.value, descricao:f.descricao.value||null,
    status:f.status.value, tempo_estimado:mmss2sql(f.tempo_estimado.value),
    prioridade:f.prioridade.value, contexto:f.contexto.value,
    responsavel:f.responsavel.value, ordem:(max?.ordem||0)+1,
    user_id:'00000000-0000-0000-0000-000000000000'
  };
  const { error } = await supabase.from('todos').insert([nova]);
  if(error){alert('Erro');console.error(error);return;}
  f.reset(); showMsg('Tarefa salva!'); carregar();
});

/* ========= MODAL LEITURA ========= */
function abrirLeitura(t){
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
function abrirEdicao(t){
  const f=editForm;
  f.id.value=t.id; f.titulo.value=t.task;
  f.descricao.value=t.descricao||''; f.status.value=t.status;
  f.tempo_estimado.value=sql2mmss(t.tempo_estimado);
  f.prioridade.value=t.prioridade||'normal';
  f.contexto.value=t.contexto||'Faculdade';
  f.responsavel.value=t.responsavel||'';
  overlay.style.display=editModal.style.display='block';
}
const fecharEd=()=>{overlay.style.display=editModal.style.display='none';};
cancelEdit.onclick=fecharEd;
editForm.addEventListener('submit', async e=>{
  e.preventDefault(); const f=e.target;
  const upd={
    task:f.titulo.value, descricao:f.descricao.value||null,
    status:f.status.value, tempo_estimado:mmss2sql(f.tempo_estimado.value),
    prioridade:f.prioridade.value, contexto:f.contexto.value,
    responsavel:f.responsavel.value
  };
  const { error } = await supabase.from('todos').update(upd).eq('id',f.id.value);
  if(error){alert('Erro');console.error(error);return;}
  fecharEd(); showMsg('Tarefa atualizada!'); carregar();
});
/* ========= RENDER ========= */
async function carregar() {
  /* mesma query … */

  data.forEach(t=>{
    const col = document.querySelector(`.column[data-col="${t.status}"]`);
    if (!col) return;

    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = t.id;
    card.innerHTML = `
      <span class="drag-handle">⋮⋮</span>          <!-- NOVO handle -->
      <div class="title">${t.task}</div>
      ${t.descricao ? `<div class="desc">${t.descricao}</div>` : ''}
      ${t.prioridade ? `<div class="date">Prioridade: ${t.prioridade}</div>` : ''}
      ${t.contexto ? `<div class="date">Contexto: ${t.contexto}</div>` : ''}
      ${t.tempo_estimado ? `<div class="date">Tempo: ${sql2mmss(t.tempo_estimado)}</div>` : ''}
      ${t.responsavel ? `<div class="date">Resp: ${t.responsavel}</div>` : ''}
      <button class="edit-btn">Editar</button>
    `;
    /* click handlers iguais … */
    col.appendChild(card);
  });

  /* drag & drop com delay e handle */
  document.querySelectorAll('.column').forEach(col=>{
    Sortable.create(col,{
      group:'kanban',
      animation:150,
      handle:'.drag-handle',          // ← só move pelo ícone
      delayOnTouchOnly:true,          // delay só em touch
      delay:200,                      // 200 ms p/ evitar toques rápidos
      filter:'h2',
      onEnd: async evt=>{
        /* mesma lógica de update status + ordem + moved_at … */
      }
    });
  });
}
/* ========= START ========= */
carregar();
