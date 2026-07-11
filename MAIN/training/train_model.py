"""
Train and save the final optimized rent prediction model.

For the full experiment history, run ``python -m training.optimize_model``. This production training
script uses the best configuration found during optimization:
- Percentile-based Rent outlier handling: 2nd to 97th percentile.
- Parsed numerical Floor features.
- Log-transformed Rent target.
- Target encoding for high-cardinality categorical columns.
- Reduced feature set selected from feature importance testing.
"""

import json
import pickle

import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score, train_test_split

from training import optimize_model


OUTLIER_METHOD = "percentile_02_97"
ENCODING = "target"
LOG_TARGET = True

# Final selected features. Removing the lowest-importance features slightly
# improved MAE, MAPE, and R2 while keeping RMSE below the original baseline.
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


def set_selected_features():
    optimize_model.NUMERIC_COLS = NUMERIC_COLS
    optimize_model.CATEGORICAL_COLS = CATEGORICAL_COLS


def model_metrics(y_true, y_true_model, y_pred_model):
    y_pred = optimize_model.inverse_target(y_pred_model, LOG_TARGET)
    return {
        "r2": float(r2_score(y_true_model, y_pred_model)),
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "mape": float(np.mean(np.abs((y_true - y_pred) / y_true)) * 100),
    }


def rating_for_r2(r2_value):
    if r2_value >= 0.85:
        return "EXCELLENT"
    if r2_value >= 0.80:
        return "VERY GOOD"
    if r2_value >= 0.70:
        return "GOOD"
    return "NEEDS IMPROVEMENT"


def load_training_data_with_report():
    raw_data = pd.read_csv(optimize_model.DATA_PATH)
    print(f"\nDataset loaded : {raw_data.shape}")

    engineered_data = optimize_model.load_and_engineer()
    low = engineered_data[optimize_model.TARGET_COL].quantile(0.02)
    high = engineered_data[optimize_model.TARGET_COL].quantile(0.97)
    cleaned_data = engineered_data[
        (engineered_data[optimize_model.TARGET_COL] >= low)
        & (engineered_data[optimize_model.TARGET_COL] <= high)
    ].copy()
    print(f"After cleaning  : {cleaned_data.shape}")

    locality_counts = cleaned_data["Area Locality"].value_counts()
    valid_localities = locality_counts[locality_counts >= 4].index
    data = cleaned_data[cleaned_data["Area Locality"].isin(valid_localities)].copy()
    print(f"After locality filter : {data.shape}")
    print(f"   Unique localities  : {data['Area Locality'].nunique()}")

    return data


def cross_validation_report(pipeline, X_train, y_train, log_target):
    y_train_model = optimize_model.target_values(y_train, log_target)
    kfold = KFold(n_splits=5, shuffle=True, random_state=optimize_model.RANDOM_STATE)
    fold_scores = []
    fold_predictions = pd.Series(index=y_train.index, dtype=float)

    for train_index, valid_index in kfold.split(X_train):
        fold_model = clone(pipeline)
        fold_X_train = X_train.iloc[train_index]
        fold_X_valid = X_train.iloc[valid_index]
        fold_y_train = y_train_model.iloc[train_index]
        fold_y_valid = y_train_model.iloc[valid_index]

        fold_model.fit(fold_X_train, fold_y_train)
        fold_pred = fold_model.predict(fold_X_valid)
        fold_predictions.iloc[valid_index] = fold_pred
        fold_scores.append(r2_score(fold_y_valid, fold_pred))

    cv_pred_actual = optimize_model.inverse_target(fold_predictions, log_target)
    return {
        "scores": fold_scores,
        "mean_r2": float(np.mean(fold_scores)),
        "std_r2": float(np.std(fold_scores)),
        "mae": float(mean_absolute_error(y_train, cv_pred_actual)),
        "rmse": float(np.sqrt(mean_squared_error(y_train, cv_pred_actual))),
        "mape": float(np.mean(np.abs((y_train - cv_pred_actual) / y_train)) * 100),
    }


