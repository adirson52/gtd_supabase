/* ---------- UTIL ---------- */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const show  = (sel,on=true)=>($(sel).style.display = on ? 'block' : 'none');
const toast = msg => { $('#aviso').textContent = msg; show('#aviso'); setTimeout(()=>show('#aviso',false),3500); };

const mmss2sql = v => v && /^\d{1,2}:\d{2}$/.test(v) ? '00:'+v.padStart(5,'0') : null;
const sql2mmss = v => v ? v.slice(3) : '';

/* ---------- listas válidas ---------- */
const STATUS   = ['nao_iniciado','em_andamento','com_data','concluido'];
const CONTEXTO = ['Estágio','Pecege','Monitoria','Pesquisa/IC','CWS','Outros'];

const normStatus  = s => STATUS.includes(s)   ? s : 'nao_iniciado';
const normContext = c => CONTEXTO.includes(c) ? c : 'Outros';

/* ---------- Markdown simplificado ---------- */
const escapeHtml = x => x.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function md(src=''){
  src = escapeHtml(src).replace(/~~(.*?)~~/g,'<s>$1</s>');
  return src.split(/\r?\n/).reduce((h,l)=>{
    const m = l.match(/^\s*[-*]\s+(.*)/);
    if(m){
      if(!h.endsWith('</li>')) h += '<ul>';
      return h + `<li>${m[1]}</li>`;
    }
    if(h.endsWith('</li>')) h += '</ul>';
    return h + (l.trim()? `<p>${l}</p>` : '');
  },'').replace(/<ul>(?=[^]*$)/,'<ul>');
}

/* ---------- tema ---------- */
function setTheme(t){
  document.documentElement.dataset.theme = t;
  localStorage.setItem('theme',t);
  $('#theme-toggle').textContent = t==='dark' ? '☀️' : '🌙';
}
function initTheme(){
  const stored = localStorage.getItem('theme');
  const sys    = matchMedia('(prefers-color-scheme:dark)');
  setTheme(stored || (sys.matches?'dark':'light'));
  sys.addEventListener('change',e => !stored && setTheme(e.matches?'dark':'light'));
  $('#theme-toggle').onclick = () => setTheme(document.documentElement.dataset.theme==='dark' ? 'light':'dark');
}

/* ---------- modal helpers ---------- */
function openModal(ov,box){
  show(ov); show(box);
  box.querySelector('button, [href], input, textarea, select')?.focus();
  const esc = e => { if(e.key==='Escape'){closeModal(ov,box);document.removeEventListener('keydown',esc);} };
  document.addEventListener('keydown',esc);
  $(ov).onclick = e => { if(e.target===e.currentTarget) closeModal(ov,box); };
}
function closeModal(ov,box){ show(ov,false); show(box,false); }

/* ---------- render ---------- */
let tarefas = [];
async function render(){
  const {data,error} = await supabase.from('todos').select('*').order('status').order('ordem');
  if(error){
    console.error(error);
    $('#kanban').innerHTML = `<p style="color:red;padding:1rem">Erro: ${error.message}</p>`;
    return;
  }
  tarefas = data;

  const labels = {nao_iniciado:'Não Iniciado',em_andamento:'Em Andamento',com_data:'Com Data',concluido:'Concluído'};
  $('#kanban').innerHTML = Object.entries(labels)
     .map(([k,v])=>`<div class="column" data-col="${k}"><h2>${v}</h2></div>`).join('');

  const recents = tarefas
      .filter(t=>t.status==='concluido')
      .sort((a,b)=>new Date(b.moved_at)-new Date(a.moved_at))
      .slice(0,3).map(t=>t.id);

  tarefas.forEach(t=>{
    const st = normStatus(t.status);
    if(st==='concluido' && !recents.includes(t.id)) return;
    const col = $(`.column[data-col="${st}"]`);
    if(!col) return;
    col.insertAdjacentHTML('beforeend',`
      <div class="card" data-id="${t.id}">
        <div class="title">${t.task}</div>
        ${t.prioridade ? `<div class="date">Prioridade: ${t.prioridade}</div>` : ''}
        <button class="move-btn">Move</button>
        <button class="edit-btn">Editar</button>
      </div>`);
  });

  $$('.card').forEach(c=>{
    const d = tarefas.find(t=>t.id===c.dataset.id);
    c.onclick = e => { if(e.target.closest('button')) return; openRead(d); };
    c.querySelector('.edit-btn').onclick = e => { e.stopPropagation(); openEdit(d); };
  });

  $$('.column').forEach(col=>{
    Sortable.create(col,{
      group:'kanban', handle:'.move-btn', animation:150, filter:'h2',
      onEnd: async evt =>{
        const dest = evt.to.dataset.col;
        const cards = [...evt.to.querySelectorAll('.card')];
        for(let i=0;i<cards.length;i++){
          const id = cards[i].dataset.id;
          await supabase.from('todos').update({status:dest,ordem:i,moved_at:new Date().toISOString()}).eq('id',id);
          if(dest==='concluido'){
            const t = tarefas.find(x=>x.id===id);
            await supabase.from('concluded').insert([{todo_id:id,task:t.task,contexto:t.contexto,responsavel:t.responsavel}]);
          }
        }
        toast('Tarefa movida!'); render();
      }
    });
  });
}

