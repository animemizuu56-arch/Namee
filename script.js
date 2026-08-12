    // ============ STATE ============
let state = {
  user: {
    name: 'Guest User',
    username: 'guest',
    bio: 'Welcome to Lumi! Edit your profile to get started.',
    avatar: 'https://ui-avatars.com/api/?name=Guest+User&background=7c5cff&color=fff&size=200',
    level: 1,
    streak: 0,
    score: 0
  },
  tasks: [],
  theme: 'light',
  currentPage: 'home',
  editingTaskId: null,
  currentTaskId: null,
  calendarDate: new Date(),
  selectedDate: new Date(),
  homeFilter: 'all',
  taskFilter: 'all',
  sortMode: 'date',
  checklistDraft: [],
  priorityDraft: 'low'
};

const STORAGE_KEY = 'lumi_app_final_v2'; // Updated key to reset old cache

// ============ NATIVE / UTILITY FUNCTIONS ============
// Prevent zoom on double tap
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = (new Date()).getTime();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, false);

// Haptic Feedback
function hapticFeedback(duration = 10) {
  if (navigator.vibrate) {
    navigator.vibrate(duration);
  }
}

// ============ STORAGE ============
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      state = { ...state, ...parsed };
    } else {
      saveState();
    }
  } catch(e) {}
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      user: state.user,
      tasks: state.tasks,
      theme: state.theme
    }));
  } catch(e) {}
}

// ============ NAVIGATION ============
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-item[data-nav="${page}"]`);
  if (navBtn) navBtn.classList.add('active');
  
  state.currentPage = page;
  
  if (page === 'home') renderHome();
  if (page === 'tasks') renderTasks();
  if (page === 'calendar') renderCalendar();
  if (page === 'profile') renderProfile();
  if (page === 'settings') renderSettings();
  
  const scroll = target?.querySelector('.page-scroll');
  if (scroll) scroll.scrollTop = 0;
}

// ============ HOME ============
function renderHome() {
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  document.getElementById('greetingHello').textContent = hello;
  document.getElementById('greetingName').textContent = state.user.name;
  document.getElementById('homeAvatar').src = state.user.avatar;
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTasks = state.tasks.filter(t => t.deadline === todayStr);
  const doneToday = todayTasks.filter(t => t.completed).length;
  const totalToday = todayTasks.length;
  const progressPct = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;
  
  document.getElementById('heroProgressValue').textContent = progressPct + '%';
  const ring = document.getElementById('heroRingFill');
  const circumference = 2 * Math.PI * 42;
  ring.style.strokeDashoffset = circumference - (circumference * progressPct / 100);
  
  document.getElementById('qsTotal').textContent = state.tasks.length;
  document.getElementById('qsDone').textContent = state.tasks.filter(t => t.completed).length;
  document.getElementById('qsStreak').textContent = state.user.streak;
  
  renderHomeTasks();
}

function renderHomeTasks() {
  const list = document.getElementById('homeTaskList');
  const filtered = filterTasks(state.tasks, state.homeFilter).slice(0, 5);
  
  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding:30px 20px;">
      <div class="empty-icon"><i class="fa-regular fa-folder-open"></i></div>
      <div class="empty-title">No tasks</div>
      <div class="empty-subtitle">Create a task to get started</div>
    </div>`;
    return;
  }
  
  list.innerHTML = filtered.map((t, i) => taskCardHTML(t, i)).join('');
  attachSwipeGestures();
}

// ============ TASKS ============
function renderTasks() {
  const list = document.getElementById('taskList');
  const filtered = sortTasks(filterTasks(state.tasks, state.taskFilter));
  const empty = document.getElementById('taskEmpty');
  
  if (filtered.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    // Grouping Logic
    const groups = { overdue: [], today: [], upcoming: [], later: [] };
    const todayStr = new Date().toISOString().split('T')[0];
    
    filtered.forEach(t => {
      if (t.deadline < todayStr && !t.completed) groups.overdue.push(t);
      else if (t.deadline === todayStr) groups.today.push(t);
      else if (t.deadline > todayStr) groups.upcoming.push(t);
      else groups.later.push(t); // Fallback for completed without date match
    });

    let html = '';
    if (groups.overdue.length > 0) {
      html += `<div class="task-group-title" style="color:var(--red);">Overdue</div>`;
      html += groups.overdue.map((t, i) => taskCardHTML(t, i)).join('');
    }
    if (groups.today.length > 0) {
      html += `<div class="task-group-title">Today</div>`;
      html += groups.today.map((t, i) => taskCardHTML(t, i)).join('');
    }
    if (groups.upcoming.length > 0) {
      html += `<div class="task-group-title">Upcoming</div>`;
      html += groups.upcoming.map((t, i) => taskCardHTML(t, i)).join('');
    }
    
    list.innerHTML = html;
    attachSwipeGestures();
  }
}

