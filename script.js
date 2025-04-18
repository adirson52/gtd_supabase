
/* =====================  SUPABASE INIT  ===================== */
const supabase = supabase.createClient(
  'https://pgbwgsmkngvhygwdjqng.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnYndnc21rbmd2aHlnd2RqcW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NDgyNzYsImV4cCI6MjA2MDUyNDI3Nn0.l08904UwxzJjnHDil70hiwekhBEB50NvXInmLFou-Ow'
);

/* =====================  UTILIDADES  ===================== */
let avisoTimer = null;
function exibirAviso(txt) {
  const el = document.getElementById("aviso");
  el.textContent = txt;
  el.style.display = "block";
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => {
    el.style.display = "none";
  }, 8000);
}

/* =====================  CARREGA E RENDERIZA  ===================== */
async function carregarTarefas() {
  try {
    const { data: tarefas, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const colunas = {
      urgente: "ASD",
      nao_iniciado: "Não Iniciado",
      em_andamento: "Em Andamento",
      com_data: "Com Data",
    };

    const kanban = document.getElementById("kanban");
    kanban.innerHTML = "";

    Object.entries(colunas).forEach(([key, label]) => {
      const col = document.createElement("div");
      col.className = "column";
      col.innerHTML = `<h2>${label}</h2>`;

      tarefas.filter(t => t.status === key).forEach(t => {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <div class="title">${t.task}</div>
          <div class="tags">${(t.tags || "").split(";").map(tag => `<span class="tag">${tag}</span>`).join("")}</div>
          ${t.data_limite ? `<div class="date">Prazo: ${t.data_limite}</div>` : ""}
          ${t.responsavel ? `<div class="date">Resp: ${t.responsavel}</div>` : ""}
        `;
        col.appendChild(card);
      });

      kanban.appendChild(col);
    });

  } catch (err) {
    console.error("Erro ao carregar tarefas do Supabase:", err.message);
  }
}

/* =====================  NOVA TAREFA ===================== */
document.getElementById("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const nova = {
    task: f.titulo.value,
    status: f.status.value,
    tags: f.tags.value,
    data_limite: f.data_limite.value,
    responsavel: f.responsavel.value,
    user_id: '00000000-0000-0000-0000-000000000000'
  };
  try {
    const { error } = await supabase.from('todos').insert([nova]);
    if (error) throw error;
    f.reset();
    exibirAviso("Tarefa salva com sucesso!");
    carregarTarefas();
  } catch (err) {
    console.error("Erro ao salvar tarefa:", err.message);
    alert("Erro ao salvar tarefa.");
  }
});

/* =====================  INICIALIZA  ===================== */
carregarTarefas();
