const $ = (selector) => document.querySelector(selector);

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

let tasks = [];
let schedule = [];
let stats = {};

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

function formatDate(value) {
  if (!value) return "Tanpa deadline";

  const parts = value.split("-");
  if (parts.length !== 3) return value;

  return new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2]),
  ).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isOverdue(task) {
  return Boolean(
    !task.completed && task.deadline && task.deadline < getToday(),
  );
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Terjadi kesalahan.");
  }

  return result;
}

async function loadData() {
  try {
    const data = await api("/api/data");

    tasks = data.tasks;
    schedule = data.schedule;
    stats = data.stats;

    renderStats();
    renderTasks();
    renderSchedule();
  } catch (error) {
    showToast(error.message);
  }
}

function renderStats() {
  $("#totalTasks").textContent = stats.total ?? 0;
  $("#pendingTasks").textContent = stats.pending ?? 0;
  $("#completedTasks").textContent = stats.completed ?? 0;
  $("#overdueTasks").textContent = stats.overdue ?? 0;

  const progress = stats.progress ?? 0;

  $("#progressPercent").textContent = `${progress}%`;
  $("#progressBar").style.width = `${progress}%`;
  $("#progressDetail").textContent =
    `${stats.completed ?? 0} dari ${stats.total ?? 0} tugas selesai`;

  if (progress === 100 && stats.total > 0) {
    $("#progressCaption").textContent = "Semua tugas selesai!";
  } else if (progress >= 60) {
    $("#progressCaption").textContent = "Terus pertahankan!";
  } else if (progress > 0) {
    $("#progressCaption").textContent = "Kamu sudah memulai!";
  } else {
    $("#progressCaption").textContent = "Ayo mulai belajar!";
  }
}

function taskHTML(task) {
  const completed = task.completed;
  const overdue = isOverdue(task);
  const priorityClass = String(task.priority || "Sedang").toLowerCase();

  return `
        <div class="task-item ${completed ? "is-completed" : ""}">
            <input
                class="task-check"
                type="checkbox"
                data-toggle-task="${task.id}"
                ${completed ? "checked" : ""}
                aria-label="Tandai ${escapeHTML(task.title)} selesai"
            >
            <div class="task-main">
                <div class="task-title">${escapeHTML(task.title)}</div>
                <div class="task-meta">
                    <span>${escapeHTML(task.subject || "Umum")}</span>
                    <span>·</span>
                    <span class="${overdue ? "overdue-label" : ""}">
                        ${overdue ? "Terlambat · " : "Deadline: "}
                        ${escapeHTML(formatDate(task.deadline))}
                    </span>
                </div>
            </div>
            <span class="priority priority-${escapeHTML(priorityClass)}">
                ${escapeHTML(task.priority)}
            </span>
            <button class="delete-button"
                data-delete-task="${task.id}"
                aria-label="Hapus tugas ${escapeHTML(task.title)}">✕</button>
        </div>
    `;
}

function renderTasks() {
  const recent = [...tasks]
    .sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    })
    .slice(0, 5);

  $("#recentTasks").innerHTML = recent.length
    ? recent.map(taskHTML).join("")
    : '<div class="empty-state">Belum ada tugas. Yuk, tambahkan tugas pertamamu!</div>';

  const search = ($("#taskSearch").value || "").toLowerCase().trim();
  const filter = $("#taskFilter").value;

  const filtered = tasks.filter((task) => {
    const matchesSearch = `${task.title} ${task.subject}`
      .toLowerCase()
      .includes(search);

    const matchesFilter =
      filter === "all" ||
      (filter === "pending" && !task.completed) ||
      (filter === "completed" && task.completed) ||
      (filter === "overdue" && isOverdue(task));

    return matchesSearch && matchesFilter;
  });

  $("#allTasks").innerHTML = filtered.length
    ? filtered.map(taskHTML).join("")
    : '<div class="empty-state">Tidak ada tugas yang cocok dengan pencarianmu.</div>';
}

function scheduleHTML(item) {
  return `
        <div class="schedule-item">
            <div class="schedule-day">${escapeHTML(item.day)}</div>
            <div class="schedule-main">
                <strong>${escapeHTML(item.subject)}</strong>
                <small>
                    ${escapeHTML(item.start)}–${escapeHTML(item.end)}
                    ${item.location ? " · " + escapeHTML(item.location) : ""}
                </small>
            </div>
            <button class="delete-button"
                data-delete-schedule="${item.id}"
                aria-label="Hapus jadwal ${escapeHTML(item.subject)}">✕</button>
        </div>
    `;
}

