import pandas as pd
from sklearn.linear_model import LinearRegression
import pickle
from pathlib import Path

# Load dataset
data = pd.read_csv("dataset/rent_data.csv")

X = data[['size_sqft', 'bhk', 'furnishing', 'near_metro']]
y = data['rent']

# Train model
model = LinearRegression()
model.fit(X, y)

# Save trained model
model_path = Path(__file__).resolve().parent.parent / "models" / "rent_model.pkl"
model_path.parent.mkdir(exist_ok=True)
pickle.dump(model, open(model_path, "wb"))

print("✅ Model trained & saved successfully")
