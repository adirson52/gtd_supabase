// Supabase client initialization (substitua pelas credenciais do seu projeto Supabase)
const supabaseUrl = 'https://pgbwgsmkngvhygwdjqng.supabase.co'';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnYndnc21rbmd2aHlnd2RqcW5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NDgyNzYsImV4cCI6MjA2MDUyNDI3Nn0.l08904UwxzJjnHDil70hiwekhBEB50NvXInmLFou-Ow';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// DOM elements for overlay and modals
const overlay = document.getElementById('overlay');
const viewModal = document.getElementById('modal-view');
const editModal = document.getElementById('modal-edit');
const deleteModal = document.getElementById('modal-delete');
const concludedModal = document.getElementById('modal-concluidas');

// Buttons or elements that open modals
const viewConcludedBtn = document.getElementById('ver-concluidas'); // botão "Ver Concluídas"

// Map columns for tasks by status
const columns = {
    'nao_iniciado': document.getElementById('list-nao-iniciado'),
    'em_andamento': document.getElementById('list-em-andamento'),
    'com_data': document.getElementById('list-com-data'),
    'concluido': document.getElementById('list-concluido')
};

// Global state
let tasks = [];            // lista de tarefas atuais (não concluídas)
let currentTaskId = null;  // ID da tarefa atualmente em edição/visualização (se houver)

// Utility: open modal (accepts element or selector string)
function openModal(box, overlay) {
    let modalElement;
    if (typeof box === 'string') {
        // If a selector string is provided, find the element
        if (box.startsWith('#') || box.startsWith('.')) {
            modalElement = document.querySelector(box);
        } else {
            modalElement = document.getElementById(box);
        }
    } else {
        modalElement = box;
    }
    if (!modalElement) {
        console.error('Modal not found:', box);
        return;
    }
    modalElement.classList.add('active');
    overlay.classList.add('active');
}

// Utility: close modal (closes specified modal or all active modals if none specified)
function closeModal(box, overlay) {
    if (box) {
        let modalElement;
        if (typeof box === 'string') {
            if (box.startsWith('#') || box.startsWith('.')) {
                modalElement = document.querySelector(box);
            } else {
                modalElement = document.getElementById(box);
            }
        } else {
            modalElement = box;
        }
        if (modalElement) modalElement.classList.remove('active');
    } else {
        // No specific modal provided: close any open modals
        document.querySelectorAll('.modal.active').forEach(modal => modal.classList.remove('active'));
    }
    overlay.classList.remove('active');
}

// Event listeners for closing modals via overlay click or ESC key
overlay.addEventListener('click', () => {
    closeModal(null, overlay);
    currentTaskId = null;
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal(null, overlay);
        currentTaskId = null;
    }
});

// Initialize tasks from Supabase (excluding concluded tasks)
async function loadTasks() {
    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .neq('status', 'concluido');
    if (error) {
        console.error('Erro ao carregar tarefas:', error);
        return;
    }
    tasks = data || [];
    // Clear existing tasks in each column
    for (const status in columns) {
        columns[status].innerHTML = '';
    }
    // Create and append a card for each task
    tasks.forEach(task => {
        const card = createTaskCard(task);
        columns[task.status]?.appendChild(card);
    });
}

// Create a DOM card element for a task
function createTaskCard(task) {
    const card = document.createElement('div');
    card.classList.add('card');
    card.setAttribute('draggable', 'true');
    card.id = 'task-' + task.id;
    // Card content (title, etc.)
    const titleEl = document.createElement('p');
    titleEl.classList.add('card-title');
    titleEl.textContent = task.title;
    card.appendChild(titleEl);
    // Drag events for the card
    card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', task.id);
    });
    // Double-click to open view modal for this task
    card.addEventListener('dblclick', () => {
        openTaskView(task.id);
    });
    return card;
}

// Open the view/details modal for a task
function openTaskView(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    currentTaskId = taskId;
    // Populate view modal fields
    const viewTitle = viewModal.querySelector('.view-title');
    const viewDescription = viewModal.querySelector('.view-description');
    const viewStatus = viewModal.querySelector('.view-status');
    const viewTime = viewModal.querySelector('.view-time');
    const viewPriority = viewModal.querySelector('.view-priority');
    const viewCategory = viewModal.querySelector('.view-category');
    if (viewTitle) viewTitle.textContent = task.title;
    if (viewDescription) {
        // If description supports markdown formatting, parse/format here as needed
        viewDescription.innerHTML = task.description || '';
    }
    if (viewStatus) viewStatus.textContent = task.status;
    if (viewTime) viewTime.textContent = task.time_est || '';
    if (viewPriority) viewPriority.textContent = task.priority || '';
    if (viewCategory) viewCategory.textContent = task.category || '';
    openModal(viewModal, overlay);
}

