
"use strict";

/* StudySprint Ultimate — local-first student workspace.
   Preserves the existing task, session, daily goal and goal-history keys. */

const KEYS = {
  tasks: "studysprint-tasks",
  sessions: "studysprint-sessions",
  dailyGoal: "studysprint-daily-goal",
  goalHistory: "studysprint-goal-history",
  exams: "studysprint-exams",
  profile: "studysprint-profile",
  rewards: "studysprint-rewards",
  assistant: "studysprint-assistant-plan"
};

const $ = id => document.getElementById(id);

const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.warn("Storage read failed:", key, error);
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    toast("Could not save data. Check browser storage.");
    return false;
  }
};

const uid = () =>
  (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const pad = n => String(n).padStart(2, "0");

const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDate = value => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;

  const date = new Date(+match[1], +match[2] - 1, +match[3]);

  return date.getFullYear() === +match[1] &&
    date.getMonth() === +match[2] - 1 &&
    date.getDate() === +match[3]
    ? date
    : null;
};

const addDays = (date, amount) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};

const weekStart = date => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
};

const fmt = (date, options = { month: "short", day: "numeric" }) =>
  new Intl.DateTimeFormat(undefined, options).format(date);

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

const mins = value => {
  const amount = Math.max(0, Number(value) || 0);
  return amount < 60
    ? `${amount}m`
    : `${Math.floor(amount / 60)}h${amount % 60 ? ` ${amount % 60}m` : ""}`;
};

const diffDay = key => {
  const target = parseDate(key);
  const today = parseDate(dateKey());
  return target ? Math.round((target - today) / 86400000) : 0;
};

const dateStatus = key => {
  const difference = diffDay(key);
  if (difference < 0) return `${-difference}d overdue`;
  if (difference === 0) return "Today";
  if (difference === 1) return "Tomorrow";
  return `In ${difference} days`;
};

function toast(message) {
  const container = $("toastContainer");
  if (!container) return;

  const element = document.createElement("div");
  element.className = "toast";
  element.textContent = message;
  container.append(element);
  setTimeout(() => element.remove(), 3200);
}

function download(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const safeArray = value => Array.isArray(value) ? value : [];

/* Load existing data and retain its storage keys. */

let tasks = safeArray(read(KEYS.tasks, [])).map(task => ({
  ...task,
  id: task.id || uid(),
  name: String(task.name ?? task.title ?? "Untitled task"),
  subject: String(task.subject || ""),
  dueDate: String(task.dueDate || dateKey()),
  priority: ["High", "Medium", "Low"].includes(task.priority)
    ? task.priority
    : "Medium",
  effort: Math.max(5, Number(task.effort ?? task.estimatedTime ?? 30) || 30),
  completed: !!task.completed,
  completedAt: task.completedAt || null
}));

let sessions = safeArray(read(KEYS.sessions, [])).map(session => ({
  ...session,
  id: session.id || uid(),
  duration: Number(session.duration) || 25
}));

let exams = safeArray(read(KEYS.exams, [])).map(exam => ({
  ...exam,
  id: exam.id || uid(),
  title: String(exam.title || exam.name || "Untitled exam"),
  subject: String(exam.subject || ""),
  date: String(exam.date || exam.examDate || ""),
  time: String(exam.time || ""),
  location: String(exam.location || ""),
  notes: String(exam.notes || "")
}));

let dailyGoal = Math.max(
  1,
  Math.min(50, Math.floor(Number(read(KEYS.dailyGoal, 3)) || 3))
);

let goalHistory = read(KEYS.goalHistory, {}) || {};

let profile = read(KEYS.profile, {
  name: "Student",
  focus: "Build a consistent study routine",
  accent: "violet",
  theme: "dark"
}) || {};

let rewards = read(KEYS.rewards, {
  taskXP: {},
  sessionXP: {}
}) || { taskXP: {}, sessionXP: {} };

let assistantPlan = read(KEYS.assistant, null);

if (typeof goalHistory !== "object" || Array.isArray(goalHistory)) {
  goalHistory = {};
}

if (!rewards.taskXP) rewards.taskXP = {};
if (!rewards.sessionXP) rewards.sessionXP = {};

const saveTasks = () => write(KEYS.tasks, tasks);
const saveSessions = () => write(KEYS.sessions, sessions);
const saveExams = () => write(KEYS.exams, exams);

const titles = {
  overview: "Overview",
  tasks: "My tasks",
  calendar: "Calendar & exams",
  streaks: "Daily streaks",
  analytics: "Subject analytics",
  weekly: "Weekly progress",
  focus: "Focus room",
  rewards: "XP & rewards",
  assistant: "Study assistant",
  settings: "Profile & backup"
};

/* Navigation */

function activate(id, shouldScroll = true) {
  if (!$(id)) id = "overview";

  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active", page.id === id);
  });

  document.querySelectorAll(".nav-link").forEach(link => {
    link.classList.toggle("active", link.hash === `#${id}`);
  });

  $("pageTitle").textContent = titles[id] || "StudySprint";
  $("sidebar").classList.remove("open");

  if (shouldScroll) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (id === "calendar") renderCalendar();
  if (id === "assistant") renderAssistantPlan();
  if (id === "settings") renderProfile();
}

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener("click", event => {
    const id = link.hash.slice(1);

    if (titles[id]) {
      event.preventDefault();
      history.replaceState(null, "", `#${id}`);
      activate(id);
    }
  });
});

$("menuToggle").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

window.addEventListener("hashchange", () => {
  const id = location.hash.slice(1);
  if (titles[id]) activate(id, false);
});

/* Tasks and daily goal history */

function completedOn(key) {
  return tasks.filter(task =>
    task.completed &&
    task.completedAt &&
    dateKey(new Date(task.completedAt)) === key
  ).length;
}

