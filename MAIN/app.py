from pathlib import Path
from flask import Flask, render_template, request, jsonify, redirect, session, flash, url_for
from email.message import EmailMessage
import json
import os
import pickle
import pandas as pd
import numpy as np
import sqlite3
import random
import smtplib
import string
import sys
from werkzeug.security import generate_password_hash, check_password_hash

try:
    from training import optimize_model  # Required so the optimized sklearn pipeline can be unpickled.
    # Older saved artifacts reference this module by its original top-level name.
    sys.modules.setdefault("optimize_model", optimize_model)
except ImportError:
    optimize_model = None

try:
    from authlib.integrations.flask_client import OAuth
except ImportError:
    OAuth = None

BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "storage" / "users.db"
DATABASE_PATH.parent.mkdir(exist_ok=True)
ADMIN_USERNAME = "nsourav686"
ADMIN_PASSWORD = "Sourav@0305"
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USERNAME)

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates"),
    static_folder=str(BASE_DIR / "static")
)
app.secret_key = "secret123"

# -----------------------------
# Google OAuth Setup
# -----------------------------
oauth = OAuth(app) if OAuth else None
google = None

if oauth:
    google = oauth.register(
        name='google',
        client_id='YOUR_CLIENT_ID',
        client_secret='YOUR_CLIENT_SECRET',
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={
            'scope': 'openid email profile'
        }
    )