function renderSchedule() {
  const sorted = [...schedule].sort((a, b) => {
    const dayDifference = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    return dayDifference || a.start.localeCompare(b.start);
  });

  const empty =
    '<div class="empty-state">Belum ada jadwal kuliah. Tambahkan jadwalmu di sini.</div>';
  const html = sorted.length ? sorted.map(scheduleHTML).join("") : empty;

  $("#allSchedule").innerHTML = html;
  $("#overviewSchedule").innerHTML = html;
}

async function addTask(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);

  const body = {
    title: formData.get("title"),
    subject: formData.get("subject"),
    deadline: formData.get("deadline"),
    priority: formData.get("priority"),
  };

  try {
    await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify(body),
    });

    form.reset();
    $("#taskPriority").value = "Sedang";
    closeModal("taskModal");
    await loadData();
    showToast("Tugas berhasil ditambahkan!");
  } catch (error) {
    showToast(error.message);
  }
}

async function addSchedule(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);

  const body = {
    subject: formData.get("subject"),
    day: formData.get("day"),
    start: formData.get("start"),
    end: formData.get("end"),
    location: formData.get("location"),
  };

  try {
    await api("/api/schedule", {
      method: "POST",
      body: JSON.stringify(body),
    });

    event.currentTarget.reset();
    $("#scheduleStart").value = "08:00";
    $("#scheduleEnd").value = "10:00";
    closeModal("scheduleModal");
    await loadData();
    showToast("Jadwal berhasil ditambahkan!");
  } catch (error) {
    showToast(error.message);
  }
}

async function toggleTask(id) {
  try {
    await api(`/api/tasks/${id}/toggle`, { method: "PATCH" });
    await loadData();
    showToast("Status tugas diperbarui.");
  } catch (error) {
    showToast(error.message);
    await loadData();
  }
}

async function deleteTask(id) {
  if (!confirm("Yakin ingin menghapus tugas ini?")) return;

  try {
    await api(`/api/tasks/${id}`, { method: "DELETE" });
    await loadData();
    showToast("Tugas berhasil dihapus.");
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteSchedule(id) {
  if (!confirm("Yakin ingin menghapus jadwal ini?")) return;

  try {
    await api(`/api/schedule/${id}`, { method: "DELETE" });
    await loadData();
    showToast("Jadwal berhasil dihapus.");
  } catch (error) {
    showToast(error.message);
  }
}

function openModal(id) {
  $("#" + id).classList.remove("hidden");
}

function closeModal(id) {
  $("#" + id).classList.add("hidden");
}

function navigate(page) {
  document.querySelectorAll(".page-section").forEach((section) => {
    section.classList.toggle("hidden", section.id !== page);
  });

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === page);
  });

  const titles = {
    overview: "Dashboard",
    tasks: "Daftar Tugas",
    schedule: "Jadwal Kuliah",
  };

  $("#pageTitle").textContent = titles[page] || "Dashboard";
  $("#sidebar").classList.remove("open");

  if (location.hash !== `#${page}`) {
    history.replaceState(null, "", `#${page}`);
  }
}

function init() {
  $("#currentDate").textContent = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(link.dataset.page);
    });
  });

  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.go));
  });

  $("#menuButton").addEventListener("click", () => {
    $("#sidebar").classList.toggle("open");
  });

  $("#addTaskButton").addEventListener("click", () => openModal("taskModal"));
  $("#quickAddTask").addEventListener("click", () => openModal("taskModal"));

  $("#addScheduleButton").addEventListener("click", () =>
    openModal("scheduleModal"),
  );
  $("#quickAddSchedule").addEventListener("click", () =>
    openModal("scheduleModal"),
  );

  $("#taskForm").addEventListener("submit", addTask);
  $("#scheduleForm").addEventListener("submit", addSchedule);

  $("#taskSearch").addEventListener("input", renderTasks);
  $("#taskFilter").addEventListener("change", renderTasks);

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
  });

  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeModal(backdrop.id);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document.querySelectorAll(".modal-backdrop").forEach((modal) => {
        closeModal(modal.id);
      });
      $("#sidebar").classList.remove("open");
    }
  });

  // Delegasi event agar tombol tetap berfungsi setelah daftar diperbarui
  document.addEventListener("change", (event) => {
    const id = event.target.dataset.toggleTask;
    if (id) toggleTask(id);
  });

  document.addEventListener("click", (event) => {
    const taskButton = event.target.closest("[data-delete-task]");
    const scheduleButton = event.target.closest("[data-delete-schedule]");

    if (taskButton) deleteTask(taskButton.dataset.deleteTask);
    if (scheduleButton) deleteSchedule(scheduleButton.dataset.deleteSchedule);
  });

  const initialPage = location.hash.slice(1);
  navigate(
    ["overview", "tasks", "schedule"].includes(initialPage)
      ? initialPage
      : "overview",
  );

  loadData();
}

document.addEventListener("DOMContentLoaded", init);
