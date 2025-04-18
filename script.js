/* ============= UTILIDADES ============= */
const qs = s => document.querySelector(s);
const show = (id, on = true) =>
  (document.getElementById(id).style.display = on ? 'block' : 'none');

const toast = msg => {
  const el = document.getElementById('aviso');
  el.textContent = msg;
  show('aviso', true);
  setTimeout(() => show('aviso', false), 3500);
};

const mmss2sql = v =>
  v && /^\d{1,2}:\d{2}$/.test(v) ? '00:' + v.padStart(5, '0') : null;
const sql2mmss = v => (v ? v.slice(3) : '');

let tarefaParaExcluir = null; // usada pelo modal de exclusão

/* ============= CARREGA & RENDERIZA ============= */
async function render() {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('status')
    .order('ordem');
  if (error) {
    console.error(error);
    return;
  }
  const tarefas = data || [];

  /* monta colunas */
  const labels = {
    urgente: 'Urgente',
    nao_iniciado: 'Não Iniciado',
    em_andamento: 'Em Andamento',
    com_data: 'Com Data',
    concluido: 'Concluído'
  };
  const kanban = document.getElementById('kanban');
  kanban.innerHTML = Object.entries(labels)
    .map(
      ([k, l]) => `<div class="column" data-col="${k}">
                     <h2>${l}</h2>
                   </div>`
    )
    .join('');

  /* mantém apenas 3 + recentes em concluído */
  const top3Concluido = tarefas
    .filter(t => t.status === 'concluido')
    .sort((a, b) => new Date(b.moved_at) - new Date(a.moved_at))
    .slice(0, 3)
    .map(t => t.id);

  tarefas.forEach(t => {
    if (t.status === 'concluido' && !top3Concluido.includes(t.id)) return;
    const col = qs(`.column[data-col="${t.status}"]`);
    if (!col) return;

    col.insertAdjacentHTML(
      'beforeend',
      `<div class="card" data-id="${t.id}">
         <div class="title">${t.task}</div>
         ${t.descricao ? `<div class="desc">${t.descricao}</div>` : ''}
         ${t.prioridade ? `<div class="date">Prioridade: ${t.prioridade}</div>` : ''}
         ${t.contexto ? `<div class="date">Contexto: ${t.contexto}</div>` : ''}
         ${
           t.tempo_estimado
             ? `<div class="date">Tempo: ${sql2mmss(t.tempo_estimado)}</div>`
             : ''
         }
         ${t.responsavel ? `<div class="date">Resp: ${t.responsavel}</div>` : ''}
         <button class="move-btn">Move</button>
         <button class="edit-btn">Editar</button>
       </div>`
    );
  });

  /* eventos nos cards */
  kanban.querySelectorAll('.card').forEach(card => {
    const id = card.dataset.id;
    const dados = tarefas.find(t => t.id === id);

    /* leitura */
    card.addEventListener('click', e => {
      if (e.target.closest('button')) return; // clicou num botão
      openRead(dados);
    });

    /* editar */
    card.querySelector('.edit-btn').onclick = e => {
      e.stopPropagation();
      openEdit(dados);
    };
  });

  /* drag & drop */
  kanban.querySelectorAll('.column').forEach(col => {
    Sortable.create(col, {
      group: 'kanban',
      handle: '.move-btn',
      animation: 150,
      onEnd: async evt => {
        const dest = evt.to.dataset.col;
        [...evt.to.children].forEach(async (c, i) => {
          const id = c.dataset.id;
          await supabase
            .from('todos')
            .update({ status: dest, ordem: i, moved_at: new Date().toISOString() })
            .eq('id', id);

          if (dest === 'concluido') {
            const t = tarefas.find(x => x.id === id);
            await supabase.from('concluded').insert([
              {
                todo_id: id,
                task: t.task,
                contexto: t.contexto,
                responsavel: t.responsavel
              }
            ]);
          }
        });
        toast('Tarefa movida!');
        render();
      }
    });
  });
}

/* ============= ADICIONA NOVA TAREFA ============= */
document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;

  const { data: max } = await supabase
    .from('todos')
    .select('ordem')
    .eq('status', f.status.value)
    .order('ordem', { ascending: false })
    .limit(1)
    .single();

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
  toast('Tarefa adicionada!');
  render();
});