function updateGoalHistory() {
  goalHistory[dateKey()] = completedOn(dateKey());
  write(KEYS.goalHistory, goalHistory);
}

function sortTasks(a, b) {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;

  const priority = { High: 0, Medium: 1, Low: 2 };

  if (!a.completed && priority[a.priority] !== priority[b.priority]) {
    return priority[a.priority] - priority[b.priority];
  }

  return a.dueDate.localeCompare(b.dueDate);
}

function addTask(event) {
  event.preventDefault();

  const name = $("taskInput").value.trim();
  const subject = $("subjectInput").value.trim();
  const dueDate = $("dueDateInput").value;
  const priority = $("priorityInput").value;
  const effort = Number($("effortInput").value);

  if (!name || !parseDate(dueDate) || effort < 5 || effort > 1440) {
    toast("Enter a task, valid due date, and estimate from 5–1440 minutes.");
    return;
  }

  tasks.push({
    id: uid(),
    name,
    subject,
    dueDate,
    priority,
    effort,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString()
  });

  saveTasks();
  $("taskForm").reset();
  $("dueDateInput").value = dateKey();
  $("effortInput").value = 30;

  renderAll();
  toast("Task added. Finish it to earn XP.");
}

function completeTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;

  if (task.completed && !rewards.taskXP[id]) {
    rewards.taskXP[id] = true;
  }

  if (!task.completed) {
    delete rewards.taskXP[id];
  }

  write(KEYS.rewards, rewards);
  saveTasks();
  updateGoalHistory();
  renderAll();

  toast(task.completed
    ? "Task completed — XP earned!"
    : "Task moved back to pending.");
}

function deleteTask(id) {
  tasks = tasks.filter(task => task.id !== id);
  delete rewards.taskXP[id];

  saveTasks();
  write(KEYS.rewards, rewards);
  renderAll();
  toast("Task deleted.");
}

$("taskForm").addEventListener("submit", addTask);
$("taskFilter").addEventListener("change", renderTasks);

$("clearTasks").addEventListener("click", () => {
  if (!tasks.length) return toast("No tasks to clear.");

  if (!confirm("Delete all tasks? This cannot be undone.")) return;

  tasks = [];
  rewards.taskXP = {};

  saveTasks();
  write(KEYS.rewards, rewards);
  renderAll();
  toast("Tasks cleared.");
});

$("taskList").addEventListener("change", event => {
  const button = event.target.closest('[data-act="toggle"]');
  if (button) completeTask(button.dataset.id);
});

$("taskList").addEventListener("click", event => {
  const deleteButton = event.target.closest('[data-act="delete"]');
  if (deleteButton) deleteTask(deleteButton.dataset.id);

  const focusButton = event.target.closest('[data-act="focus"]');

  if (focusButton) {
    $("focusTaskSelect").value = focusButton.dataset.id;
    activate("focus");
  }
});

function renderTasks() {
  const filter = $("taskFilter").value;

  const items = [...tasks]
    .sort(sortTasks)
    .filter(task =>
      filter === "all" ||
      (filter === "pending" && !task.completed) ||
      (filter === "completed" && task.completed)
    );

  $("taskCountLabel").textContent = `${items.length} tasks`;

  $("taskList").innerHTML = items.length
    ? items.map(task => `
      <div class="task-row ${task.completed ? "done" : ""}">
        <input class="task-check" type="checkbox"
          data-act="toggle" data-id="${esc(task.id)}"
          aria-label="Complete task" ${task.completed ? "checked" : ""}>
        <div class="task-copy">
          <b>${esc(task.name)}</b>
          <div class="meta">
            <span class="pill">${esc(task.subject || "Uncategorized")}</span>
            <span class="pill priority-${task.priority.toLowerCase()}">${task.priority}</span>
            <span class="pill ${!task.completed && task.dueDate < dateKey() ? "overdue" : ""}">
              ${!task.completed && task.dueDate < dateKey() ? "Overdue · " : "Due "}
              ${esc(fmt(parseDate(task.dueDate) || new Date()))}
            </span>
            <span class="pill">${mins(task.effort)}</span>
          </div>
        </div>
        <div class="task-actions">
          <button data-act="focus" data-id="${esc(task.id)}">Focus</button>
          <button data-act="delete" data-id="${esc(task.id)}">Delete</button>
        </div>
      </div>
    `).join("")
    : `<div class="empty">${tasks.length
      ? "No tasks match this filter."
      : "No tasks yet. Add your first task above."}</div>`;

  $("focusTaskSelect").innerHTML =
    '<option value="">General study session</option>' +
    tasks.filter(task => !task.completed).map(task =>
      `<option value="${esc(task.id)}">${esc(task.name)}${task.subject
        ? ` — ${esc(task.subject)}`
        : ""}</option>`
    ).join("");
}

/* Daily goals, streaks and activity */

function streakStats() {
  const qualifyingDays = Object.keys(goalHistory)
    .filter(key => parseDate(key) && Number(goalHistory[key]) >= dailyGoal)
    .sort();

  let best = 0;
  let run = 0;
  let previous = null;

  qualifyingDays.forEach(key => {
    const date = parseDate(key);

    run = previous && Math.round((date - previous) / 86400000) === 1
      ? run + 1
      : 1;

    best = Math.max(best, run);
    previous = date;
  });

  let cursor = Number(goalHistory[dateKey()]) >= dailyGoal
    ? parseDate(dateKey())
    : Number(goalHistory[dateKey(addDays(new Date(), -1))]) >= dailyGoal
      ? parseDate(dateKey(addDays(new Date(), -1)))
      : null;

  let current = 0;

  while (cursor && Number(goalHistory[dateKey(cursor)]) >= dailyGoal) {
    current++;
    cursor = addDays(cursor, -1);
  }

  return { current, best };
}

