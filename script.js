/* ---------- GERAL ---------- */
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial;
  background: #f9f9f9;
  color: #222;
}
h1 {
  margin: 0;
  text-align: center;
  padding: 1rem;
  font-weight: 500;
}

/* ---------- FORMULÁRIO ---------- */
form {
  max-width: 600px;
  margin: 1rem auto;
  display: flex;
  flex-direction: column;
  gap: .5rem;
}
input, textarea, select, button {
  padding: .5rem;
  font-size: 1rem;
  border: 1px solid #ccc;
  border-radius: 6px;
}
button { cursor: pointer; }
form > * { width: 100%; }

/* ---------- BOTÃO CONCLUÍDAS ---------- */
.concluidas-wrapper {
  max-width: 600px;
  margin: 0 auto 1rem;
  padding: 0 1rem;
}
#btn-concluidas {
  display: block;
  width: 100%;
  background: #c8e6c9;
  color: #064e3b;
  border: none;
  padding: .5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0,0,0,.1);
  transition: background .2s;
}
#btn-concluidas:hover {
  background: #b4dcb5;
}

/* ---------- KANBAN ---------- */
.kanban {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  overflow-x: auto;
}
.column {
  flex: 1;
  min-width: 250px;
  background: #fff;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 2px 6px rgba(0,0,0,.1);
}
.column h2 {
  margin: 0 0 .5rem;
  font-size: 1.2rem;
  border-bottom: 1px solid #eee;
  padding-bottom: .5rem;
}
.card {
  background: #f1f1f1;
  border-radius: 8px;
  padding: .75rem .5rem .5rem .5rem;
  margin-bottom: .5rem;
  position: relative;
}
.card .title {
  font-weight: 600;
  margin-bottom: .25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 90px;
}
.card .desc,
.card .date {
  font-size: .9rem;
  color: #666;
  margin-top: .25rem;
}

/* Botões fixos no canto direito */
.move-btn,
.edit-btn {
  position: absolute;
  top: 8px;
  padding: .25rem .5rem;
  font-size: .8rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.move-btn {
  right: 50px;
  background: #bbb;
  color: #222;
}
.move-btn:active { cursor: grabbing; }
.edit-btn {
  right: 5px;
  background: #ffc107;
  color: #000;
}

/* ---------- RESPONSIVO ---------- */
@media (max-width:640px) {
  .kanban { flex-wrap: wrap; padding: .5rem; }
  .column { min-width: 100%; margin-bottom: 1rem; }
}

/* ---------- AVISO ---------- */
#aviso {
  display: none;
  text-align: center;
  padding: 1rem;
  background: #e0f7fa;
  color: #00796b;
  font-weight: 600;
  margin: 1rem auto;
  max-width: 600px;
  border-radius: 8px;
}

/* ---------- MODAIS ---------- */
.overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.4);
  z-index: 950;
}
.read-modal,
#editModal {
  display: none;
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%,-50%);
  background: #fff;
  border-radius: 24px;
  padding: 1.5rem;
  z-index: 951;
  width: 90%; max-width: 360px;
  box-shadow: 0 15px 40px rgba(0,0,0,.25);
}
.read-modal h3,
#editModal h3 {
  margin: 0 0 .75rem;
  font-size: 1.4rem;
  font-weight: 600;
}
.read-desc { margin: .25rem 0 1rem; color: #444; line-height: 1.4; }
.read-date { font-size: .8rem; color: #666; margin: .1rem 0; }
.read-close {
  margin-top: 1rem;
  width: 100%;
  padding: .6rem 0;
  background: #007aff;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-weight: 600;
}

/* ---------- TABELA DE CONCLUÍDAS ---------- */
#table-concluidas {
  width: 100%;
  border-collapse: collapse;
  font-family: monospace;
}
#table-concluidas th,
#table-concluidas td {
  border: 1px solid #bbb;
  padding: 6px 8px;
  text-align: left;
}
#table-concluidas thead { background: #ddd; font-weight: bold; }
#table-concluidas tbody tr:nth-child(even) { background: #f5f5f5; }

/* Botão Excluir no modal de edição */
#btn-excluir-modal {
  display: block;
  margin-top: 1rem;
  width: 100%;
  padding: .6rem 0;
  background: #d32f2f;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
}
#btn-excluir-modal:hover { background: #b71c1c; }
