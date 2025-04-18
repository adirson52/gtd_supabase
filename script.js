/* ============= UTIL ============= */
const show = (id, on = true) => document.getElementById(id).style.display = on ? 'block' : 'none';
const toast = msg => {
  const el = document.getElementById('aviso');
  el.textContent = msg;
  show('aviso', true);
  setTimeout(() => show('aviso', false), 4000);
};
const mmss2sql = v => v && /^\d{1,2}:\d{2}$/.test(v) ? '00:' + v.padStart(5, '0') : null;
const sql2mmss = v => v ? v.slice(3) : '';

let tarefaParaExcluir = null; // referência temporária

/* ============= RENDER ============= */
async function render() {
  // busca tarefas ordenadas por status e ordem
  const { data: tarefas, error } = await supabase
    .from('todos').select('*')
    .order('status', { ascending: true })
    .order('ordem',  { ascending: true });
  if (error) {
    console.error('Erro ao carregar tarefas:', error.message);
    return;
  }

  // rótulos de colunas
  const labels = {
    urgente:      'Urgente',
    nao_iniciado: 'Não Iniciado',
    em_andamento: 'Em Andamento',
    com_data:     'Com Data',
    concluido:    'Concluído'
  };

  // monta colunas\ n  const kanban = document.getElementById('kanban');
  kanban.innerHTML = Object.entries(labels)
    .map(([key,label]) => `<div class="column" data-col="${key}"><h2>${label}</h2></div>`)
    .join('');

  // pega os 3 mais recentes em concluído
  const recentIds = tarefas
    .filter(t => t.status === 'concluido')
    .sort((a,b) => new Date(b.moved_at) - new Date(a.moved_at))
    .slice(0,3).map(t => t.id);

  tarefas.forEach(t => {
    // se em concluído, só mostra os top3
    if (t.status === 'concluido' && !recentIds.includes(t.id)) return;
    const col = kanban.querySelector(`.column[data-col=\"${t.status}\"]`);
    if (!col) return;

    col.insertAdjacentHTML('beforeend', `
      <div class="card" data-id="${t.id}">
        <div class="title">${t.task}</div>
        ${t.descricao ? `<div class="desc">${t.descricao}</div>` : ''}
        ${t.prioridade ? `<div class="date">Prioridade: ${t.prioridade}</div>` : ''}
        ${t.contexto ? `<div class="date">Contexto: ${t.contexto}</div>` : ''}
        ${t.tempo_estimado ? `<div class="date">Tempo: ${sql2mmss(t.tempo_estimado)}</div>` : ''}
        ${t.responsavel ? `<div class="date">Resp: ${t.responsavel}</div>` : ''}
        <button class="move-btn">Move</button>
        <button class="edit-btn">Editar</button>
        <button class="delete-btn">Excluir</button>
      </div>
    `);
  });

  // associa eventos aos cards
  kanban.querySelectorAll('.card').forEach(card => {
    const id = card.dataset.id;
    const dados = tarefas.find(x => x.id === id);

    // editar
    card.querySelector('.edit-btn').onclick = e => {
      e.stopPropagation();
      openEdit(dados);
    };

    // leitura ao clicar no corpo do card
    card.onclick = e => {
      if (e.target.classList.contains('move-btn') ||
          e.target.classList.contains('edit-btn') ||
          e.target.classList.contains('delete-btn')) return;
      openRead(dados);
    };

    // exclusão via modal de confirmação
    card.querySelector('.delete-btn').onclick = e => {
      e.stopPropagation();
      tarefaParaExcluir = dados;
      show('modalExcluir', true);
      document.querySelector('#modalExcluir .read-modal').style.display = 'block';
    };
  });

  // inicializa drag & drop
  kanban.querySelectorAll('.column').forEach(col => {
    Sortable.create(col, {
      group: 'kanban',
      animation: 150,
      handle: '.move-btn',
      filter: 'h2',
      onEnd: async evt => {
        const dest = evt.to.dataset.col;
        const cards = [...evt.to.querySelectorAll('.card')];
        for (let i = 0; i < cards.length; i++) {
          const id = cards[i].dataset.id;
          await supabase.from('todos')
            .update({ status: dest, ordem: i, moved_at: new Date().toISOString() })
            .eq('id', id);
          if (dest === 'concluido') {
            const task = tarefas.find(x => x.id === id);
            await supabase.from('concluded').insert([{
              todo_id: id,
              task: task.task,
              contexto: task.contexto,
              responsavel: task.responsavel
            }]);
          }
        }
        toast('Tarefa movida!');
        render();
      }
    });
  });
}