# -----------------------------
# Database Setup
# -----------------------------
def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        email TEXT,
        role TEXT
    )
    """)

    existing_user_columns = {
        row[1] for row in c.execute("PRAGMA table_info(users)").fetchall()
    }

    if "email" not in existing_user_columns:
        c.execute("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''")
    if "contact_number" not in existing_user_columns:
        c.execute("ALTER TABLE users ADD COLUMN contact_number TEXT DEFAULT ''")
    if "profile_image" not in existing_user_columns:
        c.execute("ALTER TABLE users ADD COLUMN profile_image TEXT DEFAULT ''")

    c.execute("""
    CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner TEXT,
        city TEXT,
        address TEXT,
        area_type TEXT,
        furnishing TEXT,
        size REAL,
        bhk INTEGER,
        bathroom INTEGER,
        rent REAL,
        contact_name TEXT,
        contact_email TEXT,
        contact_number TEXT,
        house_name TEXT,
        nearest_landmark TEXT,
        image_urls TEXT,
        status TEXT,
        approval_status TEXT,
        latitude REAL,
        longitude REAL,
        map_url TEXT
    )
    """)

    existing_property_columns = {
        row[1] for row in c.execute("PRAGMA table_info(properties)").fetchall()
    }
    property_defaults = {
        "city": "TEXT DEFAULT ''",
        "area_type": "TEXT DEFAULT ''",
        "furnishing": "TEXT DEFAULT ''",
        "size": "REAL DEFAULT 0",
        "bhk": "INTEGER DEFAULT 0",
        "bathroom": "INTEGER DEFAULT 0",
        "contact_name": "TEXT DEFAULT ''",
        "contact_email": "TEXT DEFAULT ''",
        "contact_number": "TEXT DEFAULT ''",
        "house_name": "TEXT DEFAULT ''",
        "nearest_landmark": "TEXT DEFAULT ''",
        "image_urls": "TEXT DEFAULT '[]'",
        "status": "TEXT DEFAULT 'active'",
        "approval_status": "TEXT DEFAULT 'approved'",
        "latitude": "REAL DEFAULT 0",
        "longitude": "REAL DEFAULT 0",
        "map_url": "TEXT DEFAULT ''",
    }
    for column, definition in property_defaults.items():
        if column not in existing_property_columns:
            c.execute(f"ALTER TABLE properties ADD COLUMN {column} {definition}")

    admin_password = generate_password_hash(ADMIN_PASSWORD)
    c.execute(
        """
        INSERT INTO users (username, password, email, contact_number, role)
        VALUES (?, ?, ?, ?, 'admin')
        ON CONFLICT(username) DO UPDATE SET
            password=excluded.password,
            role='admin'
        """,
        (ADMIN_USERNAME, admin_password, "", "")
    )

    conn.commit()
    conn.close()

init_db()


def user_exists(username):
    conn = get_db()
    user = conn.execute(
        "SELECT id FROM users WHERE username=?",
        (username,)
    ).fetchone()
    conn.close()
    return user is not None


def send_property_verification_email(property_item):
    recipient = property_item.get("contact_email") or property_item.get("user_email") or ""
    if not recipient:
        return "No owner email address found."
    if not SMTP_HOST or not SMTP_USERNAME or not SMTP_PASSWORD or not SMTP_FROM:
        return "Email not sent because SMTP settings are not configured."

    map_url = property_item.get("map_url") or (
        f"https://www.google.com/maps/search/?api=1&query={property_item.get('latitude')},{property_item.get('longitude')}"
        if property_item.get("latitude") and property_item.get("longitude")
        else ""
    )
    message = EmailMessage()
    message["Subject"] = "Your RentPredict property has been verified"
    message["From"] = SMTP_FROM
    message["To"] = recipient
    message.set_content(
        "\n".join([
            f"Hello {property_item.get('contact_name') or property_item.get('owner')},",
            "",
            "Your property has been verified by the admin and is now visible to users.",
            "",
            f"Property: {property_item.get('house_name') or 'Owner Property'}",
            f"City: {property_item.get('city')}",
            f"Area: {property_item.get('address')}",
            f"Nearest landmark: {property_item.get('nearest_landmark') or 'Not added'}",
            f"Rent: Rs {property_item.get('rent')}",
            f"Size: {property_item.get('size')} sqft",
            f"Rooms: {property_item.get('bhk')} BHK, {property_item.get('bathroom')} bathroom",
            f"Furnishing: {property_item.get('furnishing')}",
            f"Map pin: {map_url}",
            "",
            "Thank you for listing with RentPredict."
        ])
    )

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            smtp.starttls()
            smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
            smtp.send_message(message)
        return "Verification email sent to the owner."
    except Exception as error:
        return f"Property verified, but email could not be sent: {error}"

# -----------------------------
# Load ML Model + Encoders + Features
# -----------------------------

model = None
encoders = None
feature_cols = None
target_stats = None

optimized_artifact = None
MODEL_DIR = BASE_DIR / "models"
optimized_artifact_path = MODEL_DIR / "optimized_rent_model.pkl"

if optimize_model and optimized_artifact_path.exists():
    with open(optimized_artifact_path, "rb") as f:
        optimized_artifact = pickle.load(f)

    model = optimized_artifact["model"]

data = pd.read_csv(BASE_DIR / "dataset" / "House_Rent_Dataset.csv")
cities = sorted(data["City"].dropna().unique())
optimized_artifact_path = MODEL_DIR / "optimized_rent_model.pkl"
optimized_artifact = None
if optimize_model and optimized_artifact_path.exists():
    optimized_artifact = pickle.load(open(optimized_artifact_path, "rb"))
    optimize_model.NUMERIC_COLS = optimized_artifact["numeric_columns"]
    optimize_model.CATEGORICAL_COLS = optimized_artifact["categorical_columns"]


def filter_areas_for_query(areas, query):
    query = (query or "").strip().lower()
    result = [area for area in areas if query in area.lower()]

    if not query:
        return result

    return sorted(
        result,
        key=lambda area: (
            area.lower() != query,
            not area.lower().startswith(query),
            area.lower(),
        ),
    )


def current_user_payload():
    username = session.get("username")
    if not username:
        return {
            "username": None,
            "role": None,
            "email": None,
            "contact_number": None,
            "profile_image": "",
            "isAuthenticated": False,
        }

    conn = get_db()
    user = conn.execute(
        "SELECT username, role, email, contact_number, profile_image FROM users WHERE username=?",
        (username,)
    ).fetchone()
    conn.close()

    if not user:
        session.clear()
        return {
            "username": None,
            "role": None,
            "email": None,
            "contact_number": None,
            "profile_image": "",
            "isAuthenticated": False,
        }

    return {
        "username": user["username"],
        "role": user["role"],
        "email": user["email"] or "",
        "contact_number": user["contact_number"] or "",
        "profile_image": user["profile_image"] or "",
        "isAuthenticated": True,
    }


def saved_target_mean(column, value):
    if not target_stats:
        return 0

    return target_stats["maps"].get(column, {}).get(value, target_stats["global_mean"])


def build_model_features(size, bhk, bathroom, city, area, area_type, furnishing):
    try:
        city_enc = encoders["City"].transform([city])[0]
    except:
        city_enc = 0

    try:
        area_type_enc = encoders["Area Type"].transform([area_type])[0]
    except:
        area_type_enc = 0

    try:
        furnishing_enc = encoders["Furnishing Status"].transform([furnishing])[0]
    except:
        furnishing_enc = 0

    try:
        locality_enc = encoders["Area Locality"].transform([area])[0]
    except:
        locality_enc = 0

    room_ratio = bhk / bathroom if bathroom != 0 else 0
    size_per_room = size / bhk if bhk != 0 else size

    size_category = pd.cut(
        [size],
        bins=[0, 500, 1000, 1500, 2000, 10000],
        labels=[0, 1, 2, 3, 4]
    )[0]

    feature_values = {
        "BHK": bhk,
        "Size": size,
        "Area Type": area_type_enc,
        "Area Locality": locality_enc,
        "City": city_enc,
        "Furnishing Status": furnishing_enc,
        "Bathroom": bathroom,
        "Area Locality_mean_rent": saved_target_mean("Area Locality", area),
        "City_mean_rent": saved_target_mean("City", city),
        "Area Type_mean_rent": saved_target_mean("Area Type", area_type),
        "Furnishing Status_mean_rent": saved_target_mean("Furnishing Status", furnishing),
        "Room_ratio": room_ratio,
        "Size_per_room": size_per_room,
        "Size_category": int(size_category),
        "Bath_per_bhk": bathroom / bhk if bhk != 0 else 0,
        "Log_size": np.log1p(size),
    }

    return [[feature_values[col] for col in feature_cols]]


def predict_with_optimized_model(size, bhk, bathroom, city, area, area_type, furnishing):
    if not optimized_artifact:
        return None

    raw_features = {
        "BHK": bhk,
        "Size": size,
        "Bathroom": bathroom,
        "Current Floor": float(data["Floor"].astype(str).str.extract(r"(-?\d+)")[0].dropna().astype(float).median() or 1),
        "Total Floors": 4.0,
        "Area Type": area_type,
        "Area Locality": area,
        "City": city,
        "Furnishing Status": furnishing,
        "Tenant Preferred": "Bachelors/Family",
        "Point of Contact": "Contact Owner",
    }
    raw_features["Room_ratio"] = bhk / bathroom if bathroom else 0
    raw_features["Size_per_room"] = size / bhk if bhk else size
    raw_features["Bath_per_bhk"] = bathroom / bhk if bhk else 0
    raw_features["Log_size"] = np.log1p(size)

    input_frame = pd.DataFrame([raw_features])[optimized_artifact["feature_columns"]]
    prediction = optimized_artifact["model"].predict(input_frame)[0]
    if optimized_artifact.get("log_target", False):
        prediction = np.expm1(prediction)
    return round(float(prediction), 2)


def predict_rent_from_payload(payload):
    size = float(payload["size"])
    bhk = int(payload["bhk"])
    bathroom = int(payload["bathroom"])

    city = payload["city"]
    area = payload["area"]
    area_type = payload["area_type"]
    furnishing = payload["furnishing"]

    optimized_prediction = predict_with_optimized_model(
        size, bhk, bathroom, city, area, area_type, furnishing
    )
    if optimized_prediction is not None:
        return optimized_prediction

    features = build_model_features(size, bhk, bathroom, city, area, area_type, furnishing)
    prediction = model.predict(features)[0]
    final_rent = round(float(np.expm1(prediction)), 2)

    return final_rent


def safe_float(value, default=0):
    try:
        if pd.isna(value):
            return default
        return round(float(value), 2)
    except (TypeError, ValueError):
        return default


def rent_band_label(rent, low, high):
    if rent <= low:
        return "Affordable"
    if rent <= high:
        return "Moderate"
    return "Premium"


def build_market_insights(payload, predicted_rent):
    empty_insights = {
        "summary": {},
        "rent_comparison": [],
        "affordability": [],
        "bhk_trend": [],
        "furnishing": [],
        "area_samples": []
    }

    try:
        city = payload.get("city", "")
        area = payload.get("area", "")
        bhk = int(payload.get("bhk") or 0)

        city_df = data[data["City"] == city].copy()
        if city_df.empty:
            return empty_insights

        city_df["Rent"] = pd.to_numeric(city_df["Rent"], errors="coerce")
        city_df["Size"] = pd.to_numeric(city_df["Size"], errors="coerce")
        city_df["BHK"] = pd.to_numeric(city_df["BHK"], errors="coerce")
        city_df = city_df.dropna(subset=["Rent"])
        if city_df.empty:
            return empty_insights

        area_df = city_df[
            city_df["Area Locality"].fillna("").str.lower() == area.lower()
        ].copy()
        market_df = area_df if not area_df.empty else city_df
        scope_label = area if not area_df.empty else city

        city_avg = safe_float(city_df["Rent"].mean())
        area_avg = safe_float(market_df["Rent"].mean())
        area_median = safe_float(market_df["Rent"].median())
        rent_per_sqft = safe_float(
            (market_df["Rent"] / market_df["Size"].replace(0, np.nan))
            .replace([np.inf, -np.inf], np.nan)
            .mean()
        )
        percentile = safe_float(city_df["Rent"].le(predicted_rent).mean() * 100)

        low, high = city_df["Rent"].quantile([0.33, 0.66]).tolist()
        band_counts = (
            city_df.assign(band=city_df["Rent"].apply(lambda rent: rent_band_label(rent, low, high)))
            .groupby("band")
            .size()
            .reindex(["Affordable", "Moderate", "Premium"], fill_value=0)
        )
        prediction_band = rent_band_label(predicted_rent, low, high)

        bhk_source = market_df if market_df["BHK"].nunique() > 1 else city_df
        bhk_trend = []
        for bhk_value, group in bhk_source.dropna(subset=["BHK"]).groupby("BHK"):
            bhk_number = int(bhk_value)
            bhk_trend.append({
                "label": f"{bhk_number} BHK",
                "value": safe_float(group["Rent"].mean()),
                "active": bhk_number == bhk,
                "count": int(len(group))
            })
        bhk_trend = sorted(bhk_trend, key=lambda item: int(item["label"].split()[0]))[:6]

        furnishing = []
        for status, group in market_df.dropna(subset=["Furnishing Status"]).groupby("Furnishing Status"):
            furnishing.append({
                "label": str(status),
                "value": safe_float(group["Rent"].mean()),
                "count": int(len(group))
            })
        furnishing = sorted(furnishing, key=lambda item: item["value"], reverse=True)

        area_samples = []
        top_areas = (
            city_df.dropna(subset=["Area Locality"])
            .groupby("Area Locality")
            .agg(avg_rent=("Rent", "mean"), record_count=("Rent", "size"))
            .reset_index()
        )
        top_areas = (
            top_areas[top_areas["record_count"] >= 2]
            .sort_values("avg_rent", ascending=False)
            .head(5)
        )
        for _, row in top_areas.iterrows():
            locality = str(row["Area Locality"])
            area_samples.append({
                "label": locality,
                "value": safe_float(row["avg_rent"]),
                "count": int(row["record_count"]),
                "active": locality.lower() == area.lower()
            })

        return {
            "summary": {
                "scope": scope_label,
                "records": int(len(market_df)),
                "city_records": int(len(city_df)),
                "city_average": city_avg,
                "area_average": area_avg,
                "area_median": area_median,
                "rent_per_sqft": rent_per_sqft,
                "percentile": percentile,
                "prediction_band": prediction_band
            },
            "rent_comparison": [
                {"label": "Predicted", "value": safe_float(predicted_rent), "active": True},
                {"label": f"{scope_label} avg", "value": area_avg},
                {"label": f"{city} avg", "value": city_avg}
            ],
            "affordability": [
                {"label": label, "value": int(count), "active": label == prediction_band}
                for label, count in band_counts.items()
            ],
            "bhk_trend": bhk_trend,
            "furnishing": furnishing,
            "area_samples": area_samples
        }
    except Exception:
        return empty_insights


def prediction_response_payload(payload, final_rent):
    return {
        "rent": final_rent,
        "size": payload["size"],
        "bhk": payload["bhk"],
        "bathroom": payload["bathroom"],
        "area_type": payload["area_type"],
        "furnishing": payload["furnishing"],
        "area": payload["area"],
        "city": payload["city"],
        "market_insights": build_market_insights(payload, final_rent),
        "listings": find_matching_listings(payload, final_rent)
    }


def parse_image_urls(value):
    if not value:
        return []
    if isinstance(value, list):
        return value
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except (TypeError, json.JSONDecodeError):
        return []


def listing_payload(row, source, predicted_rent):
    rent = float(row["rent"] if source == "owner" else row["Rent"])
    return {
        "id": f"{source}-{row['id'] if source == 'owner' else row.name}",
        "source": source,
        "owner": row["owner"] if source == "owner" else "Dataset sample",
        "house_name": row["house_name"] if source == "owner" else "",
        "nearest_landmark": row["nearest_landmark"] if source == "owner" else "",
        "image_urls": parse_image_urls(row["image_urls"]) if source == "owner" else [],
        "status": row["status"] if source == "owner" else "sample",
        "contact_name": row["contact_name"] if source == "owner" else "Contact Owner",
        "contact_email": row["contact_email"] if source == "owner" else "",
        "contact_number": row["contact_number"] if source == "owner" else "",
        "latitude": float(row["latitude"] or 0) if source == "owner" else 0,
        "longitude": float(row["longitude"] or 0) if source == "owner" else 0,
        "map_url": row["map_url"] if source == "owner" else "",
        "city": row["city"] if source == "owner" else row["City"],
        "area": row["address"] if source == "owner" else row["Area Locality"],
        "area_type": row["area_type"] if source == "owner" else row["Area Type"],
        "furnishing": row["furnishing"] if source == "owner" else row["Furnishing Status"],
        "size": float(row["size"] if source == "owner" else row["Size"]),
        "bhk": int(row["bhk"] if source == "owner" else row["BHK"]),
        "bathroom": int(row["bathroom"] if source == "owner" else row["Bathroom"]),
        "rent": rent,
        "difference": round(rent - predicted_rent, 2),
        "match_percent": max(0, round(100 - (abs(rent - predicted_rent) / max(predicted_rent, 1) * 100), 1)),
    }


def find_matching_listings(payload, predicted_rent, limit=8):
    city = payload.get("city", "")
    area = payload.get("area", "")
    lower = predicted_rent * 0.8
    upper = predicted_rent * 1.2

    listings = []

    conn = get_db()
    owner_rows = conn.execute(
        """
        SELECT p.*, u.email AS user_email, u.contact_number AS user_contact
        FROM properties p
        LEFT JOIN users u ON u.username = p.owner
        WHERE p.city=? AND p.rent BETWEEN ? AND ?
            AND COALESCE(p.status, 'active') = 'active'
            AND COALESCE(p.approval_status, 'approved') = 'approved'
        ORDER BY ABS(p.rent - ?), p.id DESC
        LIMIT ?
        """,
        (city, lower, upper, predicted_rent, limit)
    ).fetchall()
    conn.close()

    for row in owner_rows:
        item = listing_payload(row, "owner", predicted_rent)
        item["contact_email"] = item["contact_email"] or row["user_email"] or ""
        item["contact_number"] = item["contact_number"] or row["user_contact"] or ""
        listings.append(item)

    df_city = data[data["City"] == city].copy()
    if area:
        exact_area = df_city[df_city["Area Locality"].fillna("").str.lower() == area.lower()]
        if not exact_area.empty:
            df_city = exact_area

    if not df_city.empty:
        df_city["rent_gap"] = (df_city["Rent"] - predicted_rent).abs()
        near_rent = df_city[df_city["Rent"].between(lower, upper)]
        if near_rent.empty:
            near_rent = df_city

        for _, row in near_rent.sort_values("rent_gap").head(limit - len(listings)).iterrows():
            listings.append(listing_payload(row, "dataset", predicted_rent))

    return listings[:limit]


def property_payload(row):
    item = dict(row)
    item["image_urls"] = parse_image_urls(item.get("image_urls"))
    item["status"] = item.get("status") or "active"
    item["approval_status"] = item.get("approval_status") or "approved"
    return item


def public_owner_properties(limit=6):
    conn = get_db()
    rows = conn.execute(
        """
        SELECT p.*, u.email AS user_email, u.contact_number AS user_contact
        FROM properties p
        LEFT JOIN users u ON u.username = p.owner
        WHERE COALESCE(p.status, 'active') = 'active'
            AND COALESCE(p.approval_status, 'approved') = 'approved'
        ORDER BY p.id DESC
        LIMIT ?
        """,
        (limit,)
    ).fetchall()
    conn.close()

    listings = []
    for row in rows:
        item = property_payload(row)
        item["contact_email"] = item.get("contact_email") or row["user_email"] or ""
        item["contact_number"] = item.get("contact_number") or row["user_contact"] or ""
        listings.append(item)
    return listings


def all_owner_properties():
    conn = get_db()
    rows = conn.execute(
        """
        SELECT p.*, u.email AS user_email, u.contact_number AS user_contact
        FROM properties p
        LEFT JOIN users u ON u.username = p.owner
        ORDER BY p.id DESC
        """
    ).fetchall()
    conn.close()

    listings = []
    for row in rows:
        item = property_payload(row)
        item["contact_email"] = item.get("contact_email") or row["user_email"] or ""
        item["contact_number"] = item.get("contact_number") or row["user_contact"] or ""
        listings.append(item)
    return listings


def request_payload():
    return request.get_json(silent=True) or request.form


# -----------------------------
# React API Routes
# -----------------------------
@app.route("/api/session")
def api_session():
    return jsonify(current_user_payload())


@app.route("/api/profile", methods=["GET", "PUT"])
def api_profile():
    current_username = session.get("username")
    if not current_username:
        return jsonify({"message": "Please login to view your profile"}), 401

    if request.method == "GET":
        return jsonify({"user": current_user_payload()})

    payload = request_payload()
    username = (payload.get("username") or "").strip()
    email = (payload.get("email") or "").strip()
    contact_number = (payload.get("contact_number") or "").strip()
    profile_image = (payload.get("profile_image") or "").strip()
    role = session.get("role")

    if not username or len(username) > 40:
        return jsonify({"message": "Username is required and must be 40 characters or fewer"}), 400
    if profile_image and (not profile_image.startswith("data:image/") or len(profile_image) > 2_000_000):
        return jsonify({"message": "Please use a valid profile image smaller than 2 MB"}), 400
    if role == "owner" and (not email or not contact_number):
        return jsonify({"message": "Owners must keep an email address and contact number"}), 400
    if role == "admin" and username != current_username:
        return jsonify({"message": "Administrator usernames cannot be changed"}), 400

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone()
    if existing and username != current_username:
        conn.close()
        return jsonify({"message": "That username is already in use"}), 409

    try:
        conn.execute(
            "UPDATE users SET username=?, email=?, contact_number=?, profile_image=? WHERE username=?",
            (username, email, contact_number, profile_image, current_username)
        )
        if username != current_username:
            conn.execute("UPDATE properties SET owner=? WHERE owner=?", (username, current_username))
        conn.commit()
    except sqlite3.Error:
        conn.rollback()
        conn.close()
        return jsonify({"message": "We could not update your profile. Please try again."}), 500

    conn.close()
    session["username"] = username
    session["email"] = email
    session["contact_number"] = contact_number
    return jsonify({
        "message": "Profile updated successfully",
        "user": current_user_payload()
    })


@app.route("/api/cities")
def api_cities():
    return jsonify({"cities": cities})


@app.route("/api/properties")
def api_public_properties():
    return jsonify({"properties": public_owner_properties()})


@app.route("/api/areas")
def api_areas():
    city = request.args.get("city")
    q = request.args.get("q", "")

    df_city = data[data["City"] == city]
    areas = df_city["Area Locality"].dropna().unique()
    result = filter_areas_for_query(areas, q)

    return jsonify({"areas": result})


@app.route("/api/signup", methods=["POST"])
def api_signup():
    payload = request_payload()
    username = payload.get("username")
    password_raw = payload.get("password")
    confirm_password = payload.get("confirm_password")
    role = payload.get("role")
    email = (payload.get("email") or "").strip()
    contact_number = (payload.get("contact_number") or "").strip()

    if not username or not password_raw or not confirm_password or not role:
        return jsonify({"message": "All fields are required"}), 400

    if role == "owner" and (not email or not contact_number):
        return jsonify({"message": "Owners must add email and contact number"}), 400

    if password_raw != confirm_password:
        return jsonify({"message": "Passwords do not match"}), 400

    if user_exists(username):
        return jsonify({"message": "User already exists"}), 409

    password = generate_password_hash(password_raw)

    conn = get_db()
    c = conn.cursor()

    c.execute(
        "INSERT INTO users (username, password, email, contact_number, role) VALUES (?, ?, ?, ?, ?)",
        (username, password, email, contact_number, role)
    )
    conn.commit()

    conn.close()
    return jsonify({"message": "Signup successful!"}), 201


@app.route("/api/login", methods=["POST"])
def api_login():
    payload = request_payload()
    username = payload.get("username")
    password = payload.get("password")

    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400

    conn = get_db()
    c = conn.cursor()

    c.execute(
        "SELECT * FROM users WHERE username=?",
        (username,)
    )

    user = c.fetchone()
    conn.close()

    if user and user["password"] == "":
        return jsonify({"message": "Please login using Google"}), 400

    if user and check_password_hash(user["password"], password):
        session["username"] = user["username"]
        session["role"] = user["role"]
        session["email"] = user["email"]
        session["contact_number"] = user["contact_number"]
        return jsonify({
            "message": "Login successful",
            "user": current_user_payload()
        })

    return jsonify({"message": "Invalid login"}), 401


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"message": "Logged out"})


@app.route("/api/predict", methods=["POST"])
def api_predict():
    if session.get("role") != "user":
        return jsonify({"message": "Please login before getting a rent prediction"}), 401

    try:
        payload = request_payload()
        final_rent = predict_rent_from_payload(payload)
        return jsonify(prediction_response_payload(payload, final_rent))
    except Exception as e:
        return jsonify({"message": str(e)}), 400


@app.route("/api/owner/rent-suggestion", methods=["POST"])
def api_owner_rent_suggestion():
    if session.get("role") != "owner":
        return jsonify({"message": "Owner login required"}), 401

    try:
        payload = request_payload()
        final_rent = predict_rent_from_payload(payload)
        return jsonify({
            "rent": final_rent,
            "message": "Suggested rent calculated from the prediction model"
        })
    except Exception as e:
        return jsonify({"message": str(e)}), 400


@app.route("/api/admin/users")
def api_admin_users():
    if session.get("role") != "admin":
        return jsonify({"message": "Admin login required"}), 401

    conn = get_db()
    users = conn.execute(
        """
        SELECT
            u.id,
            u.username,
            u.email,
            u.contact_number,
            u.role,
            COUNT(p.id) AS property_count
        FROM users u
        LEFT JOIN properties p ON p.owner = u.username
        GROUP BY u.id, u.username, u.email, u.contact_number, u.role
        ORDER BY
            CASE u.role WHEN 'admin' THEN 0 WHEN 'owner' THEN 1 ELSE 2 END,
            u.username
        """
    ).fetchall()
    conn.close()

    return jsonify({
        "users": [dict(user) for user in users]
    })


@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
def api_admin_user_delete(user_id):
    if session.get("role") != "admin":
        return jsonify({"message": "Admin login required"}), 401

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    if not user:
        conn.close()
        return jsonify({"message": "User not found"}), 404

    if user["role"] == "admin":
        conn.close()
        return jsonify({"message": "Admin account cannot be deleted"}), 400

    conn.execute("DELETE FROM properties WHERE owner=?", (user["username"],))
    conn.execute("DELETE FROM users WHERE id=?", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "User deleted", "id": user_id})


@app.route("/api/admin/properties")
def api_admin_properties():
    if session.get("role") != "admin":
        return jsonify({"message": "Admin login required"}), 401

    return jsonify({"properties": all_owner_properties()})


@app.route("/api/admin/properties/<int:property_id>/approval", methods=["PATCH"])
def api_admin_property_approval(property_id):
    if session.get("role") != "admin":
        return jsonify({"message": "Admin login required"}), 401

    payload = request_payload()
    approval_status = payload.get("approval_status")
    if approval_status not in ["pending", "approved", "rejected"]:
        return jsonify({"message": "Invalid approval status"}), 400

    conn = get_db()
    existing = conn.execute(
        """
        SELECT p.*, u.email AS user_email
        FROM properties p
        LEFT JOIN users u ON u.username = p.owner
        WHERE p.id=?
        """,
        (property_id,)
    ).fetchone()
    if not existing:
        conn.close()
        return jsonify({"message": "Property not found"}), 404

    conn.execute(
        "UPDATE properties SET approval_status=? WHERE id=?",
        (approval_status, property_id)
    )
    conn.commit()
    email_status = ""
    if approval_status == "approved":
        email_status = send_property_verification_email(dict(existing))
    conn.close()
    properties = all_owner_properties()
    return jsonify({"properties": properties, "email_status": email_status})


@app.route("/api/admin/properties/<int:property_id>", methods=["DELETE"])
def api_admin_property_delete(property_id):
    if session.get("role") != "admin":
        return jsonify({"message": "Admin login required"}), 401

    conn = get_db()
    existing = conn.execute("SELECT id FROM properties WHERE id=?", (property_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"message": "Property not found"}), 404

    conn.execute("DELETE FROM properties WHERE id=?", (property_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Property deleted", "id": property_id})


@app.route("/api/owner/properties", methods=["GET", "POST"])
def api_owner_properties():
    if session.get("role") != "owner":
        return jsonify({"message": "Owner login required"}), 401

    conn = get_db()
    c = conn.cursor()

    if request.method == "POST":
        payload = request_payload()
        city = payload.get("city")
        address = payload.get("address")
        rent = payload.get("rent")
        house_name = payload.get("house_name") or ""
        nearest_landmark = payload.get("nearest_landmark") or ""
        image_urls = parse_image_urls(payload.get("image_urls"))
        status = payload.get("status") or "active"
        area_type = payload.get("area_type") or ""
        furnishing = payload.get("furnishing") or ""
        size = payload.get("size") or 0
        bhk = payload.get("bhk") or 0
        bathroom = payload.get("bathroom") or 0
        contact_name = payload.get("contact_name") or session.get("username")
        contact_email = payload.get("contact_email") or session.get("email") or ""
        contact_number = payload.get("contact_number") or session.get("contact_number") or ""
        latitude = payload.get("latitude") or 0
        longitude = payload.get("longitude") or 0
        map_url = payload.get("map_url") or f"https://www.google.com/maps/search/?api=1&query={latitude},{longitude}"

        if not city or not address or not rent or not contact_email or not contact_number:
            conn.close()
            return jsonify({"message": "City, area, rent, email and contact number are required"}), 400
        if not latitude or not longitude:
            conn.close()
            return jsonify({"message": "Please drop the exact property pin on the map"}), 400

        c.execute(
            """
            INSERT INTO properties (
                owner, city, address, area_type, furnishing, size, bhk, bathroom, rent,
                contact_name, contact_email, contact_number, house_name, nearest_landmark,
                image_urls, status, approval_status, latitude, longitude, map_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session["username"], city, address, area_type, furnishing, size, bhk, bathroom, rent,
                contact_name, contact_email, contact_number, house_name, nearest_landmark,
                json.dumps(image_urls), status, "pending", latitude, longitude, map_url
            )
        )

        conn.commit()

    properties = conn.execute(
        "SELECT * FROM properties WHERE owner=?",
        (session["username"],)
    ).fetchall()

    conn.close()

    return jsonify({
        "properties": [property_payload(prop) for prop in properties],
        "cities": cities,
        "owner": {
            "username": session.get("username"),
            "email": session.get("email") or "",
            "contact_number": session.get("contact_number") or "",
        },
        "message": "Property added successfully. It is pending verification by the admin."
    })


