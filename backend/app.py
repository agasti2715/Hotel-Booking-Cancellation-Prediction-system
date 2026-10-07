"""Flask REST API for hotel booking cancellation prediction.

Endpoints
    POST /predict         one booking  -> outcome, probabilities, risk drivers, tips, guest scores
    POST /predict/batch   many bookings (CSV upload on the frontend) -> one result per row
    GET  /stats           dataset and model statistics for the dashboard
    GET  /health          is the model loaded?

If the frontend has been built (frontend/dist), Flask serves it too, so the
whole app can run from one command:  python app.py  ->  http://127.0.0.1:5000
"""

import json
from pathlib import Path

import joblib
import pandas as pd
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from features import CATEGORY_MAPS, CORE_FIELDS, INPUT_FIELDS, decode_value, encode_value
from insights import guest_experience, recommendations, risk_level

BASE = Path(__file__).parent
MODEL_DIR = BASE / "model"
FRONTEND_DIST = BASE.parent / "frontend" / "dist"
CLASS_MAPPING = {0: "Confirmed", 1: "Cancelled"}
MAX_BATCH_ROWS = 1000

app = Flask(__name__, static_folder=None)
CORS(app)

try:
    model = joblib.load(MODEL_DIR / "booking_cancellation_model.pkl")
    scaler = joblib.load(MODEL_DIR / "scaler.pkl")
    medians = joblib.load(MODEL_DIR / "training_medians.pkl")
    stats = json.loads((MODEL_DIR / "model_stats.json").read_text())
except FileNotFoundError as e:
    model = scaler = medians = stats = None
    print(f"Error loading model artifacts: {e}. Run 'python train_model.py' first.")


class InputError(Exception):
    def __init__(self, errors):
        super().__init__("Invalid booking details")
        self.errors = errors


def build_row(ui_data):
    """Start from the training baseline and overwrite it with the user's values."""
    if not isinstance(ui_data, dict):
        raise InputError({"_": "Request body must be a JSON object"})
    errors = {}
    row = medians.copy()
    for field, (_, _, label) in INPUT_FIELDS.items():
        value = ui_data.get(field)
        if value is None or value == "":
            if field in CORE_FIELDS:
                errors[field] = f"{label} is required"
            continue
        try:
            row[field] = encode_value(field, value)
        except ValueError as e:
            errors[field] = f"{label} {e}"
    if errors:
        raise InputError(errors)
    return row


def cancel_probability(rows):
    """Cancellation probability (0-1) for each row of a DataFrame of encoded features."""
    aligned = rows[scaler.feature_names_in_]
    scaled = pd.DataFrame(scaler.transform(aligned), columns=scaler.feature_names_in_)
    return model.predict_proba(scaled)[:, 1]


def readable_booking(row):
    """Encoded row -> plain values (category labels instead of codes) for scoring and display."""
    booking = {}
    for field in row.index:
        value = row[field]
        booking[field] = decode_value(field, value) if field in CATEGORY_MAPS else float(value)
    return booking


def risk_drivers(row, supplied_fields, booking_probability):
    """How much each entered value moves the risk compared with a typical booking.

    For every field that differs from the typical booking, average two views:
      - remove it: this booking with that one field put back to typical
      - add it:    the typical booking with only that field changed
    Averaging keeps the impact meaningful when the risk is already near 0% or 100%,
    where removing a single factor alone would barely move the number.
    """
    changed = [f for f in supplied_fields if row[f] != medians[f]]
    if not changed:
        return []
    removed = pd.DataFrame([row] * len(changed))
    added = pd.DataFrame([medians] * len(changed))
    for i, field in enumerate(changed):
        removed.iloc[i, removed.columns.get_loc(field)] = medians[field]
        added.iloc[i, added.columns.get_loc(field)] = row[field]
    scored = cancel_probability(pd.concat([removed, added, pd.DataFrame([medians])], ignore_index=True))
    n = len(changed)
    p_removed, p_added, p_typical = scored[:n], scored[n:2 * n], scored[-1]
    drivers = [
        {
            "field": field,
            "label": INPUT_FIELDS[field][2],
            "value": decode_value(field, row[field]),
            "typical": decode_value(field, medians[field]),
            "impact": round(((booking_probability - p_rem) + (p_add - p_typical)) / 2 * 100, 1),
        }
        for field, p_rem, p_add in zip(changed, p_removed, p_added)
    ]
    drivers = [d for d in drivers if abs(d["impact"]) >= 0.5]
    return sorted(drivers, key=lambda d: abs(d["impact"]), reverse=True)[:6]


