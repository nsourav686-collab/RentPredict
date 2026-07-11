# House Rent Model Optimization Summary

## Objective

Reduce MAE, RMSE, and MAPE while maintaining or improving the model R2 score above 0.85.

## Before vs After

| Version | Model | Encoding | Outlier Handling | Log Target | R2 | 5-Fold CV R2 | 10-Fold CV R2 | MAE | RMSE | MAPE |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|
| Before | Gradient Boosting | Label/target-stat features | 2%-96% percentile | Yes | 0.8626 | 0.8160 | Not run | Rs.5,512 | Rs.10,470 | 22.00% |
| After | Optimized Gradient Boosting | Target Encoding | 2%-97% percentile | Yes | 0.8733 | 0.8475 | 0.8512 | Rs.5,101 | Rs.10,060 | 20.85% |

## Improvements Made

1. Exploratory data analysis found strong rent skew, 476 IQR outliers, 220 percentile outliers, and high cardinality in `Area Locality`.
2. IQR and percentile outlier handling were compared. The best final approach used the 2nd to 97th percentile range for `Rent`, then removed localities with fewer than 4 examples.
3. Log transformation was tested against raw rent. Log-transformed `Rent` gave better MAPE and more stable R2 for the final model.
4. `Floor` was converted into numerical `Current Floor` and `Total Floors` features.
5. Label Encoding, One-Hot Encoding, Frequency Encoding, and Target Encoding were compared. Target Encoding performed best for the high-cardinality `Area Locality` feature.
6. Gradient Boosting was tuned using `RandomizedSearchCV` over `n_estimators`, `learning_rate`, `max_depth`, `subsample`, `min_samples_split`, and `min_samples_leaf`.
7. Gradient Boosting was compared with Random Forest, XGBoost, and CatBoost. Gradient Boosting gave the best final error balance.
8. Feature importance was used for feature selection. Low-importance features were removed, which slightly improved R2, MAE, and MAPE.
9. The final model was validated with both 5-fold and 10-fold cross-validation.

## Model Comparison Highlights

| Model | R2 | MAE | RMSE | MAPE |
|---|---:|---:|---:|---:|
| Optimized Gradient Boosting, reduced features | 0.8733 | Rs.5,101 | Rs.10,060 | 20.85% |
| Gradient Boosting, full target-encoded features | 0.8722 | Rs.5,108 | Rs.9,974 | 20.95% |
| Tuned Gradient Boosting | 0.8719 | Rs.5,187 | Rs.10,130 | 21.07% |
| XGBoost | 0.8681 | Rs.5,240 | Rs.10,233 | 21.45% |
| CatBoost | 0.8664 | Rs.5,275 | Rs.10,231 | 21.59% |
| Random Forest | 0.8507 | Rs.5,366 | Rs.10,339 | 22.71% |

## Final Feature Importance

| Rank | Feature | Importance |
|---:|---|---:|
| 1 | Area Locality | 0.5140 |
| 2 | Bathroom | 0.1105 |
| 3 | Log_size | 0.0729 |
| 4 | BHK | 0.0692 |
| 5 | Size | 0.0622 |
| 6 | City | 0.0546 |
| 7 | Point of Contact | 0.0426 |
| 8 | Total Floors | 0.0312 |
| 9 | Size_per_room | 0.0203 |
| 10 | Current Floor | 0.0118 |

## Final Artifacts

- `models/optimized_rent_model.pkl`: final production model artifact.
- `training/train_model.py`: production training script for the optimized model.
- `training/check_accuracy.py`: evaluation script for the saved optimized model.
- `training/optimize_model.py`: complete optimization and experiment script.
- `reports/model_training_report.json`: compact training report for the final model.

## Conclusion

The final optimized Gradient Boosting model improves the previous model on all requested error metrics while also increasing the test R2 score from 0.8626 to 0.8733. The most important improvement came from using target encoding for `Area Locality`, handling rent outliers with a 2%-97% percentile filter, applying log transformation to the target, extracting floor features, and removing weak features after feature-importance analysis.
