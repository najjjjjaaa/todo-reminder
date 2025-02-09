const express = require('express');
const bodyParser = require('body-parser');
const expressLayouts = require('express-ejs-layouts');
const fs = require('fs'); // For file-based storage
const app = express();
const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer(app);
const io = socketIo(server); // Initialize socket.io

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(expressLayouts);

const DATA_FILE = 'todos.json';

// Helper function to load todos from the JSON file
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  }
  return { todos: [], reminders: [] };
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let { todos, reminders } = loadData();

io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('A client disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.render('index', { todos, reminders });
});

let userName;

app.post('/welcome', (req, res) => {
  userName = req.body.userName;
  res.redirect('/welcome');
});

app.get('/welcome', (req, res) => {
  res.render('welcome', { name: userName });
});

app.get('/choose', (req, res) => {
  res.render('choose');
});

app.get('/todo', (req, res) => {
  res.render('todo', { todos, reminders });
});

app.get('/reminders', (req, res) => {
  res.render('reminder', { todos, reminders });
});

// Add a new todo
app.post('/add-todo', (req, res) => {
  const newTodo = {
    id: Date.now(),
    text: req.body.todoText,
    completed: false,
  };
  todos.push(newTodo);
  saveData({ todos, reminders });
  res.redirect('/todo');
});

// Add a new reminder
app.post('/add-reminder', (req, res) => {
  const newReminder = {
    id: Date.now(),
    text: req.body.reminderText,
    time: req.body.reminderTime, // Store the local time directly
    notified: false,
  };
  console.log(req.body.reminderTime);

  reminders.push(newReminder);
  saveData({ todos, reminders });
  res.redirect('/reminders');
});

// Mark a todo as completed
app.post('/complete-todo/:id', (req, res) => {
  const todoId = parseInt(req.params.id);
  const todo = todos.find(t => t.id === todoId);
  if (todo) {
    todo.completed = !todo.completed; // Toggle completion status
    saveData({ todos, reminders });
  }
  res.redirect('/todo');
});

// Delete a todo
app.post('/delete-todo/:id', (req, res) => {
  const todoId = parseInt(req.params.id);
  todos = todos.filter(t => t.id !== todoId);
  saveData({ todos, reminders });
  res.redirect('/todo');
});

// Mark a reminder as done
app.post('/complete-reminder/:id', (req, res) => {
  const reminderId = parseInt(req.params.id);
  const reminder = reminders.find(r => r.id === reminderId);
  if (reminder) {
    reminder.notified = true; // Mark as done
    saveData({ todos, reminders });
  }
  res.redirect('/reminders');
});

// Delete a reminder
app.post('/delete-reminder/:id', (req, res) => {
  const reminderId = parseInt(req.params.id);
  reminders = reminders.filter(r => r.id !== reminderId);
  saveData({ todos, reminders });
  res.redirect('/reminders');
});

// Reminder function
setInterval(() => {
  console.log('Reminder interval is running...');
  const currentTime = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(/(\d+)\/(\d+)\/(\d+), (\d+:\d+)/, '$3-$1-$2T$4'); // Convert to YYYY-MM-DDTHH:MM format

  reminders.forEach((reminder) => {
    // Check if the reminder time is past or exactly the current time
    if (reminder.time <= currentTime && !reminder.notified) {
      console.log(`Reminder: ${reminder.text}`); // Log reminder to server console
      reminder.notified = true; // Mark the reminder as notified
      io.emit('notification', {
        message: `Reminder: ${reminder.text}`,
        time: reminder.time,
      });
      // Save updated reminders
      saveData({ todos, reminders });
    }
  });
}, 30000); // Check every 30 seconds

const PORT = 6969;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});