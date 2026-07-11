import json
import pickle

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import cross_val_score, train_test_split

from training.optimize_model import (
    BEST_ARTIFACT_PATH,
    RANDOM_STATE,
    REPORT_PATH,
    TARGET_COL,
    apply_outlier_method,
    inverse_target,
    load_and_engineer,
    make_pipeline,
    target_values,
)


OUTLIER_METHOD = "percentile_02_97"
ENCODING = "target"
LOG_TARGET = True
NUMERIC_COLS = [
    "BHK",
    "Size",
    "Bathroom",
    "Current Floor",
    "Total Floors",
    "Size_per_room",
    "Log_size",
]
CATEGORICAL_COLS = [
    "Area Locality",
    "City",
    "Furnishing Status",
    "Point of Contact",
]

from training import optimize_model

optimize_model.NUMERIC_COLS = NUMERIC_COLS
optimize_model.CATEGORICAL_COLS = CATEGORICAL_COLS

data = apply_outlier_method(load_and_engineer(), OUTLIER_METHOD)
X = data.drop(columns=[TARGET_COL])
y = data[TARGET_COL]
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=RANDOM_STATE
)

model = GradientBoostingRegressor(
    n_estimators=1000,
    learning_rate=0.025,
    max_depth=4,
    subsample=0.8,
    min_samples_split=4,
    min_samples_leaf=3,
    max_features=0.9,
    random_state=RANDOM_STATE,
)
pipeline = make_pipeline(model, ENCODING)
y_train_model = target_values(y_train, LOG_TARGET)
y_test_model = target_values(y_test, LOG_TARGET)

pipeline.fit(X_train, y_train_model)
pred = pipeline.predict(X_test)
pred_actual = inverse_target(pred, LOG_TARGET)

metrics = {
    "name": "Optimized GradientBoosting Reduced Features",
    "model_name": "GradientBoosting",
    "encoding": ENCODING,
    "outlier_method": OUTLIER_METHOD,
    "log_target": LOG_TARGET,
    "r2": float(r2_score(y_test_model, pred)),
    "mae": float(mean_absolute_error(y_test, pred_actual)),
    "rmse": float(np.sqrt(mean_squared_error(y_test, pred_actual))),
    "mape": float(np.mean(np.abs((y_test - pred_actual) / y_test)) * 100),
    "cv5_r2": float(cross_val_score(pipeline, X_train, y_train_model, cv=5, scoring="r2").mean()),
    "cv10_r2": float(cross_val_score(pipeline, X_train, y_train_model, cv=10, scoring="r2").mean()),
}

feature_importance = []
feature_names = NUMERIC_COLS + CATEGORICAL_COLS
for feature, importance in zip(feature_names, pipeline.named_steps["model"].feature_importances_):
    feature_importance.append({"feature": feature, "importance": float(importance)})
feature_importance = sorted(feature_importance, key=lambda item: item["importance"], reverse=True)

artifact = {
    "model": pipeline,
    "feature_columns": list(X.columns),
    "numeric_columns": NUMERIC_COLS,
    "categorical_columns": CATEGORICAL_COLS,
    "target_column": TARGET_COL,
    "outlier_method": OUTLIER_METHOD,
    "log_target": LOG_TARGET,
    "metrics": metrics,
    "feature_importance": feature_importance,
}

with BEST_ARTIFACT_PATH.open("wb") as file:
    pickle.dump(artifact, file)

with REPORT_PATH.open(encoding="utf-8") as file:
    report = json.load(file)

report["best_model"] = metrics
report["feature_importance"] = feature_importance

with REPORT_PATH.open("w", encoding="utf-8") as file:
    json.dump(report, file, indent=2)

print(f"Best model R2          : {metrics['r2']:.4f}")
print(f"Best model MAE         : Rs.{metrics['mae']:,.0f}")
print(f"Best model RMSE        : Rs.{metrics['rmse']:,.0f}")
print(f"Best model MAPE        : {metrics['mape']:.2f}%")
print(f"Best model 5-fold CV R2 : {metrics['cv5_r2']:.4f}")
print(f"Best model 10-fold CV R2: {metrics['cv10_r2']:.4f}")