def model_missing():
    return jsonify({"status": "error", "error": "Model not loaded. Run 'python train_model.py'."}), 503


@app.route("/health")
def health():
    return jsonify({"status": "ok" if model is not None else "model-missing",
                    "model": stats["model"]["selected"] if stats else None})


@app.route("/stats")
def get_stats():
    if stats is None:
        return model_missing()
    return jsonify(stats)


@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return model_missing()
    ui_data = request.get_json(silent=True)
    try:
        row = build_row(ui_data)
    except InputError as e:
        return jsonify({"status": "error", "error": str(e), "fields": e.errors}), 400

    p_cancel = float(cancel_probability(pd.DataFrame([row]))[0])
    prediction_id = int(p_cancel >= 0.5)
    risk = round(p_cancel * 100, 2)
    booking = readable_booking(row)
    supplied = [f for f in INPUT_FIELDS if ui_data.get(f) not in (None, "")]

    return jsonify({
        "status": "success",
        "outcome": CLASS_MAPPING[prediction_id],
        "probabilities": {"Confirmed": round(100 - risk, 2), "Cancelled": risk},
        "risk_level": risk_level(risk),
        "drivers": risk_drivers(row, supplied, p_cancel),
        "tips": recommendations(booking, risk),
        "guest": guest_experience(booking, risk),
        "booking": {f: decode_value(f, row[f]) for f in INPUT_FIELDS},
    })


@app.route("/predict/batch", methods=["POST"])
def predict_batch():
    if model is None:
        return model_missing()
    payload = request.get_json(silent=True) or {}
    bookings = payload.get("bookings")
    if not isinstance(bookings, list) or not bookings:
        return jsonify({"status": "error", "error": "Send {\"bookings\": [ ... ]} with at least one row"}), 400
    if len(bookings) > MAX_BATCH_ROWS:
        return jsonify({"status": "error", "error": f"At most {MAX_BATCH_ROWS} bookings per upload"}), 400

    results, valid_rows, valid_index = [], [], []
    for i, item in enumerate(bookings):
        try:
            valid_rows.append(build_row(item))
            valid_index.append(i)
            results.append(None)
        except InputError as e:
            results.append({"row": i + 1, "status": "error", "error": "; ".join(e.errors.values())})

    if valid_rows:
        probabilities = cancel_probability(pd.DataFrame(valid_rows))
        for i, row, p in zip(valid_index, valid_rows, probabilities):
            risk = round(float(p) * 100, 2)
            booking = readable_booking(row)
            guest = guest_experience(booking, risk)
            results[i] = {
                "row": i + 1,
                "status": "success",
                "outcome": CLASS_MAPPING[int(p >= 0.5)],
                "cancel_probability": risk,
                "risk_level": risk_level(risk),
                "satisfaction": guest["satisfaction"],
                "repeat_likelihood": guest["repeat_likelihood"],
                "booking": {f: decode_value(f, row[f]) for f in CORE_FIELDS},
            }

    scored = [r for r in results if r["status"] == "success"]
    return jsonify({
        "status": "success",
        "total": len(results),
        "scored": len(scored),
        "high_risk": sum(r["risk_level"] == "High" for r in scored),
        "results": results,
    })


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def frontend(path):
    """Serve the built React app when it exists (single-command mode)."""
    if not (FRONTEND_DIST / "index.html").exists():
        return "API is running. Start the frontend with 'npm run dev' in the frontend folder.", 200
    if path and (FRONTEND_DIST / path).is_file():
        return send_from_directory(FRONTEND_DIST, path)
    return send_from_directory(FRONTEND_DIST, "index.html")


if __name__ == "__main__":
    app.run(port=5000, debug=True)
