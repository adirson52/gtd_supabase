/* ============ UTIL ============ */
const $   = sel => document.querySelector(sel);
const $$  = sel => Array.from(document.querySelectorAll(sel));
const show  = (sel, on = true) => ($(sel).style.display = on ? 'block' : 'none');
const toast = msg => {
  $('#aviso').textContent = msg;
  show('#aviso');
  setTimeout(() => show('#aviso', false), 3500);
};
const mmss2sql = v => v && /^\d{1,2}:\d{2}$/.test(v) ? '00:' + v.padStart(5, '0') : null;
const sql2mmss = v => v ? v.slice(3) : '';

let tarefaParaExcluir = null;

/* ============ THEME TOGGLE ============ */
function initTheme() {
  const toggle = $('#theme-toggle');
  const stored = localStorage.getItem('theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let theme = stored ? stored : (systemDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  toggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  toggle.onclick = () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    toggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  };

  // Concluídas theme
  const conclSelect = $('#concluidas-theme-select');
  const savedConcl = localStorage.getItem('concluidasTheme') || 'light';
  conclSelect.value = savedConcl;
  document.documentElement.setAttribute('data-concluidas-theme', savedConcl);

  conclSelect.onchange = e => {
    const val = e.target.value;
    document.documentElement.setAttribute('data-concluidas-theme', val);
    localStorage.setItem('concluidasTheme', val);
  };
}

/* ============ RENDERIZAÇÃO ============ */
async function render() {
  const { data: tarefas, error } = await supabase
    .from('todos').select('*')
    .order('status', { ascending: true })
    .order('ordem',   { ascending: true });
  if (error) { console.error(error); return; }

  const labels = {
    nao_iniciado: 'Não Iniciado',
    em_andamento: 'Em Andamento',
    com_data:     'Com Data',
    concluido:    'Concluído'
  };
  $('#kanban').innerHTML = Object.entries(labels)
    .map(([k, v]) => `<div class="column" data-col="${k}"><h2>${v}</h2></div>`)
    .join('');

  const recents = tarefas
    .filter(t => t.status === 'concluido')
    .sort((a, b) => new Date(b.moved_at) - new Date(a.moved_at))
    .slice(0, 3)
    .map(t => t.id);

  tarefas.forEach(t => {
    if (t.status === 'concluido' && !recents.includes(t.id)) return;
    const col = $(`.column[data-col="${t.status}"]`);
    if (!col) return;
    col.insertAdjacentHTML('beforeend', `
      <div class="card" data-id="${t.id}">
        <div class="title">${t.task}</div>
        ${t.descricao      ? `<div class="desc">${t.descricao}</div>` : ''}
        ${t.prioridade     ? `<div class="date">Prioridade: ${t.prioridade}</div>` : ''}
        ${t.contexto       ? `<div class="date">Contexto: ${t.contexto}</div>` : ''}
        ${t.tempo_estimado ? `<div class="date">Tempo: ${sql2mmss(t.tempo_estimado)}</div>` : ''}
        ${t.responsavel    ? `<div class="date">Resp: ${t.responsavel}</div>` : ''}
        <button class="move-btn">Move</button>
        <button class="edit-btn">Editar</button>
      </div>
    `);
  });

  $$('.card').forEach(card => {
    const dados = tarefas.find(t => t.id === card.dataset.id);
    card.onclick = e => { if (e.target.closest('button')) return; openRead(dados); };
    card.querySelector('.edit-btn').onclick = e => { e.stopPropagation(); openEdit(dados); };
  });

  $$('.column').forEach(col => {
    Sortable.create(col, {
      group: 'kanban',
      handle: '.move-btn',
      animation: 150,
      filter: 'h2',
      onEnd: async evt => {
        const dest = evt.to.dataset.col;
        const cards = Array.from(evt.to.querySelectorAll('.card'));
        for (let i = 0; i < cards.length; i++) {
          const id = cards[i].dataset.id;
          await supabase.from('todos')
            .update({ status: dest, ordem: i, moved_at: new Date().toISOString() })
            .eq('id', id);
          if (dest === 'concluido') {
            const t = tarefas.find(x => x.id === id);
            await supabase.from('concluded').insert([{
              todo_id:     id,
              task:        t.task,
              contexto:    t.contexto,
              responsavel: t.responsavel
            }]);
          }
        }
        toast('Tarefa movida!');
        render();
      }
    });
  });
}

/* ============ ADICIONAR NOVA TAREFA ============ */
$('#form').onsubmit = async e => {
  e.preventDefault();
  const f = e.target;
  const { data: max } = await supabase.from('todos')
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
    ordem:          (max?.ordem || 0) + 1,
    user_id:        '00000000-0000-0000-0000-000000000000'
  };
  const { error } = await supabase.from('todos').insert([nova]);
  if (error) { toast('Erro ao salvar'); console.error(error); return; }
  f.reset();
  toast('Tarefa adicionada!');
  render();
};