@app.route("/api/owner/properties/<int:property_id>", methods=["PUT"])
def api_owner_property_update(property_id):
    if session.get("role") != "owner":
        return jsonify({"message": "Owner login required"}), 401

    payload = request_payload()
    image_urls = parse_image_urls(payload.get("image_urls"))

    fields = {
        "city": payload.get("city"),
        "address": payload.get("address"),
        "area_type": payload.get("area_type") or "",
        "furnishing": payload.get("furnishing") or "",
        "size": payload.get("size") or 0,
        "bhk": payload.get("bhk") or 0,
        "bathroom": payload.get("bathroom") or 0,
        "rent": payload.get("rent"),
        "contact_name": payload.get("contact_name") or session.get("username"),
        "contact_email": payload.get("contact_email") or session.get("email") or "",
        "contact_number": payload.get("contact_number") or session.get("contact_number") or "",
        "house_name": payload.get("house_name") or "",
        "nearest_landmark": payload.get("nearest_landmark") or "",
        "image_urls": json.dumps(image_urls),
        "status": payload.get("status") or "active",
        "latitude": payload.get("latitude") or 0,
        "longitude": payload.get("longitude") or 0,
        "map_url": payload.get("map_url") or "",
    }
    if fields["latitude"] and fields["longitude"] and not fields["map_url"]:
        fields["map_url"] = f"https://www.google.com/maps/search/?api=1&query={fields['latitude']},{fields['longitude']}"

    if not fields["city"] or not fields["address"] or not fields["rent"] or not fields["contact_email"] or not fields["contact_number"]:
        return jsonify({"message": "City, area, rent, email and contact number are required"}), 400
    if not fields["latitude"] or not fields["longitude"]:
        return jsonify({"message": "Please drop the exact property pin on the map"}), 400

    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM properties WHERE id=? AND owner=?",
        (property_id, session["username"])
    ).fetchone()

    if not existing:
        conn.close()
        return jsonify({"message": "Property not found"}), 404

    conn.execute(
        """
        UPDATE properties SET
            city=?, address=?, area_type=?, furnishing=?, size=?, bhk=?, bathroom=?, rent=?,
            contact_name=?, contact_email=?, contact_number=?, house_name=?, nearest_landmark=?,
            image_urls=?, status=?, latitude=?, longitude=?, map_url=?, approval_status='pending'
        WHERE id=? AND owner=?
        """,
        (
            fields["city"], fields["address"], fields["area_type"], fields["furnishing"],
            fields["size"], fields["bhk"], fields["bathroom"], fields["rent"],
            fields["contact_name"], fields["contact_email"], fields["contact_number"],
            fields["house_name"], fields["nearest_landmark"], fields["image_urls"], fields["status"],
            fields["latitude"], fields["longitude"], fields["map_url"],
            property_id, session["username"]
        )
    )
    conn.commit()
    properties = conn.execute(
        "SELECT * FROM properties WHERE owner=?",
        (session["username"],)
    ).fetchall()
    conn.close()

    return jsonify({
        "properties": [property_payload(prop) for prop in properties],
        "message": "Property updated successfully. It is pending verification by the admin."
    })