/* ============= NOVA TAREFA ============= */
document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const { data: max } = await supabase.from('todos')
    .select('ordem').eq('status', f.status.value)
    .order('ordem', { ascending: false })
    .limit(1).single();

  const nova = {
    task: f.titulo.value,
    descricao: f.descricao.value || null,
    status: f.status.value,
    tempo_estimado: mmss2sql(f.tempo_estimado.value),
    prioridade: f.prioridade.value,
    contexto: f.contexto.value,
    responsavel: f.responsavel.value,
    ordem: (max?.ordem || 0) + 1,
    user_id: '00000000-0000-0000-0000-000000000000'
  };

  const { error } = await supabase.from('todos').insert([nova]);
  if (error) {
    toast('Erro ao salvar'); console.error(error);
    return;
  }
  f.reset();
  toast('Tarefa salva!');
  render();
});

/* ============= MODAL LEITURA ============= */
function openRead(t) {
  readTitulo.textContent = t.task;
  readDescricao.textContent = t.descricao || '(sem descrição)';
  readTempo.textContent = t.tempo_estimado ? 'Tempo: ' + sql2mmss(t.tempo_estimado) : '';
  readPrioridade.textContent = t.prioridade ? 'Prioridade: ' + t.prioridade : '';
  readContexto.textContent = t.contexto ? 'Contexto: ' + t.contexto : '';
  readResp.textContent = 'Resp: ' + (t.responsavel || '-');
  show('readOverlay'); show('readModal');
}
fecharRead.onclick = () => { show('readOverlay', false); show('readModal', false); };

/* ============= MODAL EDIÇÃO ============= */
function openEdit(t) {
  const f = editForm;
  f.id.value = t.id;
  f.titulo.value = t.task;
  f.descricao.value = t.descricao || '';
  f.status.value = t.status;
  f.tempo_estimado.value = sql2mmss(t.tempo_estimado);
  f.prioridade.value = t.prioridade || 'normal';
  f.contexto.value = t.contexto || 'Faculdade';
  f.responsavel.value = t.responsavel || '';
  show('overlay'); show('editModal');

  // adiciona botão Excluir no modal de edição abaixo do Cancelar
  let btn = document.getElementById('btn-excluir-modal');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'btn-excluir-modal';
    btn.textContent = 'Excluir';
    btn.className = 'read-close';
    btn.style.background = '#d32f2f';
    btn.style.marginTop = '1rem';
    btn.style.width = '100%';
    btn.type = 'button';
    btn.onclick = () => {
      tarefaParaExcluir = t;
      show('modalExcluir', true);
      document.querySelector('#modalExcluir .read-modal').style.display = 'block';
    };
    f.appendChild(btn);
  }
}
cancelEdit.onclick = () => { show('overlay', false); show('editModal', false); };

/* ========== VER CONCLUÍDAS ========= */
document.getElementById('btn-concluidas').onclick = async () => {
  const modal = document.getElementById('modal-concluidas');
  const inner = modal.querySelector('.read-modal');
  const tbody = document.querySelector('#table-concluidas tbody');
  modal.style.display = 'block'; inner.style.display = 'block';
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center">Carregando…</td></tr>`;
  const limite = new Date(); limite.setDate(limite.getDate() - 7);
  const { data, error } = await supabase.from('concluded')
    .select('*')
    .gte('concluded_at', limite.toISOString())
    .order('concluded_at', { ascending: false });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:red">Erro: ${error.message}</td></tr>`;
    console.error(error); return;
  }
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="4">Nenhuma tarefa concluída na última semana.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(r => {
    const dt = new Date(r.concluded_at).toLocaleString();
    return `<tr>
      <td>${r.task}</td><td>${r.contexto||''}</td><td>${r.responsavel||''}</td><td>${dt}</td>
    </tr>`;
  }).join('');
};

/* ========= EXCLUSÃO ========= */
document.getElementById('btnCancelarExcluir').onclick = () => {
  show('modalExcluir', false);
  document.querySelector('#modalExcluir .read-modal').style.display = 'none';
};
document.getElementById('btnConfirmarExcluir').onclick = async () => {
  if (!tarefaParaExcluir) return;
  const { error: logError } = await supabase.from('excluidos').insert([{
    todo_id: tarefaParaExcluir.id,
    task: tarefaParaExcluir.task,
    contexto: tarefaParaExcluir.contexto,
    responsavel: tarefaParaExcluir.responsavel
  }]);
  const { error: delError } = await supabase.from('todos').delete().eq('id', tarefaParaExcluir.id);
  show('modalExcluir', false);
  document.querySelector('#modalExcluir .read-modal').style.display = 'none';
  tarefaParaExcluir = null;
  if (logError || delError) {
    toast('Erro ao excluir'); console.error(logError || delError);
  } else {
    toast('Tarefa excluída!'); render();
  }
};

/* ============= START ============= */
document.addEventListener('DOMContentLoaded', render);