function taskCardHTML(task, index) {
  const date = new Date(task.deadline);
  const today = new Date(); today.setHours(0,0,0,0);
  const diffDays = Math.round((date - today) / 86400000);
  
  let dateLabel = '';
  if (diffDays === 0) dateLabel = 'Today';
  else if (diffDays === 1) dateLabel = 'Tomorrow';
  else if (diffDays === -1) dateLabel = 'Yesterday';
  else if (diffDays < 0) dateLabel = `${Math.abs(diffDays)}d overdue`;
  else dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
  const priorityLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
  
  return `
    <div class="swipe-wrapper">
      <div class="swipe-bg left"><i class="fa-solid fa-check"></i> Complete</div>
      <div class="swipe-bg right"><i class="fa-solid fa-trash"></i> Delete</div>
      <div class="task-card priority-${task.priority} ${task.completed ? 'completed' : ''}" 
           data-id="${task.id}" style="animation-delay:${index * 0.05}s">
        <div class="tc-top">
          <div class="tc-left">
            <div class="tc-icon cat-${task.category}"><i class="fa-solid ${categoryIcon(task.category)}"></i></div>
            <div class="tc-title-wrap">
              <div class="tc-title">${escapeHTML(task.title)}</div>
              <div class="tc-cat">${task.category} • ${priorityLabel} Priority</div>
            </div>
          </div>
          <button class="tc-check" onclick="event.stopPropagation(); toggleComplete('${task.id}')">
            <i class="fa-solid fa-check"></i>
          </button>
        </div>
        <div class="tc-progress-wrap">
          <div class="tc-progress-info">
            <span class="tc-progress-label">Progress</span>
            <span class="tc-progress-value">${task.progress}%</span>
          </div>
          <div class="tc-progress-bar">
            <div class="tc-progress-fill" style="width:${task.progress}%"></div>
          </div>
        </div>
        <div class="tc-bottom">
          <div class="tc-meta">
            <div class="tc-meta-item"><i class="fa-regular fa-clock"></i> ${dateLabel}</div>
            ${task.checklist.length > 0 ? `<div class="tc-meta-item"><i class="fa-solid fa-list-check"></i> ${task.checklist.filter(c=>c.done).length}/${task.checklist.length}</div>` : ''}
            ${task.comments.length > 0 ? `<div class="tc-meta-item"><i class="fa-regular fa-comment"></i> ${task.comments.length}</div>` : ''}
          </div>
          <div class="tc-members">
            ${task.members.slice(0, 3).map(m => `<div class="tc-member">${m}</div>`).join('')}
            ${task.members.length > 3 ? `<div class="tc-member">+${task.members.length - 3}</div>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============ SWIPE GESTURE LOGIC ============
function attachSwipeGestures() {
  document.querySelectorAll('.swipe-wrapper').forEach(wrapper => {
    const card = wrapper.querySelector('.task-card');
    let startX = 0, currentX = 0, isDragging = false;

    card.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      isDragging = true;
      card.style.transition = 'none';
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentX = e.touches[0].clientX - startX;
      if (Math.abs(currentX) > 10) {
        // Prevent vertical scroll while swiping horizontally
        e.preventDefault(); 
      }
      if (currentX > 0) {
        card.style.transform = `translateX(${Math.min(currentX, 100)}px)`;
        card.style.background = 'var(--green)';
      } else {
        card.style.transform = `translateX(${Math.max(currentX, -100)}px)`;
        card.style.background = 'var(--red)';
      }
    }, { passive: false });

    card.addEventListener('touchend', () => {
      isDragging = false;
      card.style.transition = 'transform 0.3s ease, background 0.3s ease';
      
      if (currentX > 80) {
        // Swipe Right -> Complete
        hapticFeedback(20);
        card.style.transform = 'translateX(100%)';
        setTimeout(() => {
          toggleComplete(card.dataset.id);
        }, 300);
      } else if (currentX < -80) {
        // Swipe Left -> Delete
        hapticFeedback([20, 40, 20]);
        card.style.transform = 'translateX(-100%)';
        setTimeout(() => {
          state.tasks = state.tasks.filter(t => t.id !== card.dataset.id);
          saveState();
          showToast('Task deleted via swipe', 'fa-trash');
          refreshCurrentView();
        }, 300);
      } else {
        // Snap back
        card.style.transform = 'translateX(0)';
        card.style.background = '';
      }
      currentX = 0;
    });
  });
}