function renderGoals() {
  const today = dateKey();
  const count = completedOn(today);
  const percentage = Math.min(100, count / dailyGoal * 100);
  const streak = streakStats();

  const message = count >= dailyGoal
    ? "Daily goal achieved! Keep the momentum going."
    : `${dailyGoal - count} more task${dailyGoal - count === 1 ? "" : "s"} to reach today's goal.`;

  $("dailyGoalInput").value = dailyGoal;
  $("dailyGoalProgress").textContent = count;
  $("dailyGoalTarget").textContent = `/ ${dailyGoal} tasks`;
  $("dailyGoalBar").style.width = `${percentage}%`;
  $("dailyProgressText").textContent = `${count} / ${dailyGoal}`;
  $("currentStreak").textContent = `${streak.current} days`;
  $("bestStreak").textContent = `${streak.best} days`;
  $("dailyGoalMessage").textContent = message;

  $("overviewGoalProgress").textContent = count;
  $("overviewGoalTarget").textContent = `/ ${dailyGoal} tasks`;
  $("overviewGoalBar").style.width = `${percentage}%`;
  $("overviewGoalMessage").textContent = message;

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(new Date(), index - 6);
    const key = dateKey(date);
    const amount = Number(goalHistory[key]) || 0;

    return {
      key,
      date,
      amount,
      achieved: amount >= dailyGoal,
      today: key === today
    };
  });

  $("activityWeek").innerHTML = days.map(day => `
    <div class="activity-day">
      <i class="${day.achieved ? "active" : ""} ${day.today ? "today" : ""}">
        ${day.achieved ? "✓" : day.amount || "·"}
      </i>
      ${fmt(day.date, { weekday: "short" })}
    </div>
  `).join("");

  const milestones = [
    ["🌱", "Getting started", 3],
    ["🔥", "One full week", 7],
    ["🏆", "Consistency pro", 30],
    ["💎", "Two-week streak", 14],
    ["⚡", "Five-day streak", 5],
    ["🌟", "Monthly mastery", 30]
  ];

  $("streakMilestones").innerHTML = milestones.map(([icon, name, daysNeeded]) => `
    <div class="achievement ${streak.best >= daysNeeded ? "unlocked" : ""}">
      <span>${icon}</span><b>${name}</b>
      <small>${streak.best >= daysNeeded
        ? "Unlocked"
        : `Reach ${daysNeeded} consecutive goal days`}</small>
    </div>
  `).join("");
}

$("goalForm").addEventListener("submit", event => {
  event.preventDefault();

  const amount = Number($("dailyGoalInput").value);

  if (amount < 1 || amount > 50) {
    return toast("Choose a goal between 1 and 50.");
  }

  dailyGoal = Math.floor(amount);
  write(KEYS.dailyGoal, dailyGoal);
  renderAll();
  toast("Daily goal saved.");
});

/* Smart Study Planner */

function recommendation() {
  const pending = tasks.filter(task => !task.completed);

  pending.sort((a, b) => {
    const overdueA = a.dueDate < dateKey() ? -1 : 0;
    const overdueB = b.dueDate < dateKey() ? -1 : 0;

    if (overdueA !== overdueB) return overdueA - overdueB;

    const priority = { High: 0, Medium: 1, Low: 2 };

    return priority[a.priority] - priority[b.priority] ||
      a.dueDate.localeCompare(b.dueDate) ||
      a.effort - b.effort;
  });

  return pending[0] || null;
}

function renderRecommendation() {
  const task = recommendation();

  $("smartRecommendation").innerHTML = task
    ? `<h4>${esc(task.name)}</h4>
       <p>${esc(task.subject || "Uncategorized")} · ${esc(dateStatus(task.dueDate))}</p>
       <div class="meta">
         <span class="pill priority-${task.priority.toLowerCase()}">${task.priority} priority</span>
         <span class="pill">${mins(task.effort)}</span>
         <button class="button secondary" data-act="focus" data-id="${esc(task.id)}">Focus on this task</button>
       </div>`
    : `<h4>${tasks.length ? "Everything completed!" : "Start with one small task"}</h4>
       <p>${tasks.length
         ? "Add your next study goal when ready."
         : "Add a task to receive a rule-based recommendation."}</p>`;
}

$("refreshRecommendation").addEventListener("click", () => {
  renderRecommendation();
  toast("Recommendation refreshed.");
});

/* Weekly completion chart */

function weeklyCounts() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(new Date(), index - 6);
    const key = dateKey(date);

    return { date, key, count: completedOn(key) };
  });
}

function renderWeekly() {
  const days = weeklyCounts();
  const maximum = Math.max(1, ...days.map(day => day.count));
  const total = days.reduce((sum, day) => sum + day.count, 0);

  $("weeklyChart").innerHTML = days.map(day => `
    <div class="chart-day">
      <div class="chart-bar-area">
        <div class="chart-bar" style="height:${Math.max(
          day.count ? 5 : 2,
          day.count / maximum * 100
        )}%"><small>${day.count}</small></div>
      </div>
      <span>${fmt(day.date, { weekday: "short" })}</span>
    </div>
  `).join("");

  $("weeklyTotal").textContent = `${total} completed this week`;
}

/* Subject analytics */

function subjectGroups() {
  const groups = {};

  tasks.forEach(task => {
    const name = task.subject.trim() || "Uncategorized";

    if (!groups[name]) {
      groups[name] = {
        name,
        total: 0,
        completed: 0,
        pending: 0,
        pendingMinutes: 0,
        high: 0,
        overdue: 0
      };
    }

    const group = groups[name];
    group.total++;

    if (task.completed) {
      group.completed++;
    } else {
      group.pending++;
      group.pendingMinutes += task.effort;

      if (task.priority === "High") group.high++;
      if (task.dueDate < dateKey()) group.overdue++;
    }
  });

  return Object.values(groups)
    .map(group => ({
      ...group,
      rate: Math.round(group.completed / group.total * 100)
    }))
    .sort((a, b) => b.total - a.total);
}

