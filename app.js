// DOM элементы
const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');
const filterButtons = document.querySelectorAll('.filter-btn');
const notifyBtn = document.getElementById('notifyBtn');
const installBtn = document.getElementById('installBtn');

let currentFilter = 'all';
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let deferredPrompt;

// Инициализация приложения
function init() {
  renderTasks();
  setupEventListeners();
  checkNotificationPermission();
  registerServiceWorker();
}

// Регистрация Service Worker
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful');
        
        // Проверка обновлений каждые 2 часа
        setInterval(() => {
          registration.update();
        }, 2 * 60 * 60 * 1000);
      })
      .catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
  }
}

// Установка обработчиков событий
function setupEventListeners() {
  addTaskBtn.addEventListener('click', addTask);
  taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
  });
  
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      currentFilter = button.dataset.filter;
      renderTasks();
    });
  });
  
  notifyBtn.addEventListener('click', requestNotificationPermission);
  
  // Обработчик события beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.classList.remove('hidden');
  });
  
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      installBtn.classList.add('hidden');
    }
    
    deferredPrompt = null;
  });
}

// Добавление новой задачи
function addTask() {
  const text = taskInput.value.trim();
  if (text === '') return;
  
  const newTask = {
    id: Date.now(),
    text,
    completed: false,
    createdAt: new Date().toISOString()
  };
  
  tasks.unshift(newTask);
  saveTasks();
  renderTasks();
  taskInput.value = '';
  
  // Показываем уведомление
  if (Notification.permission === 'granted') {
    showNotification('Новая задача добавлена', `Задача: ${text}`);
  }
}

// Сохранение задач в localStorage
function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Отображение задач с учетом фильтра
function renderTasks() {
  taskList.innerHTML = '';
  
  const filteredTasks = tasks.filter(task => {
    if (currentFilter === 'active') return !task.completed;
    if (currentFilter === 'completed') return task.completed;
    return true;
  });
  
  if (filteredTasks.length === 0) {
    taskList.innerHTML = '<li class="empty">Нет задач</li>';
    return;
  }
  
  filteredTasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.dataset.id = task.id;
    
    li.innerHTML = `
      <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
      <span class="task-text ${task.completed ? 'completed' : ''}">${task.text}</span>
      <button class="delete-btn">×</button>
    `;
    
    const checkbox = li.querySelector('.task-checkbox');
    const deleteBtn = li.querySelector('.delete-btn');
    const taskText = li.querySelector('.task-text');
    
    checkbox.addEventListener('change', () => {
      task.completed = checkbox.checked;
      taskText.classList.toggle('completed', task.completed);
      saveTasks();
      
      // Уведомление при завершении задачи
      if (task.completed && Notification.permission === 'granted') {
        showNotification('Задача выполнена', `Вы выполнили: ${task.text}`);
      }
    });
    
    deleteBtn.addEventListener('click', () => {
      tasks = tasks.filter(t => t.id !== task.id);
      saveTasks();
      renderTasks();
    });
    
    taskList.appendChild(li);
  });
}

// Проверка разрешения на уведомления
function checkNotificationPermission() {
  if (Notification.permission === 'granted') {
    notifyBtn.textContent = 'Уведомления включены';
    notifyBtn.disabled = true;
    scheduleReminderNotifications();
  } else if (Notification.permission === 'denied') {
    notifyBtn.textContent = 'Уведомления заблокированы';
    notifyBtn.disabled = true;
  }
}

// Запрос разрешения на уведомления
function requestNotificationPermission() {
  if (Notification.permission === 'granted') return;
  
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      notifyBtn.textContent = 'Уведомления включены';
      notifyBtn.disabled = true;
      showNotification('Уведомления включены', 'Теперь вы будете получать уведомления о задачах');
      scheduleReminderNotifications();
    } else {
      notifyBtn.textContent = 'Уведомления отключены';
    }
  });
}

// Показ уведомления
function showNotification(title, body) {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, {
        body,
        icon: 'icons/icon-192x192.png',
        vibrate: [200, 100, 200]
      });
    });
  } else {
    // Fallback для браузеров без поддержки Push API
    new Notification(title, { body });
  }
}

// Планирование напоминаний о невыполненных задачах
function scheduleReminderNotifications() {
  if (!('serviceWorker' in navigator)) return;
  
  // Очищаем предыдущие напоминания
  if (window.reminderInterval) {
    clearInterval(window.reminderInterval);
  }
  
  // Проверяем каждые 2 часа
  window.reminderInterval = setInterval(() => {
    const activeTasks = tasks.filter(task => !task.completed);
    
    if (activeTasks.length > 0 && Notification.permission === 'granted') {
      showNotification(
        'Напоминание о задачах', 
        `У вас ${activeTasks.length} невыполненных задач`
      );
    }
  }, 2 * 60 * 60 * 1000);
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', init);