function categoryIcon(cat) {
  const icons = {
    'Work': 'fa-briefcase',
    'Design': 'fa-pen-ruler',
    'Personal': 'fa-heart',
    'Study': 'fa-book',
    'Health': 'fa-heart-pulse'
  };
  return icons[cat] || 'fa-list';
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============ FILTERS ============
function filterTasks(tasks, filter) {
  const todayStr = new Date().toISOString().split('T')[0];
  switch(filter) {
    case 'today': return tasks.filter(t => t.deadline === todayStr);
    case 'upcoming': return tasks.filter(t => t.deadline > todayStr && !t.completed);
    case 'completed': return tasks.filter(t => t.completed);
    case 'priority': return tasks.filter(t => t.priority === 'high' && !t.completed);
    case 'low': return tasks.filter(t => t.priority === 'low');
    default: return tasks;
  }
}

function sortTasks(tasks) {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (state.sortMode === 'priority') {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return new Date(a.deadline) - new Date(b.deadline);
  });
}

function toggleSortMenu() {
  state.sortMode = state.sortMode === 'date' ? 'priority' : 'date';
  showToast(`Sorted by ${state.sortMode === 'date' ? 'date' : 'priority'}`, 'fa-arrow-down-wide-short');
  hapticFeedback(10);
  renderTasks();
}

// ============ TASK DETAIL ============
function openDetail(taskId) {
  state.currentTaskId = taskId;
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  const date = new Date(task.deadline);
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const priorityClass = task.priority;
  const priorityLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
  
  const checklistHTML = task.checklist.length > 0 
    ? task.checklist.map((c, i) => `
        <div class="checklist-item ${c.done ? 'done' : ''}" onclick="toggleChecklist('${taskId}', ${i})">
          <div class="ci-checkbox"><i class="fa-solid fa-check"></i></div>
          <div class="ci-text">${escapeHTML(c.text)}</div>
        </div>
      `).join('')
    : '<div style="font-size:13px;color:var(--text-muted);padding:8px 0;">No checklist items</div>';
  
  const membersHTML = task.members.map(m => `
    <div class="detail-member">
      <div class="dm-avatar">${m.charAt(0)}</div>
      <span class="dm-name">${m}</span>
    </div>
  `).join('');
  
  const commentsHTML = task.comments.length > 0
    ? task.comments.map(c => `
        <div class="comment-item">
          <div class="comment-avatar">${c.author.charAt(0)}</div>
          <div class="comment-body">
            <div class="comment-author">${escapeHTML(c.author)}</div>
            <div class="comment-text">${escapeHTML(c.text)}</div>
          </div>
        </div>
      `).join('')
    : '<div style="font-size:13px;color:var(--text-muted);padding:8px 0;">No comments yet</div>';
  
  document.getElementById('detailContent').innerHTML = `
    <div class="detail-hero">
      <div class="detail-cat-row">
        <span class="detail-cat-badge">${task.category}</span>
        <span class="detail-priority-badge ${priorityClass}">
          <span class="pp-dot pp-${task.priority}"></span>${priorityLabel} Priority
        </span>
      </div>
      <h1 class="detail-title">${escapeHTML(task.title)}</h1>
      <p class="detail-desc">${escapeHTML(task.description) || 'No description'}</p>
    </div>
    
    <div class="detail-section">
      <div class="detail-section-title">Progress</div>
      <div class="detail-progress">
        <div class="detail-progress-bar">
          <div class="detail-progress-fill" style="width:${task.progress}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);">
          <span>${task.progress}% complete</span>
          <span>${task.completed ? 'Completed' : 'In progress'}</span>
        </div>
      </div>
    </div>
    
    <div class="detail-section">
      <div class="detail-section-title">Information</div>
      <div class="detail-info-grid">
        <div class="info-item">
          <div class="info-label">Deadline</div>
          <div class="info-value"><i class="fa-regular fa-calendar" style="color:var(--purple);font-size:12px;"></i> ${dateStr}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Status</div>
          <div class="info-value"><i class="fa-solid ${task.completed ? 'fa-circle-check' : 'fa-circle-half-stroke'}" style="color:${task.completed ? 'var(--green)' : 'var(--yellow-deep)'};font-size:12px;"></i> ${task.completed ? 'Done' : 'Active'}</div>
        </div>
      </div>
    </div>
    
    <div class="detail-section">
      <div class="detail-section-title">Checklist</div>
      ${checklistHTML}
    </div>
    
    <div class="detail-section">
      <div class="detail-section-title">Members</div>
      <div class="detail-members">${membersHTML}</div>
    </div>
    
    <div class="detail-section">
      <div class="detail-section-title">Comments</div>
      ${commentsHTML}
    </div>
    
    <div class="detail-actions">
      <button class="btn-secondary" onclick="deleteCurrentTask()"><i class="fa-solid fa-trash"></i> Delete</button>
      <button class="btn-primary" onclick="toggleComplete('${taskId}'); openDetail('${taskId}')">
        <i class="fa-solid ${task.completed ? 'fa-rotate-left' : 'fa-check'}"></i> ${task.completed ? 'Mark Active' : 'Mark Complete'}
      </button>
    </div>
    <div class="bottom-spacer"></div>
  `;
  
  navigate('detail');
}

