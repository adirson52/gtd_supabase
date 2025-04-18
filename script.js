/* ========= UTILIDADES ========= */
let avisoTimer = null;
function exibirAviso(msg) {
  const el = document.getElementById('aviso');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => (el.style.display = 'none'), 6000);
}

/* ========= CARREGA E RENDERIZA ========= */
async function carregarTarefas() {
  try {
    const { data: tarefas, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const colunas = {
      urgente: 'Urgente',
      nao_iniciado: 'Não Iniciado',
      em_andamento: 'Em Andamento',
      com_data: 'Com Data',
      concluido: 'Concluído'
    };

    const kanban = document.getElementById('kanban');
    kanban.innerHTML = '';

    Object.entries(colunas).forEach(([key, label]) => {
      const col = document.createElement('div');
      col.className = 'column';
      col.dataset.col = key;
      col.innerHTML = `<h2>${label}</h2>`;
      kanban.appendChild(col);
    });

    tarefas.forEach(t => {
      const coluna = document.querySelector(`.column[data-col="${t.status}"]`);
      if (!coluna) return;

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="title">${t.task}</div>
        ${t.descricao ? `<div class="desc">${t.descricao}</div>` : ''}
        ${t.prioridade ? `<div class="date">Prioridade: ${t.prioridade}</div>` : ''}
        ${t.contexto ? `<div class="date">Contexto: ${t.contexto}</div>` : ''}
        ${t.tempo_estimado ? `<div class="date">Tempo: ${t.tempo_estimado}</div>` : ''}
        ${t.responsavel ? `<div class="date">Resp: ${t.responsavel}</div>` : ''}
      `;
      coluna.appendChild(card);
    });
  } catch (err) {
    console.error('Erro ao carregar:', err.message);
  }
}

/* ========= NOVA TAREFA ========= */
document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;

  /* converte mm:ss → 00:mm:ss para o tipo time */
  const bruto = f.tempo_estimado.value.trim();
  let tempoSql = null;
  if (bruto) {
    const ok = /^\d{1,2}:\d{2}$/.test(bruto);
    if (!ok) return alert('Tempo deve estar no formato mm:ss');
    tempoSql = `00:${bruto.padStart(5, '0')}`; // 5 => 0m00s
  }

  const nova = {
    task: f.titulo.value,
    descricao: f.descricao.value || null,
    status: f.status.value,
    tempo_estimado: tempoSql,
    prioridade: f.prioridade.value,
    contexto: f.contexto.value,
    responsavel: f.responsavel.value,
    user_id: '00000000-0000-0000-0000-000000000000'
  };

  try {
    const { error } = await supabase.from('todos').insert([nova]);
    if (error) throw error;
    f.reset();
    exibirAviso('Tarefa salva com sucesso!');
    carregarTarefas();
  } catch (err) {
    console.error('Erro detalhado:', err);
    alert('Falha ao salvar tarefa.');
  }
});

/* ========= INICIALIZA ========= */
carregarTarefas();