@app.route("/api/owner/properties/<int:property_id>/status", methods=["PATCH"])
def api_owner_property_status(property_id):
    if session.get("role") != "owner":
        return jsonify({"message": "Owner login required"}), 401

    payload = request_payload()
    status = payload.get("status")
    if status not in ["active", "deactive"]:
        return jsonify({"message": "Invalid property status"}), 400

    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM properties WHERE id=? AND owner=?",
        (property_id, session["username"])
    ).fetchone()
    if not existing:
        conn.close()
        return jsonify({"message": "Property not found"}), 404

    conn.execute(
        "UPDATE properties SET status=? WHERE id=? AND owner=?",
        (status, property_id, session["username"])
    )
    conn.commit()
    conn.close()
    return jsonify({"id": property_id, "status": status})


@app.route("/api/alerts", methods=["POST"])
def api_alerts():
    payload = request_payload()
    area = payload.get("area")
    budget = payload.get("budget")
    email = payload.get("email")

    if not area or not budget or not email:
        return jsonify({"message": "Area, budget and email are required"}), 400

    alerts.append({
        "area": area,
        "budget": float(budget),
        "email": email
    })

    return jsonify({
        "message": f"Alert set for {area} under ₹{budget}"
    })

# -----------------------------
# Google Login Routes
# -----------------------------
@app.route('/google-login')
def google_login():
    if google is None:
        flash("Google login is not configured. Please use username and password login.")
        return redirect("/login")

    redirect_uri = url_for('google_authorize', _external=True)
    return google.authorize_redirect(redirect_uri)


