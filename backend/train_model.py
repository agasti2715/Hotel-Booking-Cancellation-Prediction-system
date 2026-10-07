"""Train the hotel booking cancellation model.

Steps: load the dataset -> clean it -> encode categories -> split 80/20 ->
scale with StandardScaler -> train three candidate models -> keep the best ->
save the model, scaler, baseline values and dashboard statistics.

Run:  python train_model.py
Output (in backend/model/):
    booking_cancellation_model.pkl   the chosen classifier
    scaler.pkl                       StandardScaler fitted on the training split
    training_medians.pkl             baseline value for every feature
    model_stats.json                 dataset + model metrics for the dashboard
"""

import json
import time
import urllib.request
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from features import CATEGORY_MAPS, INPUT_FIELDS, MODEL_FEATURES, MONTHS
from insights import satisfaction_score

BASE = Path(__file__).parent
DATA_FILE = BASE / "data" / "hotels.csv"
MODEL_DIR = BASE / "model"
# Public mirror of the Kaggle "Hotel booking demand" dataset (Antonio, Almeida & Nunes, 2019).
DATA_URL = "https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2020/2020-02-11/hotels.csv"

# Directions that are clear in the data: +1 means risk can only rise as the value rises,
# -1 means it can only fall. Without these, the model reacts erratically to inputs it saw
# rarely (e.g. 2 special requests scoring riskier than 1).
MONOTONIC = {
    "lead_time": 1,
    "previous_cancellations": 1,
    "total_of_special_requests": -1,
    "is_repeated_guest": -1,
    "previous_bookings_not_canceled": -1,
    "required_car_parking_spaces": -1,
    "booking_changes": -1,
}


def load_data():
    if not DATA_FILE.exists():
        print(f"Dataset not found, downloading from {DATA_URL} ...")
        DATA_FILE.parent.mkdir(exist_ok=True)
        urllib.request.urlretrieve(DATA_URL, DATA_FILE)
    return pd.read_csv(DATA_FILE)


def clean(df):
    raw_rows = len(df)
    df = df.copy()
    df["children"] = df["children"].fillna(0)
    # Bookings with no guests, negative prices or the single 5,400 ADR outlier are data errors.
    df = df[(df["adults"] + df["children"] + df["babies"]) > 0]
    df = df[(df["adr"] >= 0) & (df["adr"] <= 1000)]
    print(f"Cleaning: {raw_rows:,} rows -> {len(df):,} valid bookings")
    return df


def encode(df):
    out = pd.DataFrame(index=df.index)
    for col in MODEL_FEATURES:
        if col in CATEGORY_MAPS:
            out[col] = df[col].map(CATEGORY_MAPS[col])
            unknown = out[col].isna().sum()
            if unknown:
                raise ValueError(f"{unknown} rows in '{col}' have a category missing from CATEGORY_MAPS")
        elif col == "arrival_date_month":
            out[col] = df[col].map({m: i + 1 for i, m in enumerate(MONTHS)})
        else:
            out[col] = df[col]
    return out.astype(float)


def baseline_values(X):
    """Typical booking: median for numbers, most common value for categories."""
    base = X.median()
    for col in list(CATEGORY_MAPS) + ["is_repeated_guest", "arrival_date_month"]:
        base[col] = X[col].mode()[0]
    return base


def metrics(y_true, y_pred, y_prob):
    return {
        "accuracy": round(accuracy_score(y_true, y_pred) * 100, 2),
        "precision": round(precision_score(y_true, y_pred) * 100, 2),
        "recall": round(recall_score(y_true, y_pred) * 100, 2),
        "f1": round(f1_score(y_true, y_pred) * 100, 2),
        "roc_auc": round(roc_auc_score(y_true, y_prob) * 100, 2),
    }


def rate_table(df, column, order=None):
    grouped = df.groupby(column, observed=True)["is_canceled"].agg(["count", "mean"])
    if order is not None:
        grouped = grouped.reindex([o for o in order if o in grouped.index])
    return [
        {"label": str(label), "bookings": int(row["count"]), "cancel_rate": round(row["mean"] * 100, 1)}
        for label, row in grouped.iterrows()
    ]


def dataset_stats(df):
    lead_bins = [-1, 7, 30, 90, 180, 365, 10_000]
    lead_labels = ["0-7 days", "8-30 days", "31-90 days", "91-180 days", "181-365 days", "365+ days"]
    df = df.assign(
        lead_bucket=pd.cut(df["lead_time"], bins=lead_bins, labels=lead_labels),
        requests=df["total_of_special_requests"].clip(upper=3).map(lambda n: "3+" if n == 3 else str(n)),
        guest=df["is_repeated_guest"].map({0: "First-time guest", 1: "Repeated guest"}),
    )

    # Guest satisfaction comparison: average experience score per customer type,
    # using the same formula the API uses for single bookings.
    sample = df.sample(min(len(df), 20_000), random_state=42)
    sample_scores = sample.apply(lambda r: satisfaction_score(r.to_dict()), axis=1)
    satisfaction = (
        sample.assign(score=sample_scores)
        .groupby("customer_type")["score"]
        .mean()
        .round(1)
        .sort_values(ascending=False)
    )

    return {
        "total_bookings": int(len(df)),
        "cancelled": int(df["is_canceled"].sum()),
        "cancel_rate": round(df["is_canceled"].mean() * 100, 1),
        "avg_lead_time": round(df["lead_time"].mean(), 1),
        "avg_adr": round(df["adr"].mean(), 2),
        "by_hotel": rate_table(df, "hotel"),
        "by_deposit": rate_table(df, "deposit_type", list(CATEGORY_MAPS["deposit_type"])),
        "by_lead_time": rate_table(df, "lead_bucket", lead_labels),
        "by_special_requests": rate_table(df, "requests", ["0", "1", "2", "3+"]),
        "by_market_segment": [
            r for r in rate_table(df, "market_segment", list(CATEGORY_MAPS["market_segment"])) if r["bookings"] > 200
        ],
        "by_month": rate_table(df, "arrival_date_month", MONTHS),
        "by_guest_type": rate_table(df, "guest", ["First-time guest", "Repeated guest"]),
        "satisfaction_by_customer_type": [
            {"label": label, "score": float(score)} for label, score in satisfaction.items()
        ],
    }