function closeDetail() {
  navigate(state.currentPage === 'detail' ? 'home' : state.currentPage);
  if (state.currentPage === 'detail') navigate('home');
}

function toggleComplete(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.completed = !task.completed;
  task.progress = task.completed ? 100 : (task.progress === 100 ? 80 : task.progress);
  saveState();
  hapticFeedback(15);
  showToast(task.completed ? 'Task completed! 🎉' : 'Task marked active', task.completed ? 'fa-circle-check' : 'fa-rotate-left');
  refreshCurrentView();
}

function toggleChecklist(taskId, idx) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.checklist[idx]) return;
  task.checklist[idx].done = !task.checklist[idx].done;
  hapticFeedback(10);
  
  if (task.checklist.length > 0) {
    const doneCount = task.checklist.filter(c => c.done).length;
    task.progress = Math.round((doneCount / task.checklist.length) * 100);
    task.completed = task.progress === 100;
  }
  saveState();
  openDetail(taskId);
}

function editCurrentTask() {
  if (state.currentTaskId) openCreateTask(state.currentTaskId);
}

function deleteCurrentTask() {
  if (!state.currentTaskId) return;
  showConfirm('Delete Task?', 'This task will be permanently removed.', 'Delete', () => {
    state.tasks = state.tasks.filter(t => t.id !== state.currentTaskId);
    saveState();
    hapticFeedback([10, 30, 10]);
    showToast('Task deleted', 'fa-trash');
    navigate('home');
    refreshCurrentView();
  });
}

// ============ CREATE / EDIT TASK ============
function openCreateTask(taskId = null) {
  state.editingTaskId = taskId;
  const isEdit = taskId !== null;
  
  document.getElementById('sheetTitle').textContent = isEdit ? 'Edit Task' : 'Create Task';
  document.getElementById('saveTaskBtn').textContent = isEdit ? 'Save Changes' : 'Create Task';
  
  if (isEdit) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    document.getElementById('taskTitle').value = task.title;
    document.getElementById('taskDesc').value = task.description;
    document.getElementById('taskDeadline').value = task.deadline;
    document.getElementById('taskCategory').value = task.category;
    document.getElementById('taskProgress').value = task.progress;
    document.getElementById('progressValue').textContent = task.progress;
    state.priorityDraft = task.priority;
    state.checklistDraft = task.checklist.map(c => ({...c}));
  } else {
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDesc').value = '';
    document.getElementById('taskDeadline').value = new Date().toISOString().split('T')[0];
    document.getElementById('taskCategory').value = 'Work';
    document.getElementById('taskProgress').value = 0;
    document.getElementById('progressValue').textContent = '0';
    state.priorityDraft = 'low';
    state.checklistDraft = [];
  }
  
  document.querySelectorAll('.pp-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.p === state.priorityDraft);
  });
  
  renderChecklistEditor();
  document.getElementById('taskSheetOverlay').classList.add('active');
}

