
from flask import Flask, render_template, request, jsonify
from pathlib import Path
from datetime import date
import json

app = Flask(__name__)

# Lokasi file JSON di dalam folder proyek
DATA_FILE = Path(__file__).with_name("data.json")


def load_data():
    """Membaca data dari JSON."""
    if not DATA_FILE.exists():
        initial_data = {
            "tasks": [],
            "schedule": []
        }
        save_data(initial_data)
        return initial_data

    try:
        with DATA_FILE.open("r", encoding="utf-8") as file:
            data = json.load(file)

        # Memastikan kedua daftar tersedia
        data.setdefault("tasks", [])
        data.setdefault("schedule", [])
        return data

    except (json.JSONDecodeError, OSError):
        return {"tasks": [], "schedule": []}


def save_data(data):
    """Menyimpan data ke JSON."""
    with DATA_FILE.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=4, ensure_ascii=False)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/data")
def get_data():
    data = load_data()
    today = date.today().isoformat()

    # Statistik tugas dihitung di backend
    tasks = data["tasks"]
    completed = sum(1 for task in tasks if task["completed"])
    pending = len(tasks) - completed

    overdue = sum(
        1 for task in tasks
        if not task["completed"]
        and task.get("deadline")
        and task["deadline"] < today
    )

    progress = round(completed / len(tasks) * 100) if tasks else 0

    return jsonify({
        **data,
        "stats": {
            "total": len(tasks),
            "completed": completed,
            "pending": pending,
            "overdue": overdue,
            "progress": progress
        }
    })


@app.route("/api/tasks", methods=["POST"])
def add_task():
    body = request.get_json(silent=True) or {}

    title = str(body.get("title", "")).strip()
    subject = str(body.get("subject", "")).strip()
    deadline = str(body.get("deadline", "")).strip()
    priority = str(body.get("priority", "Sedang"))

    if not title:
        return jsonify({"error": "Nama tugas wajib diisi."}), 400

    if priority not in ["Rendah", "Sedang", "Tinggi"]:
        return jsonify({"error": "Prioritas tidak valid."}), 400

    data = load_data()

    next_id = max(
        (task.get("id", 0) for task in data["tasks"]),
        default=0
    ) + 1

    task = {
        "id": next_id,
        "title": title,
        "subject": subject or "Umum",
        "deadline": deadline,
        "priority": priority,
        "completed": False
    }

    data["tasks"].append(task)
    save_data(data)

    return jsonify(task), 201


@app.route("/api/tasks/<int:task_id>/toggle", methods=["PATCH"])
def toggle_task(task_id):
    data = load_data()

    for task in data["tasks"]:
        if task["id"] == task_id:
            task["completed"] = not task["completed"]
            save_data(data)
            return jsonify(task)

    return jsonify({"error": "Tugas tidak ditemukan."}), 404


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    data = load_data()
    original_count = len(data["tasks"])

    data["tasks"] = [
        task for task in data["tasks"]
        if task["id"] != task_id
    ]

    if len(data["tasks"]) == original_count:
        return jsonify({"error": "Tugas tidak ditemukan."}), 404

    save_data(data)
    return jsonify({"message": "Tugas berhasil dihapus."})


@app.route("/api/schedule", methods=["POST"])
def add_schedule():
    body = request.get_json(silent=True) or {}

    subject = str(body.get("subject", "")).strip()
    day = str(body.get("day", "Senin"))
    start = str(body.get("start", ""))
    end = str(body.get("end", ""))
    location = str(body.get("location", "")).strip()

    days = [
        "Senin", "Selasa", "Rabu", "Kamis",
        "Jumat", "Sabtu", "Minggu"
    ]

    if not subject:
        return jsonify({"error": "Nama mata kuliah wajib diisi."}), 400

    if day not in days:
        return jsonify({"error": "Hari tidak valid."}), 400

    # Memastikan format jam HH:MM
    import re
    time_pattern = r"^(?:[01]\d|2[0-3]):[0-5]\d$"

    if not re.fullmatch(time_pattern, start) or not re.fullmatch(time_pattern, end):
        return jsonify({"error": "Format jam harus HH:MM."}), 400

    if start >= end:
        return jsonify({"error": "Jam selesai harus setelah jam mulai."}), 400

    data = load_data()

    next_id = max(
        (item.get("id", 0) for item in data["schedule"]),
        default=0
    ) + 1

    item = {
        "id": next_id,
        "subject": subject,
        "day": day,
        "start": start,
        "end": end,
        "location": location
    }

    data["schedule"].append(item)
    save_data(data)

    return jsonify(item), 201


@app.route("/api/schedule/<int:item_id>", methods=["DELETE"])
def delete_schedule(item_id):
    data = load_data()
    original_count = len(data["schedule"])

    data["schedule"] = [
        item for item in data["schedule"]
        if item["id"] != item_id
    ]

    if len(data["schedule"]) == original_count:
        return jsonify({"error": "Jadwal tidak ditemukan."}), 404

    save_data(data)
    return jsonify({"message": "Jadwal berhasil dihapus."})


if __name__ == "__main__":
    app.run(debug=True)