def main():
    started = time.time()
    df = clean(load_data())
    # Identical rows (often one group booking split into rooms) would land on both sides of the
    # train/test split and inflate the scores, so the model learns from unique rows only.
    # The dashboard still counts every real booking.
    unique = df.drop_duplicates()
    print(f"Training on {len(unique):,} unique bookings")
    X = encode(unique)
    y = unique["is_canceled"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    scaler = StandardScaler().fit(X_train)
    X_train_s = pd.DataFrame(scaler.transform(X_train), columns=MODEL_FEATURES)
    X_test_s = pd.DataFrame(scaler.transform(X_test), columns=MODEL_FEATURES)

    candidates = {
        "Logistic Regression": LogisticRegression(max_iter=1000),
        "Random Forest": RandomForestClassifier(
            n_estimators=120, max_depth=18, min_samples_leaf=3, n_jobs=-1, random_state=42
        ),
        "Gradient Boosting": HistGradientBoostingClassifier(
            max_iter=400,
            learning_rate=0.1,
            max_leaf_nodes=63,
            monotonic_cst=MONOTONIC,
            random_state=42,
        ),
    }

    results, fitted = [], {}
    for name, model in candidates.items():
        t0 = time.time()
        model.fit(X_train_s, y_train)
        prob = model.predict_proba(X_test_s)[:, 1]
        scores = metrics(y_test, (prob >= 0.5).astype(int), prob)
        scores["name"] = name
        scores["train_seconds"] = round(time.time() - t0, 1)
        results.append(scores)
        fitted[name] = model
        print(f"{name:<20} accuracy {scores['accuracy']}%  F1 {scores['f1']}%  ROC-AUC {scores['roc_auc']}%")

    # Only ~27% of unique bookings cancel, so accuracy alone flatters a model that rarely predicts
    # "cancel". F1 balances catching cancellations (recall) against false alarms (precision).
    best = max(results, key=lambda r: r["f1"])
    model = fitted[best["name"]]
    print(f"Selected: {best['name']}")

    prob = model.predict_proba(X_test_s)[:, 1]
    cm = confusion_matrix(y_test, (prob >= 0.5).astype(int))

    # Permutation importance works for any model type, so the dashboard can show it whichever model wins.
    sample_idx = np.random.RandomState(42).choice(len(X_test_s), size=min(6000, len(X_test_s)), replace=False)
    imp = permutation_importance(
        model, X_test_s.iloc[sample_idx], y_test.iloc[sample_idx], scoring="roc_auc", n_repeats=3, random_state=42
    )
    labels = {f: INPUT_FIELDS[f][2] if f in INPUT_FIELDS else f.replace("_", " ").capitalize() for f in MODEL_FEATURES}
    importance = sorted(
        ({"feature": labels[f], "importance": round(float(v) * 100, 2)} for f, v in zip(MODEL_FEATURES, imp.importances_mean)),
        key=lambda r: r["importance"],
        reverse=True,
    )[:10]

    MODEL_DIR.mkdir(exist_ok=True)
    joblib.dump(model, MODEL_DIR / "booking_cancellation_model.pkl", compress=3)
    joblib.dump(scaler, MODEL_DIR / "scaler.pkl")
    joblib.dump(baseline_values(X_train), MODEL_DIR / "training_medians.pkl")

    stats = {
        "dataset": dataset_stats(df),
        "model": {
            "selected": best["name"],
            "unique_rows": int(len(unique)),
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
            "features": len(MODEL_FEATURES),
            "comparison": results,
            "confusion_matrix": {
                "true_confirmed": int(cm[0][0]),
                "false_cancelled": int(cm[0][1]),
                "false_confirmed": int(cm[1][0]),
                "true_cancelled": int(cm[1][1]),
            },
            "feature_importance": importance,
            "trained_at": time.strftime("%Y-%m-%d %H:%M"),
        },
    }
    (MODEL_DIR / "model_stats.json").write_text(json.dumps(stats, indent=2))

    size_mb = (MODEL_DIR / "booking_cancellation_model.pkl").stat().st_size / 1_048_576
    print(f"Saved artifacts to {MODEL_DIR} (model {size_mb:.1f} MB) in {time.time() - started:.0f}s")


if __name__ == "__main__":
    main()
