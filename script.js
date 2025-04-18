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

  // Cria o botão excluir dentro do modal, se ainda não existir
  let existingBtn = document.getElementById('btn-excluir-modal');
  if (!existingBtn) {
    const btn = document.createElement('button');
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
  } else {
    existingBtn.onclick = () => {
      tarefaParaExcluir = t;
      show('modalExcluir', true);
      document.querySelector('#modalExcluir .read-modal').style.display = 'block';
    };
  }
}

cancelEdit.onclick = () => {
  show('overlay', false);
  show('editModal', false);
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
    responsavel: tarefaParaExcluir.responsavel,
    descricao: tarefaParaExcluir.descricao,
    status: tarefaParaExcluir.status,
    prioridade: tarefaParaExcluir.prioridade,
    tempo_estimado: tarefaParaExcluir.tempo_estimado,
    user_id: tarefaParaExcluir.user_id,
    ordem: tarefaParaExcluir.ordem,
    created_at: tarefaParaExcluir.created_at,
    moved_at: tarefaParaExcluir.moved_at
  }]);

  const { error: delError } = await supabase.from('todos').delete().eq('id', tarefaParaExcluir.id);

  show('modalExcluir', false);
  document.querySelector('#modalExcluir .read-modal').style.display = 'none';
  tarefaParaExcluir = null;
  if (logError || delError) {
    toast('Erro ao excluir');
    console.error(logError || delError);
  } else {
    toast('Tarefa excluída!');
    render();
  }
};

/* ============= START ============= */
document.addEventListener('DOMContentLoaded', render);
