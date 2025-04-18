/* ========= UTIL ========= */
let avisoTimer = null;
const showMsg = m => {
  const el = document.getElementById('aviso');
  el.textContent = m; el.style.display = 'block';
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => el.style.display = 'none', 6000);
};
const mmss2sql = v =>
  v && /^\d{1,2}:\d{2}$/.test(v)
    ? `00:${v.padStart(5,'0')}`
    : null;
const sql2mmss = v => v ? v.slice(3) : '';

/* ========= CARREGA & RENDERIZA ========= */
async function carregar() {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('status', { ascending: true })
    .order('ordem',  { ascending: true });
  if (error) { console.error(error); return; }

  // montar colunas
  const labels = {
    urgente:      'Urgente',
    nao_iniciado: 'Não Iniciado',
    em_andamento: 'Em Andamento',
    com_data:     'Com Data',
    concluido:    'Concluído'
  };
  const kanban = document.getElementById('kanban');
  kanban.innerHTML = '';
  Object.entries(labels).forEach(([key,label]) => {
    kanban.insertAdjacentHTML('beforeend',
      `<div class="column" data-col="${key}"><h2>${label}</h2></div>`);
  });

  // renderizar cards
  data.forEach(t => {
    const col = document.querySelector(`.column[data-col="${t.status}"]`);
    if (!col) return;

    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = t.id;
    card.innerHTML = `
      <div class="title">${t.task}</div>
      ${t.descricao    ? `<div class="desc">${t.descricao}</div>` : ''}
      ${t.prioridade   ? `<div class="date">Prioridade: ${t.prioridade}</div>` : ''}
      ${t.contexto     ? `<div class="date">Contexto: ${t.contexto}</div>` : ''}
      ${t.tempo_estimado
         ? `<div class="date">Tempo: ${sql2mmss(t.tempo_estimado)}</div>`
         : ''}
      ${t.responsavel  ? `<div class="date">Resp: ${t.responsavel}</div>` : ''}
      <button class="move-btn">Move</button>
      <button class="edit-btn">Editar</button>
    `;

    // leitura no clique fora do editar/move
    card.addEventListener('click', e => {
      if (e.target.className === 'move-btn' || e.target.className === 'edit-btn')
        return;
      abrirLeitura(t);
    });

    // editar
    card.querySelector('.edit-btn').addEventListener('click', e => {
      e.stopPropagation();
      abrirEdicao(t);
    });

    col.appendChild(card);
  });

  // drag & drop apenas pelo handle “Move” (delay 1500ms)
  let isDragging = false;
  document.querySelectorAll('.column').forEach(col => {
    Sortable.create(col, {
      group: 'kanban',
      animation: 150,
      handle: '.move-btn',
      delay: 1500,
      delayOnTouchOnly: false,
      filter: 'h2',
      onStart: () => { isDragging = true; },
      onEnd: async evt => {
        const dest = evt.to.dataset.col;
        const cards = Array.from(evt.to.querySelectorAll('.card'));
        for (let i = 0; i < cards.length; i++) {
          await supabase.from('todos')
            .update({
              status: dest,
              ordem: i,
              moved_at: new Date().toISOString()
            })
            .eq('id', cards[i].dataset.id);
        }
        isDragging = false;
        showMsg('Tarefa movida!');
      }
    });
  });

  // prevenir abrir modal após arrastar
  kanban.addEventListener('click', e => {
    if (isDragging) e.stopPropagation();
  }, true);
}

/* ========= NOVA TAREFA ========= */
document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;

  // calcula próxima ordem na coluna
  const { data: maxRow } = await supabase
    .from('todos')
    .select('ordem')
    .eq('status', f.status.value)
    .order('ordem', { ascending: false })
    .limit(1)
    .single();

  const nova = {
    task:           f.titulo.value,
    descricao:      f.descricao.value || null,
    status:         f.status.value,
    tempo_estimado: mmss2sql(f.tempo_estimado.value),
    prioridade:     f.prioridade.value,
    contexto:       f.contexto.value,
    responsavel:    f.responsavel.value,
    ordem:          (maxRow?.ordem || 0) + 1,
    user_id:        '00000000-0000-0000-0000-000000000000'
  };

  const { error } = await supabase.from('todos').insert([nova]);
  if (error) { alert('Erro ao salvar'); console.error(error); return; }

  f.reset();
  showMsg('Tarefa salva!');
  carregar();
});

/* ========= MODAL LEITURA ========= */
function abrirLeitura(t) {
  document.getElementById('readTitulo').textContent     = t.task;
  document.getElementById('readDescricao').textContent = t.descricao || '(sem descrição)';
  document.getElementById('readTempo').textContent     = t.tempo_estimado
    ? 'Tempo: ' + sql2mmss(t.tempo_estimado)
    : '';
  document.getElementById('readPrioridade').textContent = t.prioridade
    ? 'Prioridade: ' + t.prioridade
    : '';
  document.getElementById('readContexto').textContent   = t.contexto
    ? 'Contexto: ' + t.contexto
    : '';
  document.getElementById('readResp').textContent       = 'Resp: ' + (t.responsavel || '-');

  document.getElementById('readOverlay').style.display = 'block';
  document.getElementById('readModal').style.display   = 'block';
}
document.getElementById('fecharRead').onclick =
document.getElementById('readOverlay').onclick = () => {
  document.getElementById('readOverlay').style.display = 'none';
  document.getElementById('readModal').style.display   = 'none';
};

/* ========= MODAL EDIÇÃO ========= */
function abrirEdicao(t) {
  const f = document.getElementById('editForm');
  f.id.value             = t.id;
  f.titulo.value         = t.task;
  f.descricao.value      = t.descricao || '';
  f.status.value         = t.status;
  f.tempo_estimado.value = sql2mmss(t.tempo_estimado);
  f.prioridade.value     = t.prioridade || 'normal';
  f.contexto.value       = t.contexto   || 'Faculdade';
  f.responsavel.value    = t.responsavel || '';

  document.getElementById('overlay').style.display   = 'block';
  document.getElementById('editModal').style.display = 'block';
}
document.getElementById('cancelEdit').onclick = () => {
  document.getElementById('overlay').style.display   = 'none';
  document.getElementById('editModal').style.display = 'none';
};
document.getElementById('editForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const upd = {
    task:           f.titulo.value,
    descricao:      f.descricao.value || null,
    status:         f.status.value,
    tempo_estimado: mmss2sql(f.tempo_estimado.value),
    prioridade:     f.prioridade.value,
    contexto:       f.contexto.value,
    responsavel:    f.responsavel.value
  };
  const { error } = await supabase
    .from('todos')
    .update(upd)
    .eq('id', f.id.value);
  if (error) { alert('Erro ao atualizar'); console.error(error); return; }

  document.getElementById('overlay').style.display   = 'none';
  document.getElementById('editModal').style.display = 'none';
  showMsg('Tarefa atualizada!');
  carregar();
});

/* ========= START ========= */
carregar();