function closeCreateTask() {
  document.getElementById('taskSheetOverlay').classList.remove('active');
  state.editingTaskId = null;
}

function renderChecklistEditor() {
  const container = document.getElementById('checklistEditor');
  if (state.checklistDraft.length === 0) {
    container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">No checklist items yet</div>';
    return;
  }
  container.innerHTML = state.checklistDraft.map((item, i) => `
    <div class="ce-item">
      <input type="text" value="${escapeHTML(item.text)}" oninput="updateChecklistItem(${i}, this.value)" placeholder="Checklist item">
      <button class="ce-remove" onclick="removeChecklistItem(${i})"><i class="fa-solid fa-xmark"></i></button>
    </div>
  `).join('');
}

function addChecklistItem() {
  state.checklistDraft.push({ text: 'New item', done: false });
  renderChecklistEditor();
}

function updateChecklistItem(i, val) {
  if (state.checklistDraft[i]) state.checklistDraft[i].text = val;
}

function removeChecklistItem(i) {
  state.checklistDraft.splice(i, 1);
  renderChecklistEditor();
}

function saveTask() {
  const title = document.getElementById('taskTitle').value.trim();
  if (!title) {
    showToast('Please enter a task title', 'fa-circle-exclamation');
    return;
  }
  
  const taskData = {
    title,
    description: document.getElementById('taskDesc').value.trim(),
    category: document.getElementById('taskCategory').value,
    priority: state.priorityDraft,
    deadline: document.getElementById('taskDeadline').value || new Date().toISOString().split('T')[0],
    progress: parseInt(document.getElementById('taskProgress').value) || 0,
    checklist: state.checklistDraft.map(c => ({...c}))
  };
  
  if (state.editingTaskId) {
    const task = state.tasks.find(t => t.id === state.editingTaskId);
    if (task) {
      Object.assign(task, taskData);
      task.completed = task.progress === 100;
    }
    showToast('Task updated', 'fa-circle-check');
  } else {
    const newTask = {
      id: 't' + Date.now(),
      ...taskData,
      completed: taskData.progress === 100,
      members: ['ME'],
      comments: [],
      createdAt: Date.now()
    };
    state.tasks.unshift(newTask);
    showToast('Task created', 'fa-circle-check');
  }
  
  hapticFeedback(15);
  saveState();
  closeCreateTask();
  refreshCurrentView();
}

document.querySelectorAll('.pp-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pp-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.priorityDraft = btn.dataset.p;
    hapticFeedback(10);
  });
});

// ============ CALENDAR ============
function renderCalendar() {
  const date = state.calendarDate;
  const year = date.getFullYear();
  const month = date.getMonth();
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  document.getElementById('calMonth').textContent = monthNames[month] + ' ' + year;
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const selectedStr = state.selectedDate.toISOString().split('T')[0];
  
  const taskDates = {};
  state.tasks.forEach(t => {
    if (!taskDates[t.deadline]) taskDates[t.deadline] = 0;
    taskDates[t.deadline]++;
  });
  
  let html = '';
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-day empty"></div>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const classes = ['cal-day'];
    if (dateStr === todayStr) classes.push('today');
    if (dateStr === selectedStr) classes.push('selected');
    if (taskDates[dateStr]) classes.push('has-task');
    html += `<div class="${classes.join(' ')}" onclick="selectDate('${dateStr}')">${d}</div>`;
  }
  document.getElementById('calGrid').innerHTML = html;
  
  renderAgenda();
}

function selectDate(dateStr) {
  state.selectedDate = new Date(dateStr);
  hapticFeedback(10);
  renderCalendar();
}

function prevMonth() {
  state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
  renderCalendar();
}

function nextMonth() {
  state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
  renderCalendar();
}

