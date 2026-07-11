"""
Run cross-validation for the optimized rent prediction model.

Use this file when you want to check cross validation directly:
    python -m training.check_cross_validation
"""

import pickle

import numpy as np
from sklearn.base import clone
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, train_test_split

from training import optimize_model


def run_cross_validation(n_splits):
    with optimize_model.BEST_ARTIFACT_PATH.open("rb") as file:
        artifact = pickle.load(file)

    optimize_model.NUMERIC_COLS = artifact["numeric_columns"]
    optimize_model.CATEGORICAL_COLS = artifact["categorical_columns"]

    data = optimize_model.apply_outlier_method(
        optimize_model.load_and_engineer(),
        artifact["outlier_method"],
    )
    X = data.drop(columns=[optimize_model.TARGET_COL])
    y = data[optimize_model.TARGET_COL]

    X_train, _, y_train, _ = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=optimize_model.RANDOM_STATE,
    )

    y_train_model = optimize_model.target_values(y_train, artifact["log_target"])
    kfold = KFold(
        n_splits=n_splits,
        shuffle=True,
        random_state=optimize_model.RANDOM_STATE,
    )

    fold_rows = []
    for fold, (train_index, valid_index) in enumerate(kfold.split(X_train), start=1):
        X_fold_train = X_train.iloc[train_index]
        X_fold_valid = X_train.iloc[valid_index]
        y_fold_train = y_train_model.iloc[train_index]
        y_fold_valid = y_train_model.iloc[valid_index]
        y_fold_valid_actual = y_train.iloc[valid_index]

        fold_model = clone(artifact["model"])
        fold_model.fit(X_fold_train[artifact["feature_columns"]], y_fold_train)

        pred_model = fold_model.predict(X_fold_valid[artifact["feature_columns"]])
        pred_actual = optimize_model.inverse_target(pred_model, artifact["log_target"])

        fold_rows.append(
            {
                "fold": fold,
                "r2": r2_score(y_fold_valid, pred_model),
                "mae": mean_absolute_error(y_fold_valid_actual, pred_actual),
                "rmse": np.sqrt(mean_squared_error(y_fold_valid_actual, pred_actual)),
                "mape": np.mean(
                    np.abs((y_fold_valid_actual - pred_actual) / y_fold_valid_actual)
                )
                * 100,
            }
        )

    return fold_rows


def print_cv_report(n_splits):
    rows = run_cross_validation(n_splits)
    print(f"\n{n_splits}-Fold Cross Validation")
    print("-" * 72)
    print(f"{'Fold':>4} {'R2':>8} {'MAE':>12} {'RMSE':>12} {'MAPE':>10}")
    print("-" * 72)
    for row in rows:
        print(
            f"{row['fold']:>4} "
            f"{row['r2']:>8.4f} "
            f"Rs.{row['mae']:>8,.0f} "
            f"Rs.{row['rmse']:>8,.0f} "
            f"{row['mape']:>9.2f}%"
        )

    print("-" * 72)
    print(f"Mean R2  : {np.mean([row['r2'] for row in rows]):.4f}")
    print(f"Std R2   : {np.std([row['r2'] for row in rows]):.4f}")
    print(f"Mean MAE : Rs.{np.mean([row['mae'] for row in rows]):,.0f}")
    print(f"Mean RMSE: Rs.{np.mean([row['rmse'] for row in rows]):,.0f}")
    print(f"Mean MAPE: {np.mean([row['mape'] for row in rows]):.2f}%")


if __name__ == "__main__":
    print("=" * 72)
    print("                  OPTIMIZED MODEL CROSS VALIDATION")
    print("=" * 72)
    print_cv_report(5)
    print_cv_report(10)