/* ============= MODAL LEITURA ============= */
function openRead(t) {
  readTitulo.textContent = t.task;
  readDescricao.textContent = t.descricao || '(sem descrição)';
  readTempo.textContent = t.tempo_estimado
    ? 'Tempo: ' + sql2mmss(t.tempo_estimado)
    : '';
  readPrioridade.textContent = t.prioridade ? 'Prioridade: ' + t.prioridade : '';
  readContexto.textContent = t.contexto ? 'Contexto: ' + t.contexto : '';
  readResp.textContent = 'Resp: ' + (t.responsavel || '-');
  show('readOverlay');
  show('readModal');
}
fecharRead.onclick = () => {
  show('readOverlay', false);
  show('readModal', false);
};

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
  show('overlay');
  show('editModal');

  /* botão Excluir dentro do modal */
  let btn = document.getElementById('btn-excluir-modal');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'btn-excluir-modal';
    btn.className = 'read-close';
    btn.style.background = '#d32f2f';
    btn.style.marginTop = '1rem';
    btn.textContent = 'Excluir';
    btn.type = 'button';
    editForm.appendChild(btn);
  }
  btn.onclick = () => {
    tarefaParaExcluir = t;
    show('modalExcluir');
    qs('#modalExcluir .read-modal').style.display = 'block';
  };
}
cancelEdit.onclick = () => {
  show('overlay', false);
  show('editModal', false);
};

editForm.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const upd = {
    task: f.titulo.value,
    descricao: f.descricao.value || null,
    status: f.status.value,
    tempo_estimado: mmss2sql(f.tempo_estimado.value),
    prioridade: f.prioridade.value,
    contexto: f.contexto.value,
    responsavel: f.responsavel.value
  };
  const { error } = await supabase.from('todos').update(upd).eq('id', f.id.value);
  if (error) {
    toast('Erro ao atualizar'); console.error(error);
    return;
  }
  show('overlay', false);
  show('editModal', false);
  toast('Tarefa atualizada!');
  render();
});

/* ============= LISTA CONCLUÍDAS (últ. semana) ============= */
document.getElementById('btn-concluidas').onclick = async () => {
  const modal = document.getElementById('modal-concluidas');
  modal.style.display = 'block';
  const tbody = qs('#table-concluidas tbody');
  tbody.innerHTML =
    '<tr><td colspan="4" style="text-align:center">Carregando…</td></tr>';

  const d = new Date();
  d.setDate(d.getDate() - 7);

  const { data, error } = await supabase
    .from('concluded')
    .select('*')
    .gte('concluded_at', d.toISOString())
    .order('concluded_at', { ascending: false });

  if (error) {
    tbody.innerHTML =
      `<tr><td colspan="4" style="color:red">Erro: ${error.message}</td></tr>`;
    return;
  }
  if (!data.length) {
    tbody.innerHTML =
      '<tr><td colspan="4">Nenhuma tarefa concluída na última semana.</td></tr>';
    return;
  }
  tbody.innerHTML = data
    .map(
      r => `<tr>
              <td>${r.task}</td>
              <td>${r.contexto || ''}</td>
              <td>${r.responsavel || ''}</td>
              <td>${new Date(r.concluded_at).toLocaleString()}</td>
            </tr>`
    )
    .join('');
};

/* ============= EXCLUSÃO (modal) ============= */
btnCancelarExcluir.onclick = () => {
  show('modalExcluir', false);
  qs('#modalExcluir .read-modal').style.display = 'none';
};
btnConfirmarExcluir.onclick = async () => {
  if (!tarefaParaExcluir) return;
  const { error: logErr } = await supabase
    .from('excluidos')
    .insert([
      {
        todo_id: tarefaParaExcluir.id,
        task: tarefaParaExcluir.task,
        contexto: tarefaParaExcluir.contexto,
        responsavel: tarefaParaExcluir.responsavel
      }
    ]);

  const { error: delErr } = await supabase
    .from('todos')
    .delete()
    .eq('id', tarefaParaExcluir.id);

  show('modalExcluir', false);
  qs('#modalExcluir .read-modal').style.display = 'none';
  tarefaParaExcluir = null;

  if (logErr || delErr) {
    toast('Erro ao excluir'); console.error(logErr || delErr);
  } else {
    toast('Tarefa excluída!');
    render();
  }
};

/* ============= INICIALIZA ============= */
document.addEventListener('DOMContentLoaded', render);