function renderAgenda() {
  const dateStr = state.selectedDate.toISOString().split('T')[0];
  const dayTasks = state.tasks.filter(t => t.deadline === dateStr);
  const list = document.getElementById('agendaList');
  const empty = document.getElementById('agendaEmpty');
  
  const dateLabel = state.selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('agendaTitle').textContent = dateLabel;
  document.getElementById('agendaCount').textContent = dayTasks.length;
  
  if (dayTasks.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    list.innerHTML = dayTasks.map((t, i) => taskCardHTML(t, i)).join('');
    attachSwipeGestures();
  }
}

// ============ PROFILE ============
function renderProfile() {
  document.getElementById('profileAvatar').src = state.user.avatar;
  document.getElementById('profileName').textContent = state.user.name;
  document.getElementById('profileUsername').textContent = '@' + state.user.username;
  document.getElementById('profileBio').textContent = state.user.bio;
  
  document.getElementById('psLevel').textContent = state.user.level;
  document.getElementById('psDone').textContent = state.tasks.filter(t => t.completed).length;
  document.getElementById('psScore').textContent = state.user.score;
  document.getElementById('psStreak').textContent = state.user.streak;
}

function openEditProfile() {
  document.getElementById('editAvatarPreview').src = state.user.avatar;
  document.getElementById('editName').value = state.user.name;
  document.getElementById('editUsername').value = state.user.username;
  document.getElementById('editBio').value = state.user.bio;
  document.getElementById('profileSheetOverlay').classList.add('active');
}

function closeEditProfile() {
  document.getElementById('profileSheetOverlay').classList.remove('active');
}

