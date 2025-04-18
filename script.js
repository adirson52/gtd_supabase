/* =====================  UTILIDADES ===================== */
let avisoTimer = null;
function exibirAviso(msg) {
  const el = document.getElementById('aviso');
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => (el.style.display = 'none'), 6000);
}

/* =====================  CARREGA E RENDERIZA ===================== */
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

    // garante que as colunas aparecem mesmo sem tarefas
    Object.entries(colunas).forEach(([key, label]) => {
      const col = document.createElement('div');
      col.className = 'column';
      col.innerHTML = `<h2>${label}</h2>`;
      kanban.appendChild(col);
    });

    // insere as tarefas nos seus respectivos quadros
    tarefas.forEach(t => {
      const pai = document.querySelector(`.column h2:contains("${colunas[t.status]}")`)?.parentElement 
               || document.querySelector('.column');
      if (!pai) return;

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="title">${t.task}</div>
        <div class="tags">
          ${(t.tags || '')
            .split(';')
            .filter(Boolean)
            .map(tag => `<span class="tag">${tag}</span>`)
            .join('')}
        </div>
        ${t.prioridade ? `<div class="date">Prioridade: ${t.prioridade}</div>` : ''}
        ${t.contexto ? `<div class="date">Contexto: ${t.contexto}</div>` : ''}
        ${t.tempo_estimado ? `<div class="date">Tempo: ${t.tempo_estimado}</div>` : ''}
        ${t.data_limite ? `<div class="date">Prazo: ${t.data_limite}</div>` : ''}
        ${t.responsavel ? `<div class="date">Resp: ${t.responsavel}</div>` : ''}
      `;
      pai.appendChild(card);
    });
  } catch (err) {
    console.error('Erro ao carregar:', err.message);
  }
}

/* =====================  NOVA TAREFA ===================== */
document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;

  const nova = {
    task: f.titulo.value,
    status: f.status.value,
    tags: f.tags.value,
    data_limite: f.data_limite.value || null,
    tempo_estimado: f.tempo_estimado.value || null,
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
    console.error('Erro ao salvar:', err.message);
    alert('Falha ao salvar tarefa.');
  }
});

/* =====================  INICIALIZA ===================== */
carregarTarefas();