def train_and_save():
    optimize_model.MODEL_DIR.mkdir(exist_ok=True)
    optimize_model.REPORT_DIR.mkdir(exist_ok=True)
    set_selected_features()
    data = load_training_data_with_report()
    X = data.drop(columns=[optimize_model.TARGET_COL])
    y = data[optimize_model.TARGET_COL]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=optimize_model.RANDOM_STATE
    )

    model = GradientBoostingRegressor(
        n_estimators=1000,
        learning_rate=0.025,
        max_depth=4,
        subsample=0.8,
        min_samples_split=4,
        min_samples_leaf=3,
        max_features=0.9,
        random_state=optimize_model.RANDOM_STATE,
    )
    pipeline = optimize_model.make_pipeline(model, ENCODING)
    y_train_model = optimize_model.target_values(y_train, LOG_TARGET)
    y_test_model = optimize_model.target_values(y_test, LOG_TARGET)

    print("Encoding and target-stat features prepared!")
    print(f"\nFeatures ({len(NUMERIC_COLS + CATEGORICAL_COLS)}) : {NUMERIC_COLS + CATEGORICAL_COLS}")
    print(f"   Total samples : {len(data)}")
    print("\nData split:")
    print(f"   Training samples : {len(X_train)} ({len(X_train) / len(data):.0%})")
    print(f"   Testing samples  : {len(X_test)} ({len(X_test) / len(data):.0%})")

    print("\nRunning 5-fold cross validation on the training data...")
    cv_report = cross_validation_report(pipeline, X_train, y_train, LOG_TARGET)

    print("\nCross-validation performance:")
    print(f"   R2 scores    : {', '.join(f'{score:.4f}' for score in cv_report['scores'])}")
    print(f"   Mean R2      : {cv_report['mean_r2']:.4f}")
    print(f"   Std R2       : {cv_report['std_r2']:.4f}")
    print(f"   MAE          : Rs.{cv_report['mae']:,.0f}")
    print(f"   RMSE         : Rs.{cv_report['rmse']:,.0f}")
    print(f"   MAPE         : {cv_report['mape']:.2f}%")

    print("\nTraining final model on the 80% training split...")
    pipeline.fit(X_train, y_train_model)
    print("Model trained!")

    y_pred_model = pipeline.predict(X_test)
    metrics = model_metrics(y_test, y_test_model, y_pred_model)
    cv5 = KFold(n_splits=5, shuffle=True, random_state=optimize_model.RANDOM_STATE)
    cv10 = KFold(n_splits=10, shuffle=True, random_state=optimize_model.RANDOM_STATE)

    metrics.update(
        {
            "name": "Optimized GradientBoosting Reduced Features",
            "model_name": "GradientBoosting",
            "encoding": ENCODING,
            "outlier_method": OUTLIER_METHOD,
            "log_target": LOG_TARGET,
            "cv5_r2": cv_report["mean_r2"],
            "cv10_r2": float(
                cross_val_score(pipeline, X_train, y_train_model, cv=cv10, scoring="r2").mean()
            ),
        }
    )

    feature_importance = sorted(
        [
            {"feature": feature, "importance": float(importance)}
            for feature, importance in zip(
                NUMERIC_COLS + CATEGORICAL_COLS,
                pipeline.named_steps["model"].feature_importances_,
            )
        ],
        key=lambda item: item["importance"],
        reverse=True,
    )

    artifact = {
        "model": pipeline,
        "feature_columns": list(X.columns),
        "numeric_columns": NUMERIC_COLS,
        "categorical_columns": CATEGORICAL_COLS,
        "target_column": optimize_model.TARGET_COL,
        "outlier_method": OUTLIER_METHOD,
        "log_target": LOG_TARGET,
        "metrics": metrics,
        "feature_importance": feature_importance,
    }

    with optimize_model.BEST_ARTIFACT_PATH.open("wb") as file:
        pickle.dump(artifact, file)

    report = {
        "best_model": metrics,
        "feature_importance": feature_importance,
    }
    with (optimize_model.REPORT_DIR / "model_training_report.json").open("w", encoding="utf-8") as file:
        json.dump(report, file, indent=2)

    return metrics, feature_importance, len(X_train), len(X_test)


if __name__ == "__main__":
    print("=" * 45)
    print("  OPTIMIZED RENT MODEL TRAINING REPORT")
    print("=" * 45)
    metrics, feature_importance, train_count, test_count = train_and_save()

    print("\nTest-set performance:")
    print(f"   R2 Score    : {metrics['r2']:.4f}")
    print(f"   MAE         : Rs.{metrics['mae']:,.0f}")
    print(f"   RMSE        : Rs.{metrics['rmse']:,.0f}")
    print(f"   MAPE        : {metrics['mape']:.2f}%")
    print(f"   Rating      : {rating_for_r2(metrics['r2'])}")

    print("\nAll files saved!")
