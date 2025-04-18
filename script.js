/* ============= UTIL ============= */
const show = (id, on = true) => document.getElementById(id).style.display = on ? 'block' : 'none';
const toast = msg => { const el=document.getElementById('aviso'); el.textContent=msg; show('aviso',true); setTimeout(()=>show('aviso',false),4e3); };
const mmss2sql = v => v && /^\d{1,2}:\d{2}$/.test(v) ? '00:'+v.padStart(5,'0') : null;
const sql2mmss = v => v ? v.slice(3) : '';

/* ============= RENDER ============= */
async function render() {
  const { data:tarefas } = await supabase
    .from('todos').select('*')
    .order('status').order('ordem');

  /* labels & colunas */
  const labels = {
    urgente:'Urgente', nao_iniciado:'Não Iniciado',
    em_andamento:'Em Andamento', com_data:'Com Data', concluido:'Concluído'
  };
  const kanban = document.getElementById('kanban');
  kanban.innerHTML = Object.entries(labels)
    .map(([k,l]) => `<div class="column" data-col="${k}"><h2>${l}</h2></div>`)
    .join('');

  /* só 3 mais recentes em “concluído” */
  const recentes = tarefas.filter(t=>t.status==='concluido')
        .sort((a,b)=>new Date(b.moved_at)-new Date(a.moved_at)).slice(0,3).map(t=>t.id);

  tarefas.forEach(t=>{
    if(t.status==='concluido' && !recentes.includes(t.id)) return;
    const col = kanban.querySelector(`[data-col="${t.status}"]`);
    if(!col) return;
    col.insertAdjacentHTML('beforeend',`
      <div class="card" data-id="${t.id}">
        <div class="title">${t.task}</div>
        ${t.descricao? `<div class="desc">${t.descricao}</div>`:''}
        ${t.prioridade?`<div class="date">Prioridade: ${t.prioridade}</div>`:''}
        ${t.contexto?  `<div class="date">Contexto: ${t.contexto}</div>`  :''}
        ${t.tempo_estimado?`<div class="date">Tempo: ${sql2mmss(t.tempo_estimado)}</div>`:''}
        ${t.responsavel? `<div class="date">Resp: ${t.responsavel}</div>`:''}
        <button class="move-btn">Move</button>
        <button class="edit-btn">Editar</button>
      </div>`);
  });

  /* eventos clique & drag */
  kanban.querySelectorAll('.card').forEach(card=>{
    const id = card.dataset.id;
    const dados = tarefas.find(x=>x.id===id);

    card.querySelector('.edit-btn').onclick = e=>{
      e.stopPropagation(); openEdit(dados);
    };
    card.onclick =e=>{
      if(e.target.classList.contains('move-btn')||e.target.classList.contains('edit-btn')) return;
      openRead(dados);
    };
  });

  /* drag via Move */
  kanban.querySelectorAll('.column').forEach(col=>{
    Sortable.create(col,{
      group:'kanban', animation:150,
      handle:'.move-btn', filter:'h2',
      onEnd: async evt=>{
        const dest = evt.to.dataset.col;
        const items = [...evt.to.querySelectorAll('.card')];
        for(let i=0;i<items.length;i++){
          const id