function renderAnalytics() {
  const groups = subjectGroups();
  const pending = tasks.filter(task => !task.completed);
  const completed = tasks.filter(task => task.completed).length;
  const rate = tasks.length ? Math.round(completed / tasks.length * 100) : 0;

  $("analyticsSubjectCount").textContent = groups.length;
  $("analyticsPendingTime").textContent =
    mins(pending.reduce((sum, task) => sum + task.effort, 0));
  $("analyticsOverallRate").textContent = `${rate}%`;
  $("subjectRowCount").textContent = `${groups.length} subjects`;

  const top = groups.slice(0, 6);
  const maximum = Math.max(1, ...top.map(group => group.total));

  $("subjectChart").innerHTML = top.length
    ? top.map(group => `
      <div class="bar-row">
        <div class="bar-label">
          <span>${esc(group.name)}</span>
          <span>${group.completed}/${group.total}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${group.total / maximum * 100}%"></div>
        </div>
      </div>
    `).join("")
    : `<div class="empty">Add subjects to your tasks to see analytics.</div>`;

  $("subjectTableBody").innerHTML = groups.length
    ? groups.map(group => `
      <tr>
        <td>${esc(group.name)}</td>
        <td>${group.total}</td>
        <td>${group.completed}</td>
        <td>${group.pending}</td>
        <td>${group.rate}%</td>
        <td>${mins(group.pendingMinutes)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="6">No subject data yet.</td></tr>`;

  const best = [...groups].sort((a, b) => b.rate - a.rate)[0];
  const busiest = [...groups].sort((a, b) => b.pendingMinutes - a.pendingMinutes)[0];
  const overdue = pending.filter(task => task.dueDate < dateKey()).length;
  const high = pending.filter(task => task.priority === "High").length;

  const insights = [
    ["Overall progress", `${completed} of ${tasks.length} tasks completed (${rate}%).`],
    ["Best completion rate", best
      ? `${best.name}: ${best.rate}%.`
      : "Complete tasks to see your strongest subject."],
    ["Pending workload", busiest && busiest.pending
      ? `${busiest.name}: ${mins(busiest.pendingMinutes)} left.`
      : "No pending workload."],
    ["Priority check", `${overdue} overdue and ${high} high-priority pending tasks.`]
  ];

  $("studyInsights").innerHTML = insights.map(([title, message]) => `
    <div class="insight"><b>${esc(title)}</b><p>${esc(message)}</p></div>
  `).join("");
}

/* Weekly calendar and exam planner */

let calendarStart = weekStart(new Date());
let selectedDate = dateKey();

function calItems(key) {
  const examItems = exams
    .filter(exam => exam.date === key)
    .map(exam => ({
      id: exam.id,
      type: "exam",
      title: exam.title,
      subject: exam.subject,
      time: exam.time,
      original: exam
    }));

  const taskItems = tasks
    .filter(task => task.dueDate === key)
    .map(task => ({
      id: task.id,
      type: "task",
      title: task.name,
      subject: task.subject,
      priority: task.priority,
      completed: task.completed,
      original: task
    }));

  return [...examItems, ...taskItems];
}

function calMarkup(item) {
  return `
    <button class="cal-event ${
      item.type === "exam" ? "exam" : (item.priority?.toLowerCase() || "")
    } ${item.completed ? "done" : ""}"
      data-act="calitem" data-type="${item.type}" data-id="${esc(item.id)}">
      ${item.type === "exam" ? "EXAM · " : ""}${esc(item.title)}
      ${item.time ? `<small>${esc(item.time)}</small>` : ""}
    </button>
  `;
}

function renderCalendar() {
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(calendarStart, index)
  );

  const first = days[0];
  const last = days[6];

  $("weekRangeLabel").textContent =
    `${fmt(first, { month: "short", day: "numeric" })} – ` +
    `${fmt(last, { month: "short", day: "numeric", year: "numeric" })}`;

  $("calendarJumpDate").value = selectedDate;

  $("weeklyCalendar").innerHTML = `
    <div class="week-head">
      ${days.map(date => {
        const key = dateKey(date);

        return `<div class="${key === dateKey() ? "is-today" : ""} ${
          key === selectedDate ? "selected" : ""
        }">
          ${fmt(date, { weekday: "short" })}
          <b>${date.getDate()}</b>
        </div>`;
      }).join("")}
    </div>
    <div class="week-grid">
      ${days.map(date => {
        const key = dateKey(date);
        const items = calItems(key);

        return `<div class="day-cell ${
          key === dateKey() ? "today" : ""
        } ${key === selectedDate ? "selected" : ""}">
          <button class="day-select" data-act="selectday" data-date="${key}">+ Select day</button>
          ${items.slice(0, 4).map(calMarkup).join("")}
          ${items.length > 4 ? `<small class="cal-more">+${items.length - 4} more</small>` : ""}
        </div>`;
      }).join("")}
    </div>
  `;

  renderSelectedDay();
}

