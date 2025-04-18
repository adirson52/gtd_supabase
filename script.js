/* ========= UTILIDADES ========= */
let avisoTimer = null;
function exibirAviso(msg) {
  const el = document.getElementById('aviso');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => (el.style.display = 'none'), 6000);
}
const mmssToSql = v => (v && /^\d{1,2}:\d{2}$/.test(v) ? `00:${v.padStart(5, '0')}` : null);
const sqlToMmss = v => (v ? v.slice(3) : '');

/* ========= CARREGA & RENDERIZA ========= */
async function carregarTarefas() {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('status', { ascending: true })
    .order('ordem',  { ascending: true });
  if (error) { console.error(error); return; }

  /* monta colunas */
  const labels = {
    urgente:'Urgente', nao_iniciado:'Não Iniciado',
    em_andamento:'Em Andamento', com_data:'Com Data', concluido:'Concluído'
  };
  const kanban = document.getElementById('kanban');
  kanban.innerHTML = '';
  Object.entries(labels).forEach(([k,l])=>{
    kanban.insertAdjacentHTML('beforeend',`<div class="column" data-col="${k}"><h2>${l}</h2></div>`);
  });

  /* adiciona cards */
  data.forEach(t=>{
    const col = document.querySelector(`.column[data-col="${t.status}"]`);
    if(!col) return;
    const c = document.createElement('div');
    c.className='card';
    c.dataset.id=t.id;
    c.innerHTML=`
      <div class="title">${t.task}</div>
      ${t.descricao?`<div class="desc">${t.descricao}</div>`:''}
      ${t.prioridade?`<div class="date">Prioridade: ${t.prioridade}</div>`:''}
      ${t.contexto?`<div class="date">Contexto: ${t.contexto}</div>`:''}
      ${t.tempo_estimado?`<div class="date">Tempo: ${sqlToMmss(t.tempo_estimado)}</div>`:''}
      ${t.responsavel?`<div class="date">Resp: ${t.responsavel}</div>`:''}
      <button class="edit-btn">Editar</button>
    `;
    c.onclick=e=>{if(e.target.className!=='edit-btn') abrirRead(t);};
    c.querySelector('.edit-btn').onclick=e=>{e.stopPropagation(); abrirEdit(t);};
    col.appendChild(c);
  });

  /* ativa drag & drop */
  document.querySelectorAll('.column').forEach(col=>{
    Sortable.create(col,{
      group:'kanban', animation:150,
      filter:'h2',           // impede arrastar o cabeçalho
      onEnd: async evt=>{
        const card   = evt.item;
        const id     = card.dataset.id;
        const newCol = evt.to.dataset.col;
        /* renumera irmãos */
        const siblings = Array.from(evt.to.querySelectorAll('.card'));
        for(let i=0;i<siblings.length;i++){
          const cid = siblings[i].dataset.id;
          await supabase.from('todos')
            .update({ ordem:i, status:newCol })
            .eq('id', cid);
        }
        exibirAviso('Tarefa movida!');
      }
    });
  });
}

/* =========  NOVA TAREFA ========= */
document.getElementById('form').addEventListener('submit', async e=>{
  e.preventDefault();
  const f=e.target;

  /* pega último ordem da coluna escolhida */
  const { data:maxRow } = await supabase
      .from('todos').select('ordem')
      .eq('status', f.status.value)
      .order('ordem',{ascending:false})
      .limit(1).single();

  const nova={
    task:f.titulo.value,
    descricao:f.descricao.value||null,
    status:f.status.value,
    tempo_estimado:mmssToSql(f.tempo_estimado.value),
    prioridade:f.prioridade.value,
    contexto:f.contexto.value,
    responsavel:f.responsavel.value,
    ordem:(maxRow?.ordem||0)+1,
    user_id:'00000000-0000-0000-0000-000000000000'
  };

  const {error}=await supabase.from('todos').insert([nova]);
  if(error){alert('Erro ao salvar');console.error(error);return;}
  f.reset(); exibirAviso('Tarefa salva!'); carregarTarefas();
});
/* ========= MODAL LEITURA ========= */
function abrirRead(t) {
  document.getElementById('readTitulo').textContent = t.task;
  document.getElementById('readDescricao').textContent = t.descricao || '(sem descrição)';
  document.getElementById('readTempo').textContent = t.tempo_estimado ? 'Tempo: ' + sqlParaMmss(t.tempo_estimado) : '';
  document.getElementById('readPrioridade').textContent = t.prioridade ? 'Prioridade: ' + t.prioridade : '';
  document.getElementById('readContexto').textContent = t.contexto ? 'Contexto: ' + t.contexto : '';
  document.getElementById('readResp').textContent = 'Resp: ' + (t.responsavel || '-');
  document.getElementById('readOverlay').style.display = 'block';
  document.getElementById('readModal').style.display = 'block';
}
document.getElementById('fecharRead').onclick =
document.getElementById('readOverlay').onclick = () => {
  document.getElementById('readOverlay').style.display = 'none';
  document.getElementById('readModal').style.display = 'none';
};

/* ========= MODAL EDIÇÃO ========= */
function abrirEdit(t) {
  const m = document.getElementById('editModal');
  const over = document.getElementById('overlay');
  const f = document.getElementById('editForm');
  f.id.value = t.id;
  f.titulo.value = t.task;
  f.descricao.value = t.descricao || '';
  f.status.value = t.status;
  f.tempo_estimado.value = sqlParaMmss(t.tempo_estimado);
  f.prioridade.value = t.prioridade || 'normal';
  f.contexto.value = t.contexto || 'Faculdade';
  f.responsavel.value = t.responsavel || '';
  over.style.display = 'block';
  m.style.display = 'block';
}
function fecharEdit() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('editModal').style.display = 'none';
}
document.getElementById('cancelEdit').onclick = fecharEdit;

/* submit edição */
document.getElementById('editForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const id = f.id.value;
  const upd = {
    task: f.titulo.value,
    descricao: f.descricao.value || null,
    status: f.status.value,
    tempo_estimado: mmssParaSql(f.tempo_estimado.value),
    prioridade: f.prioridade.value,
    contexto: f.contexto.value,
    responsavel: f.responsavel.value
  };
  const { error } = await supabase.from('todos').update(upd).eq('id', id);
  if (error) { alert('Erro ao atualizar'); console.error(error); return; }
  fecharEdit();
  exibirAviso('Tarefa atualizada!');
  carregarTarefas();
});

/* ========= INICIALIZA ========= */
carregarTarefas();
