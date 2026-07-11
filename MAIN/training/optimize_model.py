"""
Complete model optimization workflow for the house rent prediction project.

This script:
1. Performs EDA.
2. Compares outlier strategies.
3. Extracts numerical floor features.
4. Compares raw Rent vs log-transformed Rent.
5. Compares Label, One-Hot, Frequency, and Target Encoding.
6. Tunes Gradient Boosting with RandomizedSearchCV.
7. Compares Gradient Boosting, Random Forest, XGBoost, and CatBoost.
8. Runs 5-fold and 10-fold CV for the best model.
9. Saves the best production artifact.
"""

from __future__ import annotations

import json
import pickle
import re
import warnings
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin, clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import (
    KFold,
    RandomizedSearchCV,
    cross_val_score,
    train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, OrdinalEncoder

warnings.filterwarnings("ignore")

try:
    from xgboost import XGBRegressor
except Exception:
    XGBRegressor = None

try:
    from catboost import CatBoostRegressor
except Exception:
    CatBoostRegressor = None


RANDOM_STATE = 42
PROJECT_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = PROJECT_DIR / "dataset" / "House_Rent_Dataset.csv"
REPORT_DIR = PROJECT_DIR / "reports"
REPORT_PATH = REPORT_DIR / "model_optimization_report.json"
MODEL_DIR = PROJECT_DIR / "models"
BEST_ARTIFACT_PATH = MODEL_DIR / "optimized_rent_model.pkl"

NUMERIC_COLS = [
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
CATEGORICAL_COLS = [
    "Area Type",
    "Area Locality",
    "City",
    "Furnishing Status",
    "Tenant Preferred",
    "Point of Contact",
]
TARGET_COL = "Rent"


@dataclass
class ExperimentResult:
    name: str
    model_name: str
    encoding: str
    outlier_method: str
    log_target: bool
    r2: float
    mae: float
    rmse: float
    mape: float
    cv5_r2: float | None = None
    cv10_r2: float | None = None

    def as_dict(self) -> dict:
        return self.__dict__.copy()


def parse_floor(value) -> tuple[float, float]:
    """Extract current floor and total floors from values like '3 out of 5'."""
    text = str(value).strip().lower()
    if not text or text == "nan":
        return np.nan, np.nan

    total_match = re.search(r"out of\s+(\d+)", text)
    total_floor = float(total_match.group(1)) if total_match else np.nan

    first_part = text.split("out of")[0].strip()
    if "ground" in first_part:
        current_floor = 0.0
    elif "upper basement" in first_part:
        current_floor = -1.0
    elif "lower basement" in first_part:
        current_floor = -2.0
    else:
        current_match = re.search(r"-?\d+", first_part)
        current_floor = float(current_match.group(0)) if current_match else np.nan

    return current_floor, total_floor


def load_and_engineer() -> pd.DataFrame:
    data = pd.read_csv(DATA_PATH)
    floor_parts = data["Floor"].apply(parse_floor)
    data["Current Floor"] = floor_parts.apply(lambda item: item[0])
    data["Total Floors"] = floor_parts.apply(lambda item: item[1])
    data["Current Floor"] = data["Current Floor"].fillna(data["Current Floor"].median())
    data["Total Floors"] = data["Total Floors"].fillna(data["Total Floors"].median())

    keep_cols = NUMERIC_COLS[:5] + CATEGORICAL_COLS + [TARGET_COL]
    data = data[keep_cols].dropna()

    data = data[(data["Size"] >= 200) & (data["Size"] <= 8000)]
    data = data[(data["BHK"] >= 1) & (data["BHK"] <= 6)]
    data = data[(data["Bathroom"] >= 1) & (data["Bathroom"] <= 6)]
    data = data[(data["Total Floors"] >= data["Current Floor"])]

    data["Room_ratio"] = data["BHK"] / data["Bathroom"]
    data["Size_per_room"] = data["Size"] / data["BHK"]
    data["Bath_per_bhk"] = data["Bathroom"] / data["BHK"]
    data["Log_size"] = np.log1p(data["Size"])
    return data


def eda_report(data: pd.DataFrame) -> dict:
    q1 = data[TARGET_COL].quantile(0.25)
    q3 = data[TARGET_COL].quantile(0.75)
    iqr = q3 - q1
    iqr_low = q1 - 1.5 * iqr
    iqr_high = q3 + 1.5 * iqr
    pct_low = data[TARGET_COL].quantile(0.02)
    pct_high = data[TARGET_COL].quantile(0.96)

    report = {
        "shape": data.shape,
        "missing_values": data.isna().sum().to_dict(),
        "rent_describe": data[TARGET_COL].describe().to_dict(),
        "numeric_correlations_with_rent": data[NUMERIC_COLS + [TARGET_COL]]
        .corr(numeric_only=True)[TARGET_COL]
        .sort_values(ascending=False)
        .to_dict(),
        "categorical_cardinality": data[CATEGORICAL_COLS].nunique().to_dict(),
        "iqr_outliers": int(((data[TARGET_COL] < iqr_low) | (data[TARGET_COL] > iqr_high)).sum()),
        "percentile_outliers_2_96": int(
            ((data[TARGET_COL] < pct_low) | (data[TARGET_COL] > pct_high)).sum()
        ),
    }

    print("\nEDA SUMMARY")
    print(f"Rows/Columns              : {report['shape']}")
    print(f"Rent min/median/max       : Rs.{data[TARGET_COL].min():,.0f} / Rs.{data[TARGET_COL].median():,.0f} / Rs.{data[TARGET_COL].max():,.0f}")
    print(f"IQR outliers in Rent      : {report['iqr_outliers']}")
    print(f"2%-96% percentile outliers: {report['percentile_outliers_2_96']}")
    print(f"Categorical cardinality   : {report['categorical_cardinality']}")
    return report


def apply_outlier_method(data: pd.DataFrame, method: str) -> pd.DataFrame:
    if method == "none":
        filtered = data.copy()
    elif method == "iqr":
        q1 = data[TARGET_COL].quantile(0.25)
        q3 = data[TARGET_COL].quantile(0.75)
        iqr = q3 - q1
        filtered = data[
            (data[TARGET_COL] >= q1 - 1.5 * iqr)
            & (data[TARGET_COL] <= q3 + 1.5 * iqr)
        ].copy()
    elif method == "percentile_02_96":
        low = data[TARGET_COL].quantile(0.02)
        high = data[TARGET_COL].quantile(0.96)
        filtered = data[(data[TARGET_COL] >= low) & (data[TARGET_COL] <= high)].copy()
    elif method == "percentile_02_97":
        low = data[TARGET_COL].quantile(0.02)
        high = data[TARGET_COL].quantile(0.97)
        filtered = data[(data[TARGET_COL] >= low) & (data[TARGET_COL] <= high)].copy()
    else:
        raise ValueError(f"Unknown outlier method: {method}")

    counts = filtered["Area Locality"].value_counts()
    return filtered[filtered["Area Locality"].isin(counts[counts >= 4].index)].copy()


class FrequencyEncoder(BaseEstimator, TransformerMixin):
    def __init__(self, categorical_cols: list[str], numeric_cols: list[str] | None = None):
        self.categorical_cols = categorical_cols
        self.numeric_cols = numeric_cols

    def fit(self, X, y=None):
        X = pd.DataFrame(X).copy()
        self.maps_ = {}
        for col in self.categorical_cols:
            self.maps_[col] = X[col].value_counts(normalize=True).to_dict()
        return self

    def transform(self, X):
        X = pd.DataFrame(X).copy()
        numeric_cols = self.numeric_cols if self.numeric_cols is not None else NUMERIC_COLS
        for col in self.categorical_cols:
            X[col] = X[col].map(self.maps_[col]).fillna(0)
        return X[numeric_cols + self.categorical_cols]


class TargetMeanEncoder(BaseEstimator, TransformerMixin):
    def __init__(
        self,
        categorical_cols: list[str],
        smoothing: float = 10.0,
        numeric_cols: list[str] | None = None,
    ):
        self.categorical_cols = categorical_cols
        self.smoothing = smoothing
        self.numeric_cols = numeric_cols

    def fit(self, X, y):
        X = pd.DataFrame(X).copy()
        y = pd.Series(y, index=X.index)
        self.global_mean_ = float(y.mean())
        self.maps_ = {}
        for col in self.categorical_cols:
            stats = y.groupby(X[col]).agg(["mean", "count"])
            smooth = (
                stats["count"] * stats["mean"] + self.smoothing * self.global_mean_
            ) / (stats["count"] + self.smoothing)
            self.maps_[col] = smooth.to_dict()
        return self

    def transform(self, X):
        X = pd.DataFrame(X).copy()
        numeric_cols = self.numeric_cols if self.numeric_cols is not None else NUMERIC_COLS
        for col in self.categorical_cols:
            X[col] = X[col].map(self.maps_[col]).fillna(self.global_mean_)
        return X[numeric_cols + self.categorical_cols]


def make_preprocessor(encoding: str):
    if encoding == "label":
        return ColumnTransformer(
            transformers=[
                ("numeric", "passthrough", NUMERIC_COLS),
                (
                    "categorical",
                    OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1),
                    CATEGORICAL_COLS,
                ),
            ],
            verbose_feature_names_out=False,
        )
    if encoding == "onehot":
        return ColumnTransformer(
            transformers=[
                ("numeric", "passthrough", NUMERIC_COLS),
                (
                    "categorical",
                    OneHotEncoder(handle_unknown="ignore", sparse_output=False, min_frequency=3),
                    CATEGORICAL_COLS,
                ),
            ],
            verbose_feature_names_out=False,
        )
    if encoding == "frequency":
        return FrequencyEncoder(CATEGORICAL_COLS, numeric_cols=NUMERIC_COLS)
    if encoding == "target":
        return TargetMeanEncoder(CATEGORICAL_COLS, smoothing=10.0, numeric_cols=NUMERIC_COLS)
    raise ValueError(f"Unknown encoding: {encoding}")


def make_pipeline(model, encoding: str) -> Pipeline:
    return Pipeline(
        steps=[
            ("preprocess", make_preprocessor(encoding)),
            ("model", model),
        ]
    )


def target_values(y: pd.Series, log_target: bool):
    return np.log1p(y) if log_target else y


def inverse_target(y_values, log_target: bool):
    return np.expm1(y_values) if log_target else y_values


def evaluate_pipeline(
    name: str,
    model_name: str,
    pipeline: Pipeline,
    X_train,
    X_test,
    y_train_raw,
    y_test_raw,
    encoding: str,
    outlier_method: str,
    log_target: bool,
    cv5: bool = False,
    cv10: bool = False,
) -> tuple[ExperimentResult, Pipeline]:
    y_train = target_values(y_train_raw, log_target)
    y_test = target_values(y_test_raw, log_target)
    fitted = clone(pipeline)
    fitted.fit(X_train, y_train)
    pred = fitted.predict(X_test)
    pred_actual = inverse_target(pred, log_target)

    result = ExperimentResult(
        name=name,
        model_name=model_name,
        encoding=encoding,
        outlier_method=outlier_method,
        log_target=log_target,
        r2=r2_score(y_test, pred),
        mae=mean_absolute_error(y_test_raw, pred_actual),
        rmse=np.sqrt(mean_squared_error(y_test_raw, pred_actual)),
        mape=float(np.mean(np.abs((y_test_raw - pred_actual) / y_test_raw)) * 100),
    )

    if cv5:
        result.cv5_r2 = float(cross_val_score(fitted, X_train, y_train, cv=5, scoring="r2").mean())
    if cv10:
        result.cv10_r2 = float(cross_val_score(fitted, X_train, y_train, cv=10, scoring="r2").mean())

    print(
        f"{name:34} R2={result.r2:.4f} MAE=Rs.{result.mae:,.0f} "
        f"RMSE=Rs.{result.rmse:,.0f} MAPE={result.mape:.2f}%"
    )
    return result, fitted


def feature_importance(fitted_pipeline: Pipeline, top_n: int = 30) -> list[dict]:
    preprocessor = fitted_pipeline.named_steps["preprocess"]
    model = fitted_pipeline.named_steps["model"]

    if hasattr(preprocessor, "get_feature_names_out"):
        feature_names = preprocessor.get_feature_names_out()
    else:
        feature_names = NUMERIC_COLS + CATEGORICAL_COLS

    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
    else:
        return []

    rows = [
        {"feature": str(feature), "importance": float(importance)}
        for feature, importance in zip(feature_names, importances)
    ]
    return sorted(rows, key=lambda item: item["importance"], reverse=True)[:top_n]


def main():
    MODEL_DIR.mkdir(exist_ok=True)
    REPORT_DIR.mkdir(exist_ok=True)
    raw_data = load_and_engineer()
    report = {"eda": eda_report(raw_data), "experiments": []}
    results: list[ExperimentResult] = []
    fitted_models: dict[str, Pipeline] = {}

    baseline_model = GradientBoostingRegressor(
        n_estimators=1000,
        learning_rate=0.025,
        max_depth=4,
        subsample=0.8,
        min_samples_split=4,
        min_samples_leaf=3,
        max_features=0.9,
        random_state=RANDOM_STATE,
    )

    print("\nOUTLIER + TARGET TRANSFORM + ENCODING EXPERIMENTS")
    for outlier_method in ["none", "iqr", "percentile_02_96", "percentile_02_97"]:
        data = apply_outlier_method(raw_data, outlier_method)
        X = data.drop(columns=[TARGET_COL])
        y = data[TARGET_COL]
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=RANDOM_STATE
        )
        for encoding in ["label", "onehot", "frequency", "target"]:
            for log_target in [False, True]:
                pipeline = make_pipeline(clone(baseline_model), encoding)
                result, fitted = evaluate_pipeline(
                    name=f"{outlier_method}/{encoding}/log={log_target}",
                    model_name="GradientBoosting",
                    pipeline=pipeline,
                    X_train=X_train,
                    X_test=X_test,
                    y_train_raw=y_train,
                    y_test_raw=y_test,
                    encoding=encoding,
                    outlier_method=outlier_method,
                    log_target=log_target,
                )
                results.append(result)
                fitted_models[result.name] = fitted

    best_gb_setup = sorted(
        [result for result in results if result.r2 >= 0.85],
        key=lambda item: (item.mae, item.rmse, item.mape),
    )[0]
    print(f"\nBest pre-tuning Gradient Boosting setup: {best_gb_setup.name}")

    best_data = apply_outlier_method(raw_data, best_gb_setup.outlier_method)
    X = best_data.drop(columns=[TARGET_COL])
    y = best_data[TARGET_COL]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE
    )
    y_train_model = target_values(y_train, best_gb_setup.log_target)

    print("\nRANDOMIZED SEARCH FOR GRADIENT BOOSTING")
    gb_pipeline = make_pipeline(GradientBoostingRegressor(random_state=RANDOM_STATE), best_gb_setup.encoding)
    param_dist = {
        "model__n_estimators": [500, 700, 900, 1100, 1300],
        "model__learning_rate": [0.01, 0.015, 0.02, 0.025, 0.03, 0.04],
        "model__max_depth": [2, 3, 4, 5],
        "model__subsample": [0.65, 0.75, 0.85, 0.95],
        "model__min_samples_split": [2, 4, 6, 8, 10],
        "model__min_samples_leaf": [1, 2, 3, 4, 5],
        "model__max_features": [0.7, 0.8, 0.9, 1.0],
    }
    search = RandomizedSearchCV(
        gb_pipeline,
        param_distributions=param_dist,
        n_iter=28,
        scoring="neg_mean_absolute_error",
        cv=5,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        verbose=1,
    )
    search.fit(X_train, y_train_model)
    tuned_gb = search.best_estimator_
    print(f"Best Gradient Boosting parameters: {search.best_params_}")

    tuned_result, tuned_fitted = evaluate_pipeline(
        name="Tuned GradientBoosting",
        model_name="GradientBoosting",
        pipeline=tuned_gb,
        X_train=X_train,
        X_test=X_test,
        y_train_raw=y_train,
        y_test_raw=y_test,
        encoding=best_gb_setup.encoding,
        outlier_method=best_gb_setup.outlier_method,
        log_target=best_gb_setup.log_target,
        cv5=True,
        cv10=True,
    )
    results.append(tuned_result)
    fitted_models[tuned_result.name] = tuned_fitted

    print("\nMODEL COMPARISON")
    comparison_models = {
        "RandomForest": RandomForestRegressor(
            n_estimators=700,
            max_depth=24,
            min_samples_leaf=1,
            max_features=0.8,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )
    }
    if XGBRegressor is not None:
        comparison_models["XGBoost"] = XGBRegressor(
            n_estimators=850,
            learning_rate=0.025,
            max_depth=4,
            subsample=0.85,
            colsample_bytree=0.9,
            reg_lambda=1.5,
            random_state=RANDOM_STATE,
            objective="reg:squarederror",
            n_jobs=-1,
        )
    if CatBoostRegressor is not None:
        comparison_models["CatBoost"] = CatBoostRegressor(
            iterations=900,
            learning_rate=0.035,
            depth=6,
            loss_function="RMSE",
            random_seed=RANDOM_STATE,
            verbose=False,
        )

    for model_name, model in comparison_models.items():
        pipeline = make_pipeline(model, best_gb_setup.encoding)
        result, fitted = evaluate_pipeline(
            name=model_name,
            model_name=model_name,
            pipeline=pipeline,
            X_train=X_train,
            X_test=X_test,
            y_train_raw=y_train,
            y_test_raw=y_test,
            encoding=best_gb_setup.encoding,
            outlier_method=best_gb_setup.outlier_method,
            log_target=best_gb_setup.log_target,
            cv5=True,
            cv10=True,
        )
        results.append(result)
        fitted_models[result.name] = fitted

    valid_results = [result for result in results if result.r2 >= 0.85]
    best_result = sorted(valid_results, key=lambda item: (item.mae, item.rmse, item.mape))[0]
    best_model = fitted_models[best_result.name]
    print("\nBEST MODEL")
    print(
        f"{best_result.name}: R2={best_result.r2:.4f}, MAE=Rs.{best_result.mae:,.0f}, "
        f"RMSE=Rs.{best_result.rmse:,.0f}, MAPE={best_result.mape:.2f}%"
    )

    importances = feature_importance(best_model)
    print("\nTOP FEATURE IMPORTANCES")
    for row in importances[:15]:
        print(f"{row['feature']:40} {row['importance']:.4f}")

    report["experiments"] = [result.as_dict() for result in results]
    report["best_model"] = best_result.as_dict()
    report["feature_importance"] = importances
    report["best_params"] = search.best_params_

    with REPORT_PATH.open("w", encoding="utf-8") as file:
        json.dump(report, file, indent=2)

    artifact = {
        "model": best_model,
        "feature_columns": list(X.columns),
        "numeric_columns": NUMERIC_COLS,
        "categorical_columns": CATEGORICAL_COLS,
        "target_column": TARGET_COL,
        "outlier_method": best_result.outlier_method,
        "log_target": best_result.log_target,
        "metrics": best_result.as_dict(),
        "feature_importance": importances,
    }
    with BEST_ARTIFACT_PATH.open("wb") as file:
        pickle.dump(artifact, file)

    print(f"\nSaved report      : {REPORT_PATH.resolve()}")
    print(f"Saved best model  : {BEST_ARTIFACT_PATH.resolve()}")


if __name__ == "__main__":
    main()