/* ============ MODAL LEITURA ============ */
function openRead(t) {
  $('#readTitulo').textContent    = t.task;
  $('#readDescricao').textContent = t.descricao || '(sem descrição)';
  $('#readTempo').textContent     = t.tempo_estimado ? 'Tempo: ' + sql2mmss(t.tempo_estimado) : '';
  $('#readPrioridade').textContent= t.prioridade ? 'Prioridade: ' + t.prioridade : '';
  $('#readContexto').textContent  = t.contexto ? 'Contexto: ' + t.contexto : '';
  $('#readResp').textContent      = 'Resp: ' + (t.responsavel || '-');
  show('#readOverlay');
  show('#readModal');
}
$('#fecharRead').onclick = () => {
  show('#readOverlay', false);
  show('#readModal',   false);
};

/* ============ MODAL EDIÇÃO ============ */
function openEdit(t) {
  const f = $('#editForm');
  f.id.value             = t.id;
  f.titulo.value         = t.task;
  f.descricao.value      = t.descricao || '';
  f.status.value         = t.status;
  f.tempo_estimado.value = sql2mmss(t.tempo_estimado);
  f.prioridade.value     = t.prioridade || 'normal';
  f.contexto.value       = t.contexto   || 'Faculdade';
  f.responsavel.value    = t.responsavel||'';

  show('#overlay');
  show('#editModal');
  $('#btn-excluir-modal').onclick = () => {
    tarefaParaExcluir = t;
    show('#modalExcluir');
  };
}
$('#cancelEdit').onclick = () => {
  show('#overlay',   false);
  show('#editModal', false);
};
$('#editForm').onsubmit = async e => {
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
  if (error) { toast('Erro ao atualizar'); console.error(error); return; }
  show('#overlay',   false);
  show('#editModal', false);
  toast('Tarefa atualizada!');
  render();
};

/* ============ VER CONCLUÍDAS ============ */
$('#btn-concluidas').onclick = async () => {
  show('#modal-concluidas');
  $('#table-concluidas tbody').innerHTML = '<tr><td colspan="4">Carregando…</td></tr>';

  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data, error } = await supabase
    .from('concluded')
    .select('*')
    .gte('concluded_at', since)
    .order('concluded_at', { ascending: false });
  if (error) {
    $('#table-concluidas tbody').innerHTML =
      `<tr><td colspan="4" style="color:red">${error.message}</td></tr>`;
    return;
  }
  if (!data.length) {
    $('#table-concluidas tbody').innerHTML =
      '<tr><td colspan="4">Nenhuma tarefa concluída na última semana.</td></tr>';
    return;
  }
  $('#table-concluidas tbody').innerHTML = data.map(r => `
    <tr>
      <td>${r.task}</td>
      <td>${r.contexto || ''}</td>
      <td>${r.responsavel || ''}</td>
      <td>${new Date(r.concluded_at).toLocaleString()}</td>
    </tr>
  `).join('');
};
function closeConcluidas() {
  show('#modal-concluidas', false);
}

/* ============ EXCLUIR ============ */
$('#btnCancelarExcluir').onclick = () => show('#modalExcluir', false);
$('#btnConfirmarExcluir').onclick = async () => {
  if (!tarefaParaExcluir) return;
  await supabase.from('excluidos').insert([{
    todo_id:     tarefaParaExcluir.id,
    task:        tarefaParaExcluir.task,
    contexto:    tarefaParaExcluir.contexto,
    responsavel: tarefaParaExcluir.responsavel
  }]);
  await supabase.from('todos').delete().eq('id', tarefaParaExcluir.id);
  show('#modalExcluir', false);
  tarefaParaExcluir = null;
  toast('Tarefa excluída!');
  render();
};

/* ============ START ============ */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  render();
});
