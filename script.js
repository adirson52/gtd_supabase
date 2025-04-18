/* ========= UTILITÁRIAS ========= */
let avisoTimer = null;
const showMsg = m => {
  const el = document.getElementById('aviso');
  el.textContent = m;
  el.style.display = 'block';
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => el.style.display = 'none', 6000);
};
const mmss2sql = v => v && /^\d{1,2}:\d{2}$/.test(v) ? `00:${v.padStart(5, '0')}` : null;
const sql2mmss = v => v ? v.slice(3) : '';

/* ========= CARREGA & RENDERIZA ========= */
async function carregar() {
  // 1) busca todas as tasks
  const { data: tasks, error } = await supabase
    .from('todos')
    .select('*')
    .order('status',    { ascending: true })
    .order('ordem',     { ascending: true });
  if (error) return console.error(error);

  // 2) monta as colunas
  const labels = {
    urgente:      'Urgente',
    nao_iniciado: 'Não Iniciado',
    em_andamento: 'Em Andamento',
    com_data:     'Com Data',
    concluido:    'Concluído'
  };
  const kanban = document.getElementById('kanban');
  kanban.innerHTML = '';
  Object.entries(labels).forEach(([key, label]) => {
    kanban.insertAdjacentHTML('beforeend',
      `<div class="column" data-col="${key}"><h2>${label}</h2></div>`);
  });

  // 3) calcula top3 para 'concluido'
  const top3 = tasks
    .filter(t => t.status === 'concluido')
    .sort((a, b) => new Date(b.moved_at) - new Date(a.moved_at))
    .slice(0, 3)
    .map(t => t.id);

  // 4) renderiza cards
  tasks.forEach(t => {
    if (t.status === 'concluido' && !top3.includes(t.id)) return;
    const col = document.querySelector(`.column[data-col="${t.status}"]`);
    if (!col) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = t.id;
    card.innerHTML = `
      <div class="title">${t.task}</div>
      ${t.descricao ? `<div class="desc">${t.descricao}</div>` : ''}
      ${t.prioridade ? `<div class="date">Prioridade: ${t.prioridade}</div>` : ''}
      ${t.contexto   ? `<div class="date">Contexto: ${t.contexto}</div>`   : ''}
      ${t.tempo_estimado
         ? `<div class="date">Tempo: ${sql2mmss(t.tempo_estimado)}</div>`
         : ''}
      ${t.responsavel ? `<div class="date">Resp: ${t.responsavel}</div>` : ''}
      <button class="move-btn">Move</button>
      <button class="edit-btn">Editar</button>
    `;
    // clique fora dos botões abre modal de leitura
    card.addEventListener('click', e => {
      if (e.target.className === 'move-btn' || e.target.className === 'edit-btn') return;
      abrirLeitura(t);
    });
    // botão editar
    card.querySelector('.edit-btn').addEventListener('click', e => {
      e.stopPropagation();
      abrirEdicao(t);
    });
    col.appendChild(card);
  });

  // 5) configura drag&drop somente pelo handle .move-btn
  let isDragging = false;
  document.querySelectorAll('.column').forEach(col => {
    Sortable.create(col, {
      group: 'kanban',
      animation: 150,
      handle:  '.move-btn',
      filter:  'h2',
      onStart: () => isDragging = true,
      onEnd:   async evt => {
        const dest = evt.to.dataset.col;
        const cards = Array.from(evt.to.querySelectorAll('.card'));

        // 5.1) Atualiza status, ordem e moved_at no todos
        for (let i = 0; i < cards.length; i++) {
          await supabase.from('todos')
            .update({
              status:    dest,
              ordem:     i,
              moved_at:  new Date().toISOString()
            })
            .eq('id', cards[i].dataset.id);
        }

        // 5.2) Se foi para concluido, grava no log concluded
        if (dest === 'concluido') {
          // evt.item é o elemento movido
          const movedId = evt.item.dataset.id;
          // encontra a task original
          const t = tasks.find(x => x.id === movedId);
          await supabase.from('concluded').insert([{
            todo_id:     movedId,
            task:        t.task,
            contexto:    t.contexto,
            responsavel: t.responsavel
          }]);
        }

        isDragging = false;
        showMsg('Tarefa movida!');
        carregar();
      }
    });
  });

  // 6) interrompe clique pós-drag
  kanban.addEventListener('click', e => {
    if (isDragging) e.stopPropagation();
  }, true);
}

/* ========= NOVA TAREFA ========= */
document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  // pega última ordem na coluna
  const { data: maxRow } = await supabase
    .from('todos').select('ordem')
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
  if (error) {
    alert('Erro ao salvar');
    console.error(error);
    return;
  }
  f.reset();
  showMsg('Tarefa salva!');
  carregar();
});

/* ========= MODAL LEITURA ========= */
function abrirLeitura(t) {
  readTitulo.textContent     = t.task;
  readDescricao.textContent = t.descricao || '(sem descrição)';
  readTempo.textContent     = t.tempo_estimado ? 'Tempo: '+sql2mmss(t.tempo_estimado) : '';
  readPrioridade.textContent= t.prioridade   ? 'Prioridade: '+t.prioridade     : '';
  readContexto.textContent  = t.contexto     ? 'Contexto: '+t.contexto         : '';
  readResp.textContent      = 'Resp: '+(t.responsavel || '-');
  readOverlay.style.display = readModal.style.display = 'block';
}
fecharRead.onclick = readOverlay.onclick = () => {
  readOverlay.style.display = readModal.style.display = 'none';
};

/* ========= MODAL EDIÇÃO ========= */
function abrirEdicao(t) {
  const f = editForm;
  f.id.value             = t.id;
  f.titulo.value         = t.task;
  f.descricao.value      = t.descricao || '';
  f.status.value         = t.status;
  f.tempo_estimado.value = sql2mmss(t.tempo_estimado);
  f.prioridade.value     = t.prioridade || 'normal';
  f.contexto.value       = t.contexto   || 'Faculdade';
  f.responsavel.value    = t.responsavel || '';
  overlay.style.display   = editModal.style.display = 'block';
}
cancelEdit.onclick = () => {
  overlay.style.display   = editModal.style.display = 'none';
};
editForm.addEventListener('submit', async e => {
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
  if (error) {
    alert('Erro ao atualizar');
    console.error(error);
    return;
  }
  overlay.style.display   = editModal.style.display = 'none';
  showMsg('Tarefa atualizada!');
  carregar();
});

/* ========= VER LOG CONCLUÍDAS ========= */
document.getElementById('btn-concluidas').onclick = async () => {
  const modal = document.getElementById('modal-concluidas');
  const tbody = document.querySelector('#table-concluidas tbody');
  modal.style.display = 'block';
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:8px;">Carregando…</td></tr>';

  const { data, error } = await supabase
    .from('concluded')
    .select('*')
    .order('concluded_at', { ascending: false });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:red; padding:8px;">Erro ao carregar.</td></tr>`;
    console.error(error);
    return;
  }
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding:8px;">Nenhuma conclusão registrada ainda.</td></tr>`;
    return;
  }

  // monta as linhas
  tbody.innerHTML = data.map(r => {
    const d = new Date(r.concluded_at).toLocaleString();
    return `
      <tr>
        <td style="padding:8px; border:1px solid #ddd;">${r.task}</td>
        <td style="padding:8px; border:1px solid #ddd;">${r.contexto || ''}</td>
        <td style="padding:8px; border:1px solid #ddd;">${r.responsavel || ''}</td>
        <td style="padding:8px; border:1px solid #ddd;">${d}</td>
      </tr>`;
  }).join('');
};


/* ========= START ========= */
carregar();