@app.route('/authorize')
def google_authorize():
    if google is None:
        flash("Google login is not configured. Please use username and password login.")
        return redirect("/login")

    token = google.authorize_access_token()
    user_info = token['userinfo']

    email = user_info['email']
    username = email.split("@")[0]

    conn = get_db()
    c = conn.cursor()

    c.execute("SELECT * FROM users WHERE email=?", (email,))
    user = c.fetchone()

    if not user:
        c.execute(
            "INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)",
            (username, "", email, "user")
        )
        conn.commit()

    conn.close()

    session["username"] = username
    session["role"] = "user"
    session["email"] = email
    session["contact_number"] = ""

    return redirect("/")
# -----------------------------
# Signup
# -----------------------------
@app.route("/signup", methods=["GET", "POST"])
def signup():

    if request.method == "POST":

        username = request.form["username"]
        password_raw = request.form["password"]
        confirm_password = request.form["confirm_password"]
        role = request.form["role"]
        email = request.form.get("email", "").strip()
        contact_number = request.form.get("contact_number", "").strip()

        if role == "owner" and (not email or not contact_number):
            flash("Owners must add email and contact number")
            return redirect("/signup")

        # Confirm password check
        if password_raw != confirm_password:
            flash("Passwords do not match")
            return redirect("/signup")

        if user_exists(username):
            flash("User already exists")
            return redirect("/signup")

        password = generate_password_hash(password_raw)

        conn = get_db()
        c = conn.cursor()

        c.execute(
            "INSERT INTO users (username, password, email, contact_number, role) VALUES (?, ?, ?, ?, ?)",
            (username, password, email, contact_number, role)
        )

        conn.commit()
        flash("Signup successful!")
        conn.close()

        return redirect("/login")

    return render_template("signup.html")