// If view modal has an Edit button, link it to open edit modal
const viewEditBtn = viewModal.querySelector('.edit-btn');
if (viewEditBtn) {
    viewEditBtn.addEventListener('click', () => {
        closeModal(viewModal, overlay);
        if (currentTaskId != null) {
            openTaskEdit(currentTaskId);
        }
    });
}

// Open the edit modal for a task (populate form fields)
function openTaskEdit(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    currentTaskId = taskId;
    // Populate edit form fields
    const editTitle = editModal.querySelector('input[name="title"]');
    const editDescription = editModal.querySelector('textarea[name="description"]');
    const editStatus = editModal.querySelector('select[name="status"]');
    const editTime = editModal.querySelector('input[name="time_est"]');
    const editPriority = editModal.querySelector('select[name="priority"]');
    const editCategory = editModal.querySelector('select[name="category"]');
    if (editTitle) editTitle.value = task.title;
    if (editDescription) editDescription.value = task.description || '';
    if (editStatus) editStatus.value = task.status;
    if (editTime) editTime.value = task.time_est || '';
    if (editPriority) editPriority.value = task.priority || '';
    if (editCategory) editCategory.value = task.category || '';
    openModal(editModal, overlay);
}

// Handle edit form submission (update task)
const editForm = editModal.querySelector('form');
if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (currentTaskId == null) return;
        // Gather updated values
        const updatedTask = {};
        const titleInput = editForm.querySelector('input[name="title"]');
        const descInput = editForm.querySelector('textarea[name="description"]');
        const statusInput = editForm.querySelector('select[name="status"]');
        const timeInput = editForm.querySelector('input[name="time_est"]');
        const priorityInput = editForm.querySelector('select[name="priority"]');
        const categoryInput = editForm.querySelector('select[name="category"]');
        if (titleInput) updatedTask.title = titleInput.value;
        if (descInput) updatedTask.description = descInput.value;
        updatedTask.status = statusInput ? statusInput.value : undefined;
        if (timeInput) updatedTask.time_est = timeInput.value;
        if (priorityInput) updatedTask.priority = priorityInput.value;
        if (categoryInput) updatedTask.category = categoryInput.value;
        const newStatus = updatedTask.status;
        const oldTask = tasks.find(t => t.id === currentTaskId);
        const oldStatus = oldTask ? oldTask.status : null;
        let movedToConcluded = (newStatus === 'concluido');
        // Update database
        let updateError = null;
        if (!movedToConcluded) {
            // Just update in tasks table
            const { error } = await supabase.from('tasks').update(updatedTask).eq('id', currentTaskId);
            updateError = error;
        } else {
            // Insert into concluded table if concluded
            const { error: insertError } = await supabase.from('concluded').insert({
                title: updatedTask.title,
                description: updatedTask.description,
                status: 'concluido',
                time_est: updatedTask.time_est,
                priority: updatedTask.priority,
                category: updatedTask.category
            });
            if (insertError) {
                console.error('Erro ao inserir tarefa concluída:', insertError);
            }
            // Update the task in tasks table (mark as concluded and save other changes)
            const { error: updError } = await supabase.from('tasks').update(updatedTask).eq('id', currentTaskId);
            updateError = updError;
        }
        if (updateError) {
            console.error('Erro ao atualizar tarefa:', updateError);
        } else {
            if (oldTask) {
                if (movedToConcluded) {
                    // Remove concluded task from active list
                    tasks = tasks.filter(t => t.id !== currentTaskId);
                    const cardEl = document.getElementById('task-' + currentTaskId);
                    if (cardEl) cardEl.remove();
                } else {
                    // Update local task object
                    Object.assign(oldTask, updatedTask);
                    // If status changed (to another active status), move card in UI
                    if (oldStatus && newStatus && oldStatus !== newStatus) {
                        const cardEl = document.getElementById('task-' + currentTaskId);
                        if (cardEl && columns[newStatus]) {
                            columns[oldStatus].removeChild(cardEl);
                            columns[newStatus].appendChild(cardEl);
                        }
                    }
                    // Update card content if needed (e.g., title change)
                    const cardEl = document.getElementById('task-' + currentTaskId);
                    if (cardEl) {
                        const titleEl = cardEl.querySelector('.card-title');
                        if (titleEl) titleEl.textContent = oldTask.title;
                    }
                }
            }
            closeModal(editModal, overlay);
            currentTaskId = null;
        }
    });
}

// Delete button in edit modal opens confirmation modal
const editDeleteBtn = editModal.querySelector('.delete-btn');
if (editDeleteBtn) {
    editDeleteBtn.addEventListener('click', () => {
        if (currentTaskId != null) {
            // (Optional: set some confirmation text using the task info if needed)
        }
        // Close edit modal and open delete confirmation modal
        closeModal(editModal, overlay);
        openModal(deleteModal, overlay);
    });
}