function renderSelectedDay() {
  const date = parseDate(selectedDate);
  if (!date) return;

  $("selectedDateLabel").textContent =
    fmt(date, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  const items = calItems(selectedDate);

  $("selectedDayItems").innerHTML = items.length
    ? items.map(item => `
      <div class="item-row">
        <div class="date-chip">${
          item.type === "exam" ? "EXAM" : item.completed ? "DONE" : esc(item.priority || "TASK")
        }</div>
        <div class="item-copy">
          <b>${esc(item.title)}</b>
          <small>${esc(item.subject || "Uncategorized")}${
            item.time ? ` · ${esc(item.time)}` : ""
          }${item.type === "task" ? ` · ${mins(item.original.effort)}` : ""}</small>
        </div>
        ${item.type === "task" && !item.completed
          ? `<button class="button secondary" data-act="daydone" data-id="${esc(item.id)}">Done</button>`
          : ""}
      </div>
    `).join("")
    : `<div class="empty">Nothing scheduled. Add a task or exam.</div>`;
}

$("previousWeek").addEventListener("click", () => {
  calendarStart = addDays(calendarStart, -7);
  selectedDate = dateKey(calendarStart);
  renderCalendar();
});

$("nextWeek").addEventListener("click", () => {
  calendarStart = addDays(calendarStart, 7);
  selectedDate = dateKey(calendarStart);
  renderCalendar();
});

$("todayWeek").addEventListener("click", () => {
  calendarStart = weekStart(new Date());
  selectedDate = dateKey();
  renderCalendar();
});

$("calendarJumpDate").addEventListener("change", () => {
  const date = parseDate($("calendarJumpDate").value);

  if (date) {
    selectedDate = dateKey(date);
    calendarStart = weekStart(date);
    renderCalendar();
  }
});

$("weeklyCalendar").addEventListener("click", event => {
  const dayButton = event.target.closest('[data-act="selectday"]');

  if (dayButton) {
    selectedDate = dayButton.dataset.date;
    renderCalendar();
    return;
  }

  const itemButton = event.target.closest('[data-act="calitem"]');

  if (itemButton) {
    const item = itemButton.dataset.type === "task"
      ? tasks.find(task => task.id === itemButton.dataset.id)
      : exams.find(exam => exam.id === itemButton.dataset.id);

    if (item) {
      selectedDate = itemButton.dataset.type === "task"
        ? item.dueDate
        : item.date;

      renderCalendar();
    }
  }
});

$("selectedDayItems").addEventListener("click", event => {
  const button = event.target.closest('[data-act="daydone"]');
  if (button) completeTask(button.dataset.id);
});

$("examForm").addEventListener("submit", event => {
  event.preventDefault();

  const title = $("examTitle").value.trim();
  const subject = $("examSubject").value.trim();
  const date = $("examDate").value;

  if (!title || !subject || !parseDate(date)) {
    return toast("Enter exam name, subject, and valid date.");
  }

  exams.push({
    id: uid(),
    title,
    subject,
    date,
    time: $("examTime").value,
    location: $("examLocation").value.trim(),
    notes: $("examNotes").value.trim(),
    createdAt: new Date().toISOString()
  });

  saveExams();
  $("examForm").reset();
  $("examDate").value = dateKey();

  selectedDate = date;
  calendarStart = weekStart(parseDate(date));

  renderAll();
  toast("Exam added to your planner.");
});

$("examList").addEventListener("click", event => {
  const button = event.target.closest('[data-act="deleteexam"]');
  if (!button) return;

  const exam = exams.find(item => item.id === button.dataset.id);

  if (exam && confirm(`Delete exam "${exam.title}"?`)) {
    exams = exams.filter(item => item.id !== button.dataset.id);
    saveExams();
    renderAll();
    toast("Exam deleted.");
  }
});

function renderExamList() {
  const items = [...exams]
    .filter(exam => parseDate(exam.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  $("examCountLabel").textContent = `${items.length} exams`;

  $("examList").innerHTML = items.length
    ? items.map(exam => {
      const date = parseDate(exam.date);
      const difference = diffDay(exam.date);

      const countdown = difference < 0
        ? `Passed ${-difference} day(s) ago`
        : difference === 0
          ? "Exam day — good luck!"
          : difference === 1
            ? "Tomorrow"
            : `${difference} days to prepare`;

      return `
        <div class="exam-card">
          <div class="exam-card-top">
            <div><h4>${esc(exam.title)}</h4><p>${esc(exam.subject)}</p></div>
            <div class="exam-date"><b>${date.getDate()}</b>${fmt(date, { month: "short" })}</div>
          </div>
          <div class="exam-count">${countdown}${exam.time ? ` · ${esc(exam.time)}` : ""}</div>
          ${exam.location ? `<p>📍 ${esc(exam.location)}</p>` : ""}
          ${exam.notes ? `<p>${esc(exam.notes)}</p>` : ""}
          <button class="button danger" data-act="deleteexam" data-id="${esc(exam.id)}">Delete exam</button>
        </div>
      `;
    }).join("")
    : `<div class="empty">No exams scheduled yet.</div>`;
}

/* Overview dashboard */

function renderOverview() {
  const completed = tasks.filter(task => task.completed).length;
  const pending = tasks.filter(task => !task.completed);

  $("totalTasks").textContent = tasks.length;
  $("completedTasks").textContent = completed;
  $("pendingTasks").textContent = pending.length;
  $("completionRate").textContent =
    `${tasks.length ? Math.round(completed / tasks.length * 100) : 0}%`;

  const today = dateKey();
  const todayTasks = pending.filter(task => task.dueDate === today);

  $("overviewTodayTasks").innerHTML = todayTasks.length
    ? todayTasks.slice(0, 5).map(task => `
      <div class="item-row">
        <div class="date-chip">✓</div>
        <div class="item-copy">
          <b>${esc(task.name)}</b>
          <small>${esc(task.subject || "Uncategorized")} · ${mins(task.effort)}</small>
        </div>
      </div>
    `).join("")
    : `<div class="empty">No pending tasks due today.</div>`;

  const upcoming = [
    ...pending.map(task => ({
      date: task.dueDate,
      title: task.name,
      sub: `${task.subject || "Uncategorized"} · ${task.priority}`,
      exam: false
    })),
    ...exams.map(exam => ({
      date: exam.date,
      title: exam.title,
      sub: `${exam.subject} · Exam`,
      exam: true
    }))
  ]
    .filter(item => parseDate(item.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  $("overviewUpcoming").innerHTML = upcoming.length
    ? upcoming.map(item => {
      const date = parseDate(item.date);

      return `
        <div class="item-row">
          <div class="date-chip"><b>${date.getDate()}</b>${fmt(date, { month: "short" })}</div>
          <div class="item-copy">
            <b>${item.exam ? "📝 " : ""}${esc(item.title)}</b>
            <small>${esc(item.sub)} · ${esc(dateStatus(item.date))}</small>
          </div>
        </div>
      `;
    }).join("")
    : `<div class="empty">Nothing scheduled yet. Add tasks or exams.</div>`;
}

/* Focus timer and study-time insights */

let timerMinutes = 25;
let timerLeft = 1500;
let timerId = null;
let running = false;
let timerStart = null;
let sessionTaskId = "";

function updateTimer() {
  $("timerDisplay").textContent =
    `${pad(Math.floor(timerLeft / 60))}:${pad(timerLeft % 60)}`;

  $("timerStatus").textContent = running
    ? "Stay focused…"
    : timerLeft === 0
      ? "Session complete!"
      : "Ready to focus";

  $("startTimer").textContent = running
    ? "Pause"
    : timerLeft < timerMinutes * 60
      ? "Resume"
      : "Start focus";

  const degree = Math.round(
    (timerMinutes * 60 - timerLeft) / (timerMinutes * 60) * 360
  );

  const ring = document.querySelector(".timer-ring");

  if (ring) {
    ring.style.background =
      `radial-gradient(circle,var(--surface) 62%,transparent 63%),` +
      `conic-gradient(var(--accent) ${degree}deg,` +
      `color-mix(in srgb,var(--accent) 15%,transparent) ${degree}deg)`;
  }
}

function stopTick() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function completeSession() {
  stopTick();
  running = false;
  timerLeft = 0;

  const task = tasks.find(item => item.id === sessionTaskId);

  const session = {
    id: uid(),
    completedAt: new Date().toISOString(),
    startedAt: (timerStart || new Date()).toISOString(),
    duration: Math.max(1, Math.round(timerMinutes)),
    date: dateKey(),
    taskId: task?.id || "",
    taskName: task?.name || "General study session",
    subject: task?.subject || "General study"
  };

  sessions.unshift(session);
  sessions = sessions.slice(0, 200);

  rewards.sessionXP[session.id] = true;
  write(KEYS.rewards, rewards);
  saveSessions();

  renderAll();
  updateTimer();
  toast("Focus session complete — XP earned!");
}

function toggleTimer() {
  if (running) {
    stopTick();
    running = false;
    updateTimer();
    return;
  }

  if (timerLeft <= 0) timerLeft = timerMinutes * 60;

  running = true;
  timerStart = new Date();
  sessionTaskId = $("focusTaskSelect").value;

  updateTimer();

  timerId = setInterval(() => {
    timerLeft = Math.max(0, timerLeft - 1);
    updateTimer();

    if (timerLeft === 0) completeSession();
  }, 1000);
}

function resetTimer() {
  stopTick();
  running = false;
  timerLeft = timerMinutes * 60;
  timerStart = null;
  updateTimer();
}

$("startTimer").addEventListener("click", toggleTimer);
$("resetTimer").addEventListener("click", resetTimer);

document.querySelectorAll("[data-minutes]").forEach(button => {
  button.addEventListener("click", () => {
    stopTick();
    running = false;
    timerMinutes = Number(button.dataset.minutes);
    timerLeft = timerMinutes * 60;
    timerStart = null;

    document.querySelectorAll("[data-minutes]").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    updateTimer();
  });
});

function renderSessions() {
  const totalMinutes = sessions.reduce(
    (sum, session) => sum + (Number(session.duration) || 0),
    0
  );

  $("sessionTotal").textContent = sessions.length;
  $("totalFocusTime").textContent = mins(totalMinutes);

  const bySubject = {};

  sessions.forEach(session => {
    const subject = session.subject || "General study";
    bySubject[subject] = (bySubject[subject] || 0) + (Number(session.duration) || 0);
  });

  $("focusBySubject").innerHTML = Object.keys(bySubject).length
    ? Object.entries(bySubject)
      .sort((a, b) => b[1] - a[1])
      .map(([subject, amount]) => `
        <div class="item-row">
          <div class="item-copy"><b>${esc(subject)}</b><small>${mins(amount)} focused</small></div>
        </div>
      `).join("")
    : `<div class="empty">Complete a focus session to track study time.</div>`;

  $("sessionHistory").innerHTML = sessions.length
    ? sessions.slice(0, 7).map(session => `
      <div class="item-row">
        <div class="item-copy">
          <b>${esc(session.taskName || "Focus session")}</b>
          <small>${esc(session.subject || "General study")} · ${mins(session.duration)} · ${
            session.completedAt
              ? esc(fmt(new Date(session.completedAt), { month: "short", day: "numeric" }))
              : "Saved session"
          }</small>
        </div>
      </div>
    `).join("")
    : `<div class="empty">No completed sessions yet.</div>`;
}

/* Gamification: XP, levels and badges */

function getXP() {
  const taskXP = tasks
    .filter(task => task.completed)
    .reduce((sum, task) => sum + 25 + (task.priority === "High" ? 10 : 0), 0);

  const sessionXP = sessions.reduce(sum => sum + 15, 0);

  const goalXP = Object.keys(goalHistory)
    .filter(key => Number(goalHistory[key]) >= dailyGoal)
    .length * 20;

  return taskXP + sessionXP + goalXP;
}

function renderRewards() {
  const xp = getXP();
  const level = Math.floor(xp / 100) + 1;
  const withinLevel = xp % 100;

  $("xpTotal").textContent = `${xp} XP`;
  $("xpLevel").textContent = `Level ${level}`;
  $("xpNext").textContent = `${100 - withinLevel} XP to next level`;
  $("levelProgressLabel").textContent = `${withinLevel} / 100 XP`;
  $("levelProgressBar").style.width = `${withinLevel}%`;

  const badges = [
    ["🌱", "First step", tasks.some(task => task.completed)],
    ["📚", "Five tasks", tasks.filter(task => task.completed).length >= 5],
    ["🏅", "Ten tasks", tasks.filter(task => task.completed).length >= 10],
    ["⏱️", "First focus", sessions.length >= 1],
    ["🔥", "Streak starter", streakStats().best >= 3],
    ["🏆", "Week warrior", streakStats().best >= 7],
    ["✨", "Level 5", level >= 5],
    ["🎯", "Goal setter", Object.keys(goalHistory).some(key => Number(goalHistory[key]) >= dailyGoal)]
  ];

  $("xpBadgesCount").textContent = badges.filter(badge => badge[2]).length;

  $("achievementGrid").innerHTML = badges.map(([icon, name, unlocked]) => `
    <div class="achievement ${unlocked ? "unlocked" : ""}">
      <span>${icon}</span><b>${name}</b>
      <small>${unlocked ? "Unlocked" : "Keep going to unlock"}</small>
    </div>
  `).join("");
}

/* Built-in local study assistant — no API key or network request */

function buildPlan() {
  const minutes = Math.max(15, Math.min(720, Number($("availableMinutes").value) || 120));
  const mode = $("planFocus").value;
  const prompt = $("assistantPrompt").value.trim();
  const pending = tasks.filter(task => !task.completed);

  let candidates = [...pending];

  if (mode === "exams") {
    const nextExam = [...exams]
      .filter(exam => exam.date >= dateKey())
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    if (nextExam) {
      candidates.sort((a, b) => {
        const aMatch = a.subject.toLowerCase() === nextExam.subject.toLowerCase() ? 0 : 1;
        const bMatch = b.subject.toLowerCase() === nextExam.subject.toLowerCase() ? 0 : 1;

        return aMatch - bMatch || a.dueDate.localeCompare(b.dueDate);
      });
    }
  } else if (mode === "quick") {
    candidates.sort((a, b) => a.effort - b.effort);
  } else {
    const priority = { High: 0, Medium: 1, Low: 2 };

    candidates.sort((a, b) =>
      priority[a.priority] - priority[b.priority] ||
      a.dueDate.localeCompare(b.dueDate)
    );
  }

  const upcomingExams = [...exams]
    .filter(exam => exam.date >= dateKey())
    .sort((a, b) => a.date.localeCompare(b.date));

  let remaining = minutes;
  const blocks = [];

  for (const task of candidates) {
    if (remaining < 10) break;

    const duration = Math.min(
      task.effort,
      remaining,
      mode === "quick" ? 25 : 45
    );

    blocks.push({
      title: task.name,
      subject: task.subject || "Study",
      minutes: duration,
      kind: "task",
      id: task.id
    });

    remaining -= duration;

    if (remaining >= 5) {
      blocks.push({
        title: "Short break",
        subject: "Rest",
        minutes: 5,
        kind: "break"
      });

      remaining -= 5;
    }
  }

  if (!blocks.length) {
    const exam = upcomingExams[0];

    blocks.push({
      title: exam
        ? `Review ${exam.subject}: ${exam.title}`
        : "Choose one important task and begin",
      subject: exam ? exam.subject : "Study",
      minutes: Math.min(25, minutes),
      kind: "suggestion"
    });
  }

  assistantPlan = {
    createdAt: new Date().toISOString(),
    minutes,
    mode,
    prompt,
    blocks,
    exam: upcomingExams[0] || null
  };

  write(KEYS.assistant, assistantPlan);
  renderAssistantPlan();
  toast("Your study plan is ready.");
}

function renderAssistantPlan() {
  const plan = assistantPlan;

  if (!plan) {
    $("assistantOutput").innerHTML =
      '<div class="empty">Generate a plan to see suggested study blocks here.</div>';
    return;
  }

  $("assistantOutput").innerHTML = `
    <p class="muted">Generated ${
      esc(fmt(new Date(plan.createdAt || Date.now()), {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }))
    } · ${plan.minutes} minutes available</p>

    ${plan.prompt ? `<p><b>Your focus:</b> ${esc(plan.prompt)}</p>` : ""}

    ${plan.exam ? `
      <div class="plan-block">
        <b>Upcoming exam: ${esc(plan.exam.title)}</b>
        <p>${esc(plan.exam.subject)} · ${esc(plan.exam.date)}. Prioritize relevant material and practice questions.</p>
      </div>
    ` : ""}

    <h4>Suggested schedule</h4>

    ${plan.blocks.map((block, index) => `
      <div class="plan-block">
        <b>${index + 1}. ${esc(block.title)} — ${block.minutes} min</b>
        <p>${esc(block.subject || "Study")}${
          block.kind === "break" ? " · Step away from your screen and reset." : ""
        }</p>
        ${block.kind === "task" && block.id
          ? `<button class="button secondary" data-act="assistantfocus" data-id="${esc(block.id)}">Start focus on this task</button>`
          : ""}
      </div>
    `).join("")}

    <p class="muted">This is a local, rule-based plan using your saved tasks and exams, not a response from a generative AI model.</p>
  `;
}

$("assistantForm").addEventListener("submit", event => {
  event.preventDefault();
  buildPlan();
});

$("assistantOutput").addEventListener("click", event => {
  const button = event.target.closest('[data-act="assistantfocus"]');

  if (button) {
    $("focusTaskSelect").value = button.dataset.id;
    activate("focus");
  }
});

$("copyPlan").addEventListener("click", async () => {
  if (!assistantPlan) return toast("Generate a plan first.");

  const text = assistantPlan.blocks
    .map((block, index) => `${index + 1}. ${block.title} — ${block.minutes} min`)
    .join("\n");

  try {
    await navigator.clipboard.writeText(text);
    toast("Plan copied.");
  } catch {
    download("studysprint-plan.txt", text, "text/plain");
    toast("Downloaded your plan as a text file.");
  }
});

function makeBreakdown(name) {
  const cleanName = name.trim();
  if (!cleanName) return;

  const steps = [
    `Clarify the requirement and list the expected deliverables for “${cleanName}”.`,
    "Collect lecture notes, references, examples, and required resources.",
    "Split the work into 2–4 small sections and complete the hardest section first.",
    "Review accuracy, solve a practice example, and fix gaps.",
    "Summarize the key points and prepare the final submission/revision."
  ];

  $("breakdownOutput").innerHTML = steps.map((step, index) => `
    <div class="item-row">
      <div class="date-chip"><b>${index + 1}</b></div>
      <div class="item-copy"><b>${esc(step)}</b></div>
    </div>
  `).join("");
}

$("breakdownForm").addEventListener("submit", event => {
  event.preventDefault();
  makeBreakdown($("breakdownTask").value);
});

/* Profile, theme, export and import */

function applyProfile() {
  const accents = {
    violet: "#9b8aff",
    blue: "#65b7ff",
    green: "#53d6a1",
    rose: "#ff83aa"
  };

  document.documentElement.style.setProperty(
    "--accent",
    accents[profile.accent] || accents.violet
  );

  document.body.classList.toggle("theme-light", profile.theme === "light");
  $("sidebarName").textContent = profile.name || "Student";
  $("sidebarAvatar").textContent =
    (profile.name || "S").trim().charAt(0).toUpperCase() || "S";
}

function renderProfile() {
  $("profileName").value = profile.name || "";
  $("profileFocus").value = profile.focus || "";
  $("accentColor").value = profile.accent || "violet";
  $("themeSelect").value = profile.theme || "dark";
}

$("profileForm").addEventListener("submit", event => {
  event.preventDefault();

  profile = {
    name: $("profileName").value.trim() || "Student",
    focus: $("profileFocus").value.trim(),
    accent: $("accentColor").value,
    theme: $("themeSelect").value
  };

  write(KEYS.profile, profile);
  applyProfile();
  toast("Profile and settings saved.");
});

$("exportData").addEventListener("click", () => {
  const data = {
    app: "StudySprint",
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks,
    sessions,
    exams,
    dailyGoal,
    goalHistory,
    profile,
    rewards,
    assistantPlan
  };

  download(
    `studysprint-backup-${dateKey()}.json`,
    JSON.stringify(data, null, 2)
  );
});

$("importData").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());

    if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.sessions)) {
      throw new Error("This does not look like a StudySprint backup.");
    }

    if (!confirm(
      "Import this backup and replace current StudySprint data? Export your current data first if needed."
    )) {
      return;
    }

    tasks = data.tasks;
    sessions = data.sessions;
    exams = safeArray(data.exams);
    dailyGoal = Math.max(1, Math.min(50, Number(data.dailyGoal) || 3));
    goalHistory = data.goalHistory && typeof data.goalHistory === "object"
      ? data.goalHistory
      : {};
    profile = data.profile || profile;
    rewards = data.rewards || { taskXP: {}, sessionXP: {} };
    assistantPlan = data.assistantPlan || null;

    if (!rewards.taskXP) rewards.taskXP = {};
    if (!rewards.sessionXP) rewards.sessionXP = {};

    saveTasks();
    saveSessions();
    saveExams();
    write(KEYS.dailyGoal, dailyGoal);
    write(KEYS.goalHistory, goalHistory);
    write(KEYS.profile, profile);
    write(KEYS.rewards, rewards);
    write(KEYS.assistant, assistantPlan);

    applyProfile();
    renderAll();
    toast("Backup imported successfully.");
  } catch (error) {
    toast(`Import failed: ${error.message}`);
  } finally {
    event.target.value = "";
  }
});

$("resetSettings").addEventListener("click", () => {
  if (!confirm(
    "Reset profile name, focus, theme, and accent? Your tasks and study history will remain."
  )) {
    return;
  }

  profile = {
    name: "Student",
    focus: "Build a consistent study routine",
    accent: "violet",
    theme: "dark"
  };

  write(KEYS.profile, profile);
  applyProfile();
  renderProfile();
  toast("Profile settings reset.");
});

/* Render everything and start the app */

function renderAll() {
  updateGoalHistory();
  renderOverview();
  renderTasks();
  renderGoals();
  renderRecommendation();
  renderWeekly();
  renderAnalytics();
  renderCalendar();
  renderExamList();
  renderSessions();
  renderRewards();
  renderAssistantPlan();
  applyProfile();
}

function init() {
  profile = profile || {};

  profile = {
    name: profile.name || "Student",
    focus: profile.focus || "",
    accent: profile.accent || "violet",
    theme: profile.theme || "dark"
  };

  $("todayLabel").textContent = fmt(new Date(), {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  $("dueDateInput").value = dateKey();
  $("examDate").value = dateKey();

  applyProfile();
  renderAll();
  updateTimer();

  const id = location.hash.slice(1);
  activate(titles[id] ? id : "overview", false);
}

init();