# -----------------------------
# Login
# -----------------------------
@app.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "POST":

        username = request.form["username"]
        password = request.form["password"]

        conn = get_db()
        c = conn.cursor()

        c.execute(
            "SELECT * FROM users WHERE username=?",
            (username,)
        )

        user = c.fetchone()
        conn.close()

        if user and user["password"] == "":
            flash("Please login using Google")
            return redirect("/login")

        if user and check_password_hash(user["password"], password):

            session["username"] = user["username"]
            session["role"] = user["role"]
            session["email"] = user["email"]
            session["contact_number"] = user["contact_number"]

            if user["role"] == "admin":
                return redirect("/admin")

            elif user["role"] == "owner":
                return redirect("/owner")

            else:
                return redirect("/")

        flash("Invalid login")

    return render_template("login.html")

# -----------------------------
# Admin Dashboard
# -----------------------------
@app.route("/admin")
def admin():

    if session.get("role") != "admin":
        return redirect("/login")

    conn = get_db()

    users = conn.execute(
        """
        SELECT
            u.id,
            u.username,
            u.email,
            u.contact_number,
            u.role,
            COUNT(p.id) AS property_count
        FROM users u
        LEFT JOIN properties p ON p.owner = u.username
        GROUP BY u.id, u.username, u.email, u.contact_number, u.role
        ORDER BY
            CASE u.role WHEN 'admin' THEN 0 WHEN 'owner' THEN 1 ELSE 2 END,
            u.username
        """
    ).fetchall()

    conn.close()

    return render_template(
        "admin.html",
        users=users,
        properties=all_owner_properties()
    )


