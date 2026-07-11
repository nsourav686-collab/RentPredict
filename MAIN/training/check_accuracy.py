"""
Evaluate the saved optimized rent prediction model.

Run ``python -m training.train_model`` first if optimized_rent_model.pkl is missing or stale.
"""

import pickle

import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

from training import optimize_model


def evaluate_saved_model():
    with optimize_model.BEST_ARTIFACT_PATH.open("rb") as file:
        artifact = pickle.load(file)

    # Keep the evaluator aligned with the selected feature subset inside the
    # saved artifact before rebuilding the cleaned test split.
    optimize_model.NUMERIC_COLS = artifact["numeric_columns"]
    optimize_model.CATEGORICAL_COLS = artifact["categorical_columns"]

    data = optimize_model.apply_outlier_method(
        optimize_model.load_and_engineer(),
        artifact["outlier_method"],
    )
    X = data.drop(columns=[optimize_model.TARGET_COL])
    y = data[optimize_model.TARGET_COL]
    _, X_test, _, y_test = train_test_split(
        X, y, test_size=0.2, random_state=optimize_model.RANDOM_STATE
    )

    y_test_model = optimize_model.target_values(y_test, artifact["log_target"])
    y_pred_model = artifact["model"].predict(X_test[artifact["feature_columns"]])
    y_pred = optimize_model.inverse_target(y_pred_model, artifact["log_target"])

    metrics = {
        "r2": r2_score(y_test_model, y_pred_model),
        "mae": mean_absolute_error(y_test, y_pred),
        "rmse": np.sqrt(mean_squared_error(y_test, y_pred)),
        "mape": np.mean(np.abs((y_test - y_pred) / y_test)) * 100,
    }
    return artifact, metrics, y_test, y_pred


if __name__ == "__main__":
    artifact, metrics, y_test, y_pred = evaluate_saved_model()

    print("=" * 45)
    print("       OPTIMIZED MODEL ACCURACY REPORT")
    print("=" * 45)
    print(f"\nModel             : {artifact['metrics']['name']}")
    print(f"Encoding          : {artifact['metrics']['encoding']}")
    print(f"Outlier method    : {artifact['metrics']['outlier_method']}")
    print(f"Log target        : {artifact['metrics']['log_target']}")
    print(f"5-Fold CV R2      : {artifact['metrics']['cv5_r2']:.4f}")
    print(f"10-Fold CV R2     : {artifact['metrics']['cv10_r2']:.4f}")

    print("\nTest-set performance:")
    print(f"R2 Score          : {metrics['r2']:.4f}")
    print(f"MAE               : Rs.{metrics['mae']:,.0f}")
    print(f"RMSE              : Rs.{metrics['rmse']:,.0f}")
    print(f"MAPE              : {metrics['mape']:.2f}%")

    print("\nTop feature importances:")
    for row in artifact["feature_importance"][:10]:
        print(f"{row['feature']:24} {row['importance']:.4f}")

    print("\nSample Predictions vs Actual:")
    print(f"{'Actual':>10} {'Predicted':>12} {'Error':>10}")
    print("-" * 35)
    for actual, predicted in zip(y_test.values[:8], y_pred[:8]):
        print(f"Rs.{actual:>8,.0f}  Rs.{predicted:>8,.0f}  Rs.{abs(actual - predicted):>6,.0f}")
