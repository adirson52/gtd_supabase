/* ============= UTIL ============= */
const show = (id,on=true) => document.getElementById(id).style.display=on?'block':'none';
const toast = msg => {
  const el=document.getElementById('aviso');
  el.textContent=msg; show('aviso',true);
  setTimeout(()=>show('aviso',false),4000);
};
const mmss2sql = v=>v&&/^\d{1,2}:\d{2}$/.test(v)?'00:'+v.padStart(5,'0'):null;
const sql2mmss = v=>v?v.slice(3):'';
let tarefaParaExcluir=null;

/* ============= RENDER ============= */
async function render(){
  const {data:tarefas,error}=await supabase
    .from('todos').select('*')
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
  kanban.innerHTML=Object.entries(labels)
    .map(([k,l])=>`<div class="column" data-col="${k}"><h2>${l}</h2></div>`)
    .join('');

  const recentIds=tarefas
    .filter(t=>t.status==='concluido')
    .sort((a,b)=>new Date(b.moved_at)-new Date(a.moved_at))
    .slice(0,3).map(t=>t.id);

  tarefas.forEach(t=>{
    if(t.status==='concluido'&&!recentIds.includes(t.id))return;
    const col=kanban.querySelector(`.column[data-col="${t.status}"]`);
    if(!col)return;
    col.insertAdjacentHTML('beforeend',`
      <div class="card" data-id="${t.id}">
        <div class="title">${t.task}</div>
        ${t.descricao?`<div class="desc">${t.descricao}</div>`:''}
        ${t.prioridade?`<div class="date">Prioridade: ${t.prioridade}</div>`:''}
        ${t.contexto?`<div class="date">Contexto: ${t.contexto}</div>`:''}
        ${t.tempo_estimado?`<div class="date">Tempo: ${sql2mmss(t.tempo_estimado)}</div>`:''}
        ${t.responsavel?`<div class="date">Resp: ${t.responsavel}</div>`:''}
        <button class="move-btn">Move</button>
        <button class="edit-btn">Editar</button>
      </div>`);
  });

  document.querySelectorAll('.card').forEach(card=>{
    const id=card.dataset.id;
    const dados = tarefas.find(x=>x.id===id);
    card.querySelector('.edit-btn').onclick=e=>{
      e.stopPropagation(); openEdit(dados);
    };
    card.onclick=e=>{
      if(e.target.matches('.move-btn, .edit-btn'))return;
      openRead(dados);
    };
  });

  document.querySelectorAll('.column').forEach(col=>{
    Sortable.create(col,{
      group:'kanban',animation:150,
      handle:'.move-btn',filter:'h2',
      onEnd: async evt=>{
        const dest=evt.to.dataset.col;
        const cards=[...evt.to.querySelectorAll('.card')];
        for(let i=0;i<cards.length;i++){
          const id=cards[i].dataset.id;
          await supabase.from('todos')
            .update({status:dest,ordem:i,moved_at:new Date().toISOString()})
            .eq('id',id);
          if(dest==='concluido'){
            const t=tarefas.find(x=>x.id===id);
            await supabase.from('concluded').insert([{
              todo_id:id,task:t.task,contexto:t.contexto,responsavel:t.responsavel
            }]);
          }
        }
        toast('Tarefa movida!');
        render();
      }
    });
  });
}

/* ============= NOVA ============= */
document.getElementById('form').addEventListener('submit',async e=>{
  e.preventDefault();
  const f=e.target;
  const {data:max} = await supabase.from('todos')
    .select('ordem').eq('status',f.status.value)
    .order('ordem',{ascending:false}).limit(1).single();
  const nova={
    task:f.titulo.value,descricao:f.descricao.value||null,
    status:f.status.value,tempo_estimado:mmss2sql(f.tempo_estimado.value),
    prioridade:f.prioridade.value,contexto:f.contexto.value,
    responsavel:f.responsavel.value,ordem:(max?.ordem||0)+1,
    user_id:'00000000-0000-0000-0000-000000000000'
  };
  const {error}=await supabase.from('todos').insert([nova]);
  if(error){toast('Erro ao salvar');console.error(error);return;}
  f.reset(); toast('Tarefa salva!'); render();
});

/* ============= LEITURA ============= */
function openRead(t){
  readTitulo.textContent=t.task;
  readDescricao.textContent=t.descricao||'(sem descrição)';
  readTempo.textContent=t.tempo_estimado?'Tempo: '+sql2mmss(t.tempo_estimado):'';
  readPrioridade.textContent=t.prioridade?'Prioridade: '+t.prioridade:'';
  readContexto.textContent=t.contexto?'Contexto: '+t.contexto:'';
  readResp.textContent='Resp: '+(t.responsavel||'-');
  show('readOverlay'); show('readModal');
}
fecharRead.onclick=()=>{show('readOverlay',false);show('readModal',false);};

/* ============= EDIÇÃO ============= */
function openEdit(t){
  const f=editForm;
  f.id.value=t.id; f.titulo.value=t.task;
  f.descricao.value=t.descricao||'';
  f.status.value=t.status;
  f.tempo_estimado.value=sql2mmss(t.tempo_estimado);
  f.prioridade.value=t.prioridade||'normal';
  f.contexto.value=t.contexto||'Faculdade';
  f.responsavel.value=t.responsavel||'';
  show('overlay'); show('editModal');
}
cancelEdit.onclick=()=>{show('overlay',false);show('editModal',false);};
editForm.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target;
  const upd={
    task:f.titulo.value,descricao:f.descricao.value||null,
    status:f.status.value,tempo_estimado:mmss2sql(f.tempo_estimado.value),
    prioridade:f.prioridade.value,contexto:f.contexto.value,
    responsavel:f.responsavel.value
  };
  const {error}=await supabase.from('todos').update(upd).eq('id',f.id.value);
  if(error){toast('Erro ao atualizar');console.error(error);return;}
  show('overlay',false);show('editModal',false);
  toast('Tarefa atualizada!'); render();
});

/* ============= CONCLUÍDAS ============= */
document.getElementById('btn-concluidas').onclick=async()=>{
  const m=document.getElementById('modal-concluidas'),
        i=m.querySelector('.read-modal'),
        tb=document.querySelector('#table-concluidas tbody');
  m.style.display='block'; i.style.display='block';
  tb.innerHTML=`<tr><td colspan="4" style="text-align:center">Carregando…</td></tr>`;
  const lim=new Date();lim.setDate(lim.getDate()-7);
  const {data, error}=await supabase.from('concluded')
    .select('*').gte('concluded_at',lim.toISOString())
    .order('concluded_at',{ascending:false});
  if(error){tb.innerHTML=`<tr><td colspan="4" style="color:red">${error.message}</td></tr>`;return;}
  if(!data.length){tb.innerHTML=`<tr><td colspan="4">Nenhuma tarefa na semana.</td></tr>`;return;}
  tb.innerHTML=data.map(r=>{
    const dt=new Date(r.concluded_at).toLocaleString();
    return`<tr><td>${r.task}</td><td>${r.contexto||''}</td><td>${r.responsavel||''}</td><td>${dt}</td></tr>`;
  }).join('');
};

/* ========= START ============= */
document.addEventListener('DOMContentLoaded',render);
