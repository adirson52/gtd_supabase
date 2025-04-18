/* ========= UTILITÁRIAS ========= */
let avisoTimer = null;
const showMsg = m => {
  const el = document.getElementById('aviso');
  el.textContent = m;
  el.style.display = 'block';
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => el.style.display = 'none', 6000);
};
const mmss2sql = v => v && /^\d{1,2}:\d{2}$/.test(v) ? `00:${v.padStart(5,'0')}` : null;
const sql2mmss = v => v ? v.slice(3) : '';

/* ========= CARREGA & RENDERIZA ========= */
async function carregar() {
  const { data: tasks, error } = await supabase
    .from('todos').select('*')
    .order('status', { ascending: true })
    .order('ordem',  { ascending: true });
  if (error) return console.error(error);

  const labels = {
    urgente:      'Urgente',
    nao_iniciado: 'Não Iniciado',
    em_andamento: 'Em Andamento',
    com_data:     'Com Data',
    concluido:    'Concluído'
  };
  const kanban = document.getElementById('kanban');
  kanban.innerHTML = '';
  Object.entries(labels).forEach(([k, l]) => {
    kanban.insertAdjacentHTML('beforeend',
      `<div class="column" data-col="${k}"><h2>${l}</h2></div>`);
  });

  // top3 concluídas
  const recentConcluded = tasks
    .filter(t => t.status === 'concluido')
    .sort((a,b) => new Date(b.moved_at) - new Date(a.moved_at))
    .slice(0,3)
    .map(t => t.id);

  tasks.forEach(t => {
    if (t.status === 'concluido' && !recentConcluded.includes(t.id)) return;
    const col = document.querySelector(`.column[data-col="${t.status}"]`);
    if (!col) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = t.id;
    card.innerHTML = `
      <div class="title">${t.task}</div>
      ${t.descricao    ? `<div class="desc">${t.descricao}</div>` : ''}
      ${t.prioridade   ? `<div class="date">Prioridade: ${t.prioridade}</div>` : ''}
      ${t.contexto     ? `<div class="date">Contexto: ${t.contexto}</div>`   : ''}
      ${t.tempo_estimado
         ? `<div class="date">Tempo: ${sql2mmss(t.tempo_estimado)}</div>`
         : ''}
      ${t.responsavel ? `<div class="date">Resp: ${t.responsavel}</div>` : ''}
      <button class="move-btn">Move</button>
      <button class="edit-btn">Editar</button>
    `;
    card.addEventListener('click', e => {
      if (e.target.className==='move-btn'||e.target.className==='edit-btn') return;
      abrirLeitura(t);
    });
    card.querySelector('.edit-btn').onclick = e => {
      e.stopPropagation();
      abrirEdicao(t);
    };
    col.appendChild(card);
  });

  // drag & drop pelo Move
  let isDrag = false;
  document.querySelectorAll('.column').forEach(col => {
    Sortable.create(col, {
      group: 'kanban',
      animation: 150,
      handle: '.move-btn',
      filter: 'h2',
      onStart: () => isDrag = true,
      onEnd: async evt => {
        const dest = evt.to.dataset.col;
        const cards = [...evt.to.querySelectorAll('.card')];
        for (let i=0;i<cards.length;i++) {
          const id = cards[i].dataset.id;
          await supabase.from('todos')
            .update({ status: dest, ordem: i, moved_at: new Date().toISOString() })
            .eq('id', id);
        }
        if (dest === 'concluido') {
          const movedId = evt.item.dataset.id;
          const t = tasks.find(x=>x.id===movedId);
          await supabase.from('concluded').insert([{
            todo_id:     movedId,
            task:        t.task,
            contexto:    t.contexto,
            responsavel: t.responsavel
          }]);
        }
        isDrag = false;
        showMsg('Tarefa movida!');
        carregar();
      }
    });
  });
  kanban.addEventListener('click', e => {
    if (isDrag) e.stopPropagation();
  }, true);
}

/* ========= CRIAR NOVA TAREFA ========= */
document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const { data: maxRow } = await supabase
    .from('todos').select('ordem')
    .eq('status', f.status.value)
    .order('ordem', { ascending: false })
    .limit(1).single();
  const nova = {
    task:           f.titulo.value,
    descricao:      f.descricao.value || null,
    status:         f.status.value,
    tempo_estimado: mmss2sql(f.tempo_estimado.value),
    prioridade:     f.prioridade.value,
    contexto:       f.contexto.value,
    responsavel:    f.responsavel.value,
    ordem:          (maxRow?.ordem||0)+1,
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
  readTitulo.textContent      = t.task;
  readDescricao.textContent  = t.descricao || '(sem descrição)';
  readTempo.textContent      = t.tempo_estimado ? 'Tempo: '+sql2mmss(t.tempo_estimado) : '';
  readPrioridade.textContent = t.prioridade   ? 'Prioridade: '+t.prioridade       : '';
  readContexto.textContent   = t.contexto     ? 'Contexto: '+t.contexto           : '';
  readResp.textContent       = 'Resp: '+(t.responsavel||'-');
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
  const { error } = await supabase.from('todos').update(upd).eq('id', f.id.value);
  if (error) { alert('Erro ao atualizar'); console.error(error); return; }
  overlay.style.display   = editModal.style.display = 'none';
  showMsg('Tarefa atualizada!');
  carregar();
});

/* ========= VER CONCLUÍDAS – ÚLTIMA SEMANA EM TABELA ========= */
document.getElementById('btn-concluidas').onclick = async () => {
  const modal = document.getElementById('modal-concluidas');
  const tbody = document.querySelector('#table-concluidas tbody');

  // abre o modal
  modal.style.display = 'block';
  tbody.innerHTML = `
    <tr>
      <td colspan="4" style="text-align:center;padding:12px">
        Carregando…
      </td>
    </tr>`;

  // calcula data de 7 dias atrás
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // busca só registros da última semana
  const { data, error } = await supabase
    .from('concluded')
    .select('*')
    .gte('concluded_at', weekAgo.toISOString())
    .order('concluded_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="color:red;padding:8px">
          Erro ao carregar: ${error.message}
        </td>
      </tr>`;
    console.error(error);
    return;
  }

  if (!data.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="padding:8px">
          Nenhuma tarefa concluída na última semana.
        </td>
      </tr>`;
    return;
  }

  // popula as linhas
  tbody.innerHTML = data.map(r => {
    const dt = new Date(r.concluded_at).toLocaleString();
    return `
      <tr>
        <td>${r.task}</td>
        <td>${r.contexto || ''}</td>
        <td>${r.responsavel || ''}</td>
        <td>${dt}</td>
      </tr>`;
  }).join('');
};


/* ========= INICIA ========= */
carregar();