// Confirm deletion in confirmation modal
const confirmDeleteBtn = deleteModal.querySelector('.confirm-delete-btn');
if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
        if (currentTaskId == null) return;
        const idToDelete = currentTaskId;
        const { error } = await supabase.from('tasks').delete().eq('id', idToDelete);
        if (error) {
            console.error('Erro ao deletar tarefa:', error);
        } else {
            // Remove from local list and UI
            tasks = tasks.filter(t => t.id !== idToDelete);
            const cardEl = document.getElementById('task-' + idToDelete);
            if (cardEl) cardEl.remove();
        }
        closeModal(deleteModal, overlay);
        currentTaskId = null;
    });
}

// Cancel deletion (close confirmation modal without deleting)
const cancelDeleteBtn = deleteModal.querySelector('.cancel-delete-btn');
if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
        closeModal(deleteModal, overlay);
        currentTaskId = null;
    });
}

// Add task form submission (adicionar nova tarefa)
const addForm = document.getElementById('add-task-form');
if (addForm) {
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newTask = {};
        const titleInput = addForm.querySelector('input[name="title"]');
        const descInput = addForm.querySelector('textarea[name="description"]');
        const statusInput = addForm.querySelector('select[name="status"]');
        const timeInput = addForm.querySelector('input[name="time_est"]');
        const priorityInput = addForm.querySelector('select[name="priority"]');
        const categoryInput = addForm.querySelector('select[name="category"]');
        const respInput = addForm.querySelector('input[name="responsavel"]');
        if (titleInput) newTask.title = titleInput.value;
        if (descInput) newTask.description = descInput.value;
        newTask.status = statusInput ? statusInput.value : 'nao_iniciado';
        if (timeInput) newTask.time_est = timeInput.value;
        if (priorityInput) newTask.priority = priorityInput.value;
        if (categoryInput) newTask.category = categoryInput.value;
        if (respInput) newTask.responsavel = respInput.value;
        const { data: inserted, error: insertError } = await supabase.from('tasks')
            .insert(newTask)
            .select('*')
            .single();
        if (insertError) {
            console.error('Erro ao adicionar tarefa:', insertError);
        } else if (inserted) {
            tasks.push(inserted);
            const card = createTaskCard(inserted);
            columns[inserted.status]?.appendChild(card);
            addForm.reset();
        }
    });
}

// View concluded tasks modal (lista de concluídas)
if (viewConcludedBtn) {
    viewConcludedBtn.addEventListener('click', async () => {
        const { data: concludedTasks, error } = await supabase.from('concluded').select('*');
        if (error) {
            console.error('Erro ao buscar concluídas:', error);
            return;
        }
        const concludedList = concludedModal.querySelector('.concluded-list');
        if (concludedList) {
            concludedList.innerHTML = '';
            if (concludedTasks && concludedTasks.length > 0) {
                concludedTasks.forEach(task => {
                    const item = document.createElement('div');
                    item.classList.add('concluded-item');
                    item.innerHTML = '<strong>' + task.title + '</strong>' + (task.description ? ' - ' + task.description : '');
                    concludedList.appendChild(item);
                });
            } else {
                concludedList.textContent = 'Nenhuma tarefa concluída.';
            }
        }
        openModal(concludedModal, overlay);
    });
}

// Drag-and-drop for moving tasks between columns
for (const status in columns) {
    const col = columns[status];
    // Allow drop on column
    col.addEventListener('dragover', e => {
        e.preventDefault();
    });
    col.addEventListener('drop', async e => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        if (!id) return;
        const taskId = parseInt(id);
        const targetStatus = status;
        if (!taskId || !targetStatus) return;
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        const oldStatus = task.status;
        if (oldStatus === targetStatus) return; // no status change
        // Move card element in DOM
        const cardEl = document.getElementById('task-' + taskId);
        if (cardEl) {
            columns[oldStatus].removeChild(cardEl);
            columns[targetStatus].appendChild(cardEl);
        }
        // Update local data
        task.status = targetStatus;
        // Update in database
        if (targetStatus === 'concluido') {
            const { error: insertErr } = await supabase.from('concluded').insert({
                title: task.title,
                description: task.description,
                status: 'concluido',
                time_est: task.time_est,
                priority: task.priority,
                category: task.category
            });
            if (insertErr) {
                console.error('Erro ao inserir em concluídas:', insertErr);
            }
            const { error: updateErr } = await supabase.from('tasks').update({ status: 'concluido' }).eq('id', taskId);
            if (updateErr) {
                console.error('Erro ao atualizar tarefa:', updateErr);
            }
            // Remove from active list and UI
            tasks = tasks.filter(t => t.id !== taskId);
            if (cardEl) cardEl.remove();
        } else {
            const { error: updateErr } = await supabase.from('tasks').update({ status: targetStatus }).eq('id', taskId);
            if (updateErr) {
                console.error('Erro ao mover tarefa:', updateErr);
            }
        }
    });
}

// Load initial tasks on page load
loadTasks();

// Attach close handlers for any modal close buttons (elements with class .close-modal)
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        closeModal(modal, overlay);
        currentTaskId = null;
    });
});