# -----------------------------
# Owner Dashboard
# -----------------------------
@app.route("/owner", methods=["GET", "POST"])
def owner():

    if session.get("role") != "owner":
        return redirect("/login")

    conn = get_db()
    c = conn.cursor()

    if request.method == "POST":

        city = request.form.get("city")
        address = request.form["address"]
        rent = request.form["rent"]
        area_type = request.form.get("area_type", "")
        furnishing = request.form.get("furnishing", "")
        size = request.form.get("size", 0)
        bhk = request.form.get("bhk", 0)
        bathroom = request.form.get("bathroom", 0)
        contact_name = request.form.get("contact_name") or session.get("username")
        contact_email = request.form.get("contact_email") or session.get("email") or ""
        contact_number = request.form.get("contact_number") or session.get("contact_number") or ""

        c.execute(
            """
            INSERT INTO properties (
                owner, city, address, area_type, furnishing, size, bhk, bathroom, rent,
                contact_name, contact_email, contact_number, approval_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session["username"], city, address, area_type, furnishing, size, bhk, bathroom, rent,
                contact_name, contact_email, contact_number, "pending"
            )
        )

        conn.commit()

    properties = conn.execute(
        "SELECT * FROM properties WHERE owner=?",
        (session["username"],)
    ).fetchall()

    conn.close()

    return render_template(
        "owner.html",
        properties=properties,
        cities=cities
    )
# -----------------------------
# User Home (Prediction)
# -----------------------------
@app.route("/", methods=["GET", "POST"])
def home():

    if request.method == "POST":

        if session.get("role") != "user":
            flash("Please login before getting a rent prediction")
            return redirect("/login")

        try:

            size = float(request.form["size"])
            bhk = int(request.form["bhk"])
            bathroom = int(request.form["bathroom"])

            city = request.form["city"]
            area = request.form["area"]
            area_type = request.form["area_type"]
            furnishing = request.form["furnishing"]

            payload = {
                "size": size,
                "bhk": bhk,
                "bathroom": bathroom,
                "city": city,
                "area": area,
                "area_type": area_type,
                "furnishing": furnishing
            }
            final_rent = predict_rent_from_payload(payload)

            return render_template(
                "result.html",
                rent=final_rent,
                size=size,
                bhk=bhk,
                bathroom=bathroom,
                area_type=area_type,
                furnishing=furnishing,
                area=area,
                city=city,
                market_insights=build_market_insights(payload, final_rent)
            )

        except Exception as e:
            return f"Error: {str(e)}"

    return render_template(
        "index.html",
        cities=cities
    )


# -----------------------------
# Area API
# -----------------------------
@app.route("/get_areas")
def get_areas():

    city = request.args.get("city")
    q = request.args.get("q", "")

    df_city = data[data["City"] == city]
    areas = df_city["Area Locality"].dropna().unique()

    result = filter_areas_for_query(areas, q)

    return jsonify(result)


# -----------------------------
# Rent Alert
# -----------------------------
alerts = []

@app.route("/set_alert", methods=["POST"])
def set_alert():

    area = request.form.get("area")
    budget = request.form.get("budget")
    email = request.form.get("email")

    alerts.append({
        "area": area,
        "budget": float(budget),
        "email": email
    })

    return f"✅ Alert set for {area} under ₹{budget}"


# -----------------------------
# Logout
# -----------------------------
@app.route("/logout")
def logout():

    session.clear()

    return redirect("/")


# -----------------------------
# Run App
# -----------------------------
if __name__ == "__main__":
    app.run(debug=True)