/* ---------- adicionar ---------- */
$('#form').onsubmit = async e=>{
  e.preventDefault();
  const f = e.target;
  const {data:max} = await supabase.from('todos')
        .select('ordem').eq('status',f.status.value)
        .order('ordem',{ascending:false}).limit(1).single();
  const nova = {
    task: f.titulo.value,
    descricao: f.descricao.value || null,
    status: normStatus(f.status.value),
    tempo_estimado: mmss2sql(f.tempo_estimado.value),
    prioridade: f.prioridade.value,
    contexto: normContext(f.contexto.value),
    responsavel: f.responsavel.value,
    ordem: (max?.ordem || 0) + 1,
    user_id: '00000000-0000-0000-0000-000000000000'
  };
  const {error} = await supabase.from('todos').insert([nova]);
  if(error){ toast('Erro ao salvar'); console.error(error); return; }
  f.reset(); toast('Tarefa adicionada!'); render();
};

/* ---------- visualizar ---------- */
function openRead(t){
  $('#readTitulo').textContent   = t.task;
  $('#readDescricao').innerHTML  = md(t.descricao || '(sem descrição)');
  $('#readTempo').textContent    = t.tempo_estimado ? 'Tempo: '+sql2mmss(t.tempo_estimado) : '';
  $('#readPrioridade').textContent = t.prioridade ? 'Prioridade: '+t.prioridade : '';
  $('#readContexto').textContent = 'Contexto: ' + normContext(t.contexto);
  $('#readResp').textContent     = 'Resp: ' + (t.responsavel || '-');
  openModal('#readOverlay','#readModal');
}
$('#fecharRead').onclick = ()=> closeModal('#readOverlay','#readModal');

/* ---------- editar ---------- */
let tarefaParaExcluir=null;
function openEdit(t){
  const f = $('#editForm');
  f.id.value           = t.id;
  f.titulo.value       = t.task;
  f.descricao.value    = t.descricao || '';
  f.status.value       = normStatus(t.status);
  f.tempo_estimado.value = sql2mmss(t.tempo_estimado);
  f.prioridade.value   = t.prioridade || 'normal';
  f.contexto.value     = normContext(t.contexto);
  f.responsavel.value  = t.responsavel || '';
  openModal('#overlay','#editModal');
  $('#btn-excluir-modal').onclick = () => {
    tarefaParaExcluir = t;
    openModal('#modalExcluir','#excluirBox');
  };
}
$('#cancelEdit').onclick = ()=> closeModal('#overlay','#editModal');
$('#editForm').onsubmit = async e=>{
  e.preventDefault();
  const f = e.target;
  const upd = {
    task: f.titulo.value,
    descricao: f.descricao.value || null,
    status: normStatus(f.status.value),
    tempo_estimado: mmss2sql(f.tempo_estimado.value),
    prioridade: f.prioridade.value,
    contexto: normContext(f.contexto.value),
    responsavel: f.responsavel.value
  };
  const {error}=await supabase.from('todos').update(upd).eq('id',f.id.value);
  if(error){ toast('Erro ao atualizar'); console.error(error); return; }
  closeModal('#overlay','#editModal'); toast('Tarefa atualizada!'); render();
};

/* ---------- excluir ---------- */
$('#btnCancelarExcluir').onclick = ()=> closeModal('#modalExcluir','#excluirBox');
$('#btnConfirmarExcluir').onclick = async()=>{
  if(!tarefaParaExcluir) return;
  await supabase.from('excluidos').insert([{
    todo_id:tarefaParaExcluir.id,task:tarefaParaExcluir.task,
    contexto: normContext(tarefaParaExcluir.contexto),responsavel:tarefaParaExcluir.responsavel
  }]);
  await supabase.from('todos').delete().eq('id',tarefaParaExcluir.id);
  closeModal('#modalExcluir','#excluirBox'); tarefaParaExcluir=null;
  toast('Tarefa excluída!'); render();
};

/* ---------- concluídas ---------- */
$('#btn-concluidas').onclick = async ()=>{
  openModal('#modal-concluidas','#concluidasBox');
  $('#table-concluidas tbody').innerHTML = '<tr><td colspan="4">Carregando…</td></tr>';
  const since = new Date(Date.now()-7*864e5).toISOString();
  const {data,error} = await supabase.from('concluded').select('*').gte('concluded_at',since).order('concluded_at',{ascending:false});
  if(error){
    $('#table-concluidas tbody').innerHTML = `<tr><td colspan="4" style="color:red">${error.message}</td></tr>`;
    return;
  }
  if(!data.length){
    $('#table-concluidas tbody').innerHTML = '<tr><td colspan="4">Nenhuma tarefa concluída na última semana.</td></tr>';
    return;
  }
  $('#table-concluidas tbody').innerHTML = data.map(r=>`
      <tr>
        <td>${r.task}</td>
        <td>${normContext(r.contexto)}</td>
        <td>${r.responsavel||''}</td>
        <td>${new Date(r.concluded_at).toLocaleString()}</td>
      </tr>`).join('');
};
$('#closeConcluidas').onclick = ()=> closeModal('#modal-concluidas','#concluidasBox');

/* ---------- start ---------- */
document.addEventListener('DOMContentLoaded',()=>{ initTheme(); render(); });
