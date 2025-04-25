/* ---------- UTIL ---------- */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const show = (sel,on=true)=>($(sel).style.display=on?'block':'none');
const toast=msg=>{$('#aviso').textContent=msg;show('#aviso');setTimeout(()=>show('#aviso',false),3500);};

const mmss2sql = v=>v&&/^\d{1,2}:\d{2}$/.test(v)?'00:'+v.padStart(5,'0'):null;
const sql2mmss = v=>v?v.slice(3):'';

const CONTEXTOS_VALIDOS = ['Estágio','Pecege','Monitoria','Pesquisa/IC','CWS','Outros'];
const normalizaContexto = c => CONTEXTOS_VALIDOS.includes(c)?c:'Outros';

/* ---------- MARKDOWN MINIMAL ---------- */
function escapeHtml(x){return x.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function md(str=''){
  str=escapeHtml(str);
  str=str.replace(/~~(.*?)~~/g,'<s>$1</s>');
  const lines=str.split(/\r?\n/);let html='',inList=false;
  for(const l of lines){
    const m=l.match(/^\s*[-*]\s+(.*)/);
    if(m){if(!inList){html+='<ul>';inList=true;}html+=`<li>${m[1]}</li>`;}
    else{if(inList){html+='</ul>';inList=false;}if(l.trim())html+=`<p>${l}</p>`;}
  }
  if(inList)html+='</ul>';return html;
}

/* ---------- THEME ---------- */
function initTheme(){
  const btn=$('#theme-toggle');
  const stored=localStorage.getItem('theme');
  const systemDark=matchMedia('(prefers-color-scheme:dark)').matches;
  let theme=stored||(systemDark?'dark':'light');
  document.documentElement.dataset.theme=theme;
  btn.textContent=theme==='dark'?'☀️':'🌙';
  btn.onclick=()=>{theme=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;localStorage.setItem('theme',theme);btn.textContent=theme==='dark'?'☀️':'🌙';};
}

/* ---------- RENDER ---------- */
let tarefas=[];
async function render(){
  const {data,error}=await supabase.from('todos').select('*').order('status').order('ordem');
  if(error){console.error(error);return;}
  tarefas=data;

  const labels={nao_iniciado:'Não Iniciado',em_andamento:'Em Andamento',com_data:'Com Data',concluido:'Concluído'};
  $('#kanban').innerHTML=Object.entries(labels).map(([k,v])=>`<div class="column" data-col="${k}"><h2>${v}</h2></div>`).join('');

  const recents=tarefas.filter(t=>t.status==='concluido').sort((a,b)=>new Date(b.moved_at)-new Date(a.moved_at)).slice(0,3).map(t=>t.id);

  tarefas.forEach(t=>{
    if(t.status==='concluido'&&!recents.includes(t.id))return;
    const col=$(`.column[data-col="${t.status}"]`);if(!col)return;
    col.insertAdjacentHTML('beforeend',`
      <div class="card" data-id="${t.id}">
        <div class="title">${t.task}</div>
        ${t.prioridade?`<div class="date">Prioridade: ${t.prioridade}</div>`:''}
        <button class="move-btn">Move</button>
        <button class="edit-btn">Editar</button>
      </div>
    `);
  });

  $$('.card').forEach(c=>{
    const d=tarefas.find(t=>t.id===c.dataset.id);
    c.onclick=e=>{if(e.target.closest('button'))return;openRead(d);};
    c.querySelector('.edit-btn').onclick=e=>{e.stopPropagation();openEdit(d);};
  });

  $$('.column').forEach(col=>{
    Sortable.create(col,{
      group:'kanban',
      handle:'.move-btn',
      animation:150,
      filter:'h2',
      onEnd:async evt=>{
        const dest=evt.to.dataset.col;
        const cards=[...evt.to.querySelectorAll('.card')];
        for(let i=0;i<cards.length;i++){
          const id=cards[i].dataset.id;
          await supabase.from('todos').update({status:dest,ordem:i,moved_at:new Date().toISOString()}).eq('id',id);
          if(dest==='concluido'){
            const t=tarefas.find(x=>x.id===id);
            await supabase.from('concluded').insert([{todo_id:id,task:t.task,contexto:t.contexto,responsavel:t.responsavel}]);
          }
        }
        toast('Tarefa movida!');render();
      }
    });
  });
}

/* ---------- ADD ---------- */
$('#form').onsubmit=async e=>{
  e.preventDefault();const f=e.target;
  const {data:max}=await supabase.from('todos').select('ordem').eq('status',f.status.value).order('ordem',{ascending:false}).limit(1).single();
  const nova={
    task:f.titulo.value,
    descricao:f.descricao.value||null,
    status:f.status.value,
    tempo_estimado:mmss2sql(f.tempo_estimado.value),
    prioridade:f.prioridade.value,
    contexto:normalizaContexto(f.contexto.value),
    responsavel:f.responsavel.value,
    ordem:(max?.ordem||0)+1,
    user_id:'00000000-0000-0000-0000-000000000000'
  };
  const {error}=await supabase.from('todos').insert([nova]);
  if(error){toast('Erro ao salvar');console.error(error);return;}
  f.reset();toast('Tarefa adicionada!');render();
};

/* ---------- READ MODAL ---------- */
function openRead(t){
  $('#readTitulo').textContent=t.task;
  $('#readDescricao').innerHTML=md(t.descricao||'(sem descrição)');
  $('#readTempo').textContent   =t.tempo_estimado?'Tempo: '+sql2mmss(t.tempo_estimado):'';
  $('#readPrioridade').textContent=t.prioridade?'Prioridade: '+t.prioridade:'';
  $('#readContexto').textContent ='Contexto: '+normalizaContexto(t.contexto);
  $('#readResp').textContent     ='Resp: '+(t.responsavel||'-');
  show('#readOverlay');show('#readModal');
}
$('#fecharRead').onclick=()=>{show('#readOverlay',false);show('#readModal',false);};

/* ---------- EDIT MODAL ---------- */
let tarefaParaExcluir=null;
function openEdit(t){
  const f=$('#editForm');
  f.id.value=t.id;f.titulo.value=t.task;f.descricao.value=t.descricao||'';
  f.status.value=t.status;f.tempo_estimado.value=sql2mmss(t.tempo_estimado);
  f.prioridade.value=t.prioridade||'normal';
  f.contexto.value=normalizaContexto(t.contexto);
  f.responsavel.value=t.responsavel||'';
  show('#overlay');show('#editModal');
  $('#btn-excluir-modal').onclick=()=>{tarefaParaExcluir=t;show('#modalExcluir');};
}
$('#cancelEdit').onclick=()=>{show('#overlay',false);show('#editModal',false);};
$('#editForm').onsubmit=async e=>{
  e.preventDefault();const f=e.target;
  const upd={
    task:f.titulo.value,descricao:f.descricao.value||null,status:f.status.value,
    tempo_estimado:mmss2sql(f.tempo_estimado.value),prioridade:f.prioridade.value,
    contexto:normalizaContexto(f.contexto.value),responsavel:f.responsavel.value
  };
  const {error}=await supabase.from('todos').update(upd).eq('id',f.id.value);
  if(error){toast('Erro ao atualizar');console.error(error);return;}
  show('#overlay',false);show('#editModal',false);toast('Tarefa atualizada!');render();
};

/* ---------- CONCLUÍDAS ---------- */
$('#btn-concluidas').onclick=async()=>{
  show('#modal-concluidas');
  $('#table-concluidas tbody').innerHTML='<tr><td colspan="4">Carregando…</td></tr>';
  const since=new Date(Date.now()-7*864e5).toISOString();
  const{data,error}=await supabase.from('concluded').select('*').gte('concluded_at',since).order('concluded_at',{ascending:false});
  if(error){$('#table-concluidas tbody').innerHTML=`<tr><td colspan="4" style="color:red">${error.message}</td></tr>`;return;}
  if(!data.length){$('#table-concluidas tbody').innerHTML='<tr><td colspan="4">Nenhuma tarefa concluída na última semana.</td></tr>';return;}
  $('#table-concluidas tbody').innerHTML=data.map(r=>`
    <tr><td>${r.task}</td><td>${normalizaContexto(r.contexto)}</td><td>${r.responsavel||''}</td><td>${new Date(r.concluded_at).toLocaleString()}</td></tr>
  `).join('');
};
function closeConcluidas(){show('#modal-concluidas',false);}

/* ---------- DELETE ---------- */
$('#btnCancelarExcluir').onclick=()=>show('#modalExcluir',false);
$('#btnConfirmarExcluir').onclick=async()=>{
  if(!tarefaParaExcluir)return;
  await supabase.from('excluidos').insert([{todo_id:tarefaParaExcluir.id,task:tarefaParaExcluir.task,
    contexto:normalizaContexto(tarefaParaExcluir.contexto),responsavel:tarefaParaExcluir.responsavel}]);
  await supabase.from('todos').delete().eq('id',tarefaParaExcluir.id);
  show('#modalExcluir',false);tarefaParaExcluir=null;toast('Tarefa excluída!');render();
};

/* ---------- START ---------- */
document.addEventListener('DOMContentLoaded',()=>{initTheme();render();});
