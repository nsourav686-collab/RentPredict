import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split

from training import optimize_model


def run_case(name, numeric_cols, categorical_cols):
    optimize_model.NUMERIC_COLS = numeric_cols
    optimize_model.CATEGORICAL_COLS = categorical_cols

    data = optimize_model.apply_outlier_method(
        optimize_model.load_and_engineer(),
        "percentile_02_97",
    )
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
    pipeline = optimize_model.make_pipeline(model, "target")
    y_train_log = np.log1p(y_train)
    y_test_log = np.log1p(y_test)
    pipeline.fit(X_train, y_train_log)
    pred_log = pipeline.predict(X_test)
    pred = np.expm1(pred_log)

    print(
        f"{name}: R2={r2_score(y_test_log, pred_log):.4f} "
        f"MAE=Rs.{mean_absolute_error(y_test, pred):,.0f} "
        f"RMSE=Rs.{np.sqrt(mean_squared_error(y_test, pred)):,.0f} "
        f"MAPE={np.mean(np.abs((y_test - pred) / y_test)) * 100:.2f}%"
    )


full_numeric = [
    "BHK",
    "Size",
    "Bathroom",
    "Current Floor",
    "Total Floors",
    "Room_ratio",
    "Size_per_room",
    "Bath_per_bhk",
    "Log_size",
]
full_categorical = [
    "Area Type",
    "Area Locality",
    "City",
    "Furnishing Status",
    "Tenant Preferred",
    "Point of Contact",
]
reduced_numeric = [
    "BHK",
    "Size",
    "Bathroom",
    "Current Floor",
    "Total Floors",
    "Size_per_room",
    "Log_size",
]
reduced_categorical = [
    "Area Locality",
    "City",
    "Furnishing Status",
    "Point of Contact",
]

run_case("Full features", full_numeric, full_categorical)
run_case("Reduced features", reduced_numeric, reduced_categorical)