function saveProfile() {
  state.user.name = document.getElementById('editName').value.trim() || 'User';
  state.user.username = document.getElementById('editUsername').value.trim().replace(/\s/g, '') || 'user';
  state.user.bio = document.getElementById('editBio').value.trim() || 'No bio yet';
  if (state.user.name !== 'Guest User' && state.user.avatar.includes('ui-avatars.com')) {
    state.user.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(state.user.name)}&background=7c5cff&color=fff&size=200`;
  }
  saveState();
  closeEditProfile();
  renderProfile();
  hapticFeedback(15);
  showToast('Profile updated', 'fa-circle-check');
}

function changeAvatar() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      state.user.avatar = ev.target.result;
      document.getElementById('editAvatarPreview').src = state.user.avatar;
      saveState();
      renderProfile();
      hapticFeedback(15);
      showToast('Photo updated', 'fa-camera');
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// ============ SETTINGS ============
function renderSettings() {
  document.getElementById('darkToggle').checked = state.theme === 'dark';
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', state.theme);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', state.theme === 'dark' ? '#14101f' : '#faf7ff');
  saveState();
  renderSettings();
  hapticFeedback(15);
  showToast(`${state.theme === 'dark' ? 'Dark' : 'Light'} mode on`, state.theme === 'dark' ? 'fa-moon' : 'fa-sun');
}

let accentIndex = 0;
const accents = [
  { name: 'Lavender', color: '#7c5cff' },
  { name: 'Cyan', color: '#5fb8d4' },
  { name: 'Pink', color: '#d54f8a' },
  { name: 'Yellow', color: '#f0b94e' }
];
function cycleAccent() {
  accentIndex = (accentIndex + 1) % accents.length;
  const accent = accents[accentIndex];
  document.documentElement.style.setProperty('--purple', accent.color);
  document.documentElement.style.setProperty('--purple-dark', accent.color);
  document.getElementById('accentName').textContent = accent.name;
  document.getElementById('accentPreview').style.background = accent.color;
  hapticFeedback(10);
  showToast(`Accent: ${accent.name}`, 'fa-palette');
}

function exportData() {
  const data = JSON.stringify({ user: state.user, tasks: state.tasks }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lumi-data.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported', 'fa-download');
}

function resetData() {
  showConfirm('Reset All Data?', 'All your tasks and profile will be reset to default. This cannot be undone.', 'Reset', () => {
    localStorage.removeItem(STORAGE_KEY);
    state.user = {
      name: 'Guest User',
      username: 'guest',
      bio: 'Welcome to Lumi! Edit your profile to get started.',
      avatar: 'https://ui-avatars.com/api/?name=Guest+User&background=7c5cff&color=fff&size=200',
      level: 1,
      streak: 0,
      score: 0
    };
    state.tasks = [];
    saveState();
    showToast('Data reset', 'fa-rotate');
    navigate('home');
    renderHome();
  });
}

function showAbout() {
  showToast('Lumi v2.0.0 — Premium Productivity', 'fa-sparkles');
}

// ============ SEARCH ============
function openSearch() {
  document.getElementById('searchOverlay').classList.add('active');
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML = `
    <div class="empty-state" style="padding:40px 20px;">
      <div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
      <div class="empty-title">Search anything</div>
      <div class="empty-subtitle">Find your tasks, projects, and more</div>
    </div>`;
  setTimeout(() => document.getElementById('searchInput').focus(), 300);
}

function closeSearch() {
  document.getElementById('searchOverlay').classList.remove('active');
}

function performSearch() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const results = document.getElementById('searchResults');
  
  if (!q) {
    results.innerHTML = `
      <div class="empty-state" style="padding:40px 20px;">
        <div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
        <div class="empty-title">Search anything</div>
        <div class="empty-subtitle">Find your tasks, projects, and more</div>
      </div>`;
    return;
  }
  
  const matches = state.tasks.filter(t => 
    t.title.toLowerCase().includes(q) || 
    t.description.toLowerCase().includes(q) ||
    t.category.toLowerCase().includes(q)
  );
  
  if (matches.length === 0) {
    results.innerHTML = `
      <div class="empty-state" style="padding:40px 20px;">
        <div class="empty-icon"><i class="fa-regular fa-face-frown"></i></div>
        <div class="empty-title">No results</div>
        <div class="empty-subtitle">Try a different keyword</div>
      </div>`;
    return;
  }
  
  results.innerHTML = matches.map(t => `
    <div class="search-result-item" onclick="closeSearch(); openDetail('${t.id}')">
      <div class="sri-icon"><i class="fa-solid ${categoryIcon(t.category)}"></i></div>
      <div class="sri-text">
        <div class="sri-title">${escapeHTML(t.title)}</div>
        <div class="sri-sub">${t.category} • ${t.priority} priority</div>
      </div>
    </div>
  `).join('');
}

// ============ FILTER PILLS ============
document.querySelectorAll('#homeFilters .pill').forEach(p => {
  p.addEventListener('click', () => {
    document.querySelectorAll('#homeFilters .pill').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    state.homeFilter = p.dataset.filter;
    hapticFeedback(10);
    renderHomeTasks();
  });
});

document.querySelectorAll('#taskFilters .pill').forEach(p => {
  p.addEventListener('click', () => {
    document.querySelectorAll('#taskFilters .pill').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    state.taskFilter = p.dataset.filter;
    hapticFeedback(10);
    renderTasks();
  });
});

// ============ TOAST ============
function showToast(message, icon = 'fa-circle-check') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ============ CONFIRM ============
function showConfirm(title, message, okText, onOk) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  const btn = document.getElementById('confirmOkBtn');
  btn.textContent = okText;
  btn.onclick = () => {
    closeConfirm();
    onOk();
  };
  document.getElementById('confirmOverlay').classList.add('active');
}

function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('active');
}

// ============ HELPERS ============
function refreshCurrentView() {
  const page = state.currentPage;
  if (page === 'home') renderHome();
  if (page === 'tasks') renderTasks();
  if (page === 'calendar') renderCalendar();
  if (page === 'profile') renderProfile();
}

setInterval(() => {
  if (state.currentPage === 'home') {
    const hour = new Date().getHours();
    const hello = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
    document.getElementById('greetingHello').textContent = hello;
  }
}, 60000);

// ============ INIT ============
function init() {
  loadState();
  
  if (state.theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  
  setTimeout(() => {
    document.getElementById('splashScreen').classList.add('hidden');
    setTimeout(() => {
      document.getElementById('splashScreen').style.display = 'none';
    }, 600);
  }, 1400);
  
  renderHome();
  
  document.getElementById('taskSheetOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'taskSheetOverlay') closeCreateTask();
  });
  document.getElementById('profileSheetOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'profileSheetOverlay') closeEditProfile();
  });
  document.getElementById('searchOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'searchOverlay') closeSearch();
  });
  document.getElementById('confirmOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'confirmOverlay') closeConfirm();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCreateTask();
      closeEditProfile();
      closeSearch();
      closeConfirm();
    }
  });
}

window.addEventListener('DOMContentLoaded', init);