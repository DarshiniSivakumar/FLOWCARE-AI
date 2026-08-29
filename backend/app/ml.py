import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "model.joblib")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.joblib")

SURGERY_TYPE_MAP = {
    "General": 0,
    "Cardiac": 1,
    "Orthopedic": 2,
    "Neuro": 3,
    "Ophthalmic": 4
}

def generate_synthetic_data(num_samples: int = 1500) -> pd.DataFrame:
    """
    Generates a realistic synthetic dataset for hospital surgery workflow delays.
    """
    np.random.seed(42)
    
    surgery_types = list(SURGERY_TYPE_MAP.keys())
    
    data = {
        "surgery_type": np.random.choice(surgery_types, size=num_samples),
        "scheduled_hour": np.random.randint(6, 22, size=num_samples),
        "expected_duration": np.random.choice([30, 45, 60, 90, 120, 180, 240], size=num_samples),
        "ot_utilization": np.random.uniform(30.0, 95.0, size=num_samples),
        "anaesthesia_ready": np.random.choice([0, 1], p=[0.15, 0.85], size=num_samples),
        "patient_ready": np.random.uniform(0.0, 1.0, size=num_samples),
        "cssd_ready": np.random.choice([0, 1], p=[0.10, 0.90], size=num_samples),
        "transfer_delay": np.random.exponential(scale=5.0, size=num_samples),
        "previous_workflow_delays": np.random.exponential(scale=8.0, size=num_samples),
        "surgeon_available": np.random.choice([0, 1], p=[0.08, 0.92], size=num_samples)
    }
    
    df = pd.DataFrame(data)
    
    # Calculate synthetic delay based on logical operational relationships
    # Base delay
    delay = np.random.normal(5, 3, size=num_samples)
    
    # Add rules-based delay contribution
    # Anaesthesia NOT ready: +15-35 minutes
    delay += (1 - df["anaesthesia_ready"]) * np.random.uniform(15, 35, size=num_samples)
    
    # CSSD NOT ready: +20-45 minutes
    delay += (1 - df["cssd_ready"]) * np.random.uniform(20, 45, size=num_samples)
    
    # Surgeon NOT available: +30-60 minutes
    delay += (1 - df["surgeon_available"]) * np.random.uniform(30, 60, size=num_samples)
    
    # Patient ready score is low (e.g. < 0.8): adds delay
    delay += (1.0 - df["patient_ready"]) * np.random.uniform(10, 25, size=num_samples)
    
    # Transfer delay directly impacts actual start time
    delay += df["transfer_delay"] * np.random.uniform(1.0, 1.5, size=num_samples)
    
    # Previous delays compound
    delay += df["previous_workflow_delays"] * np.random.uniform(0.8, 1.2, size=num_samples)
    
    # High OT utilization leads to queues
    high_util = df["ot_utilization"] > 80
    delay += high_util * np.random.uniform(8, 20, size=num_samples)
    
    # Clip delay to be at least 0 minutes
    df["delay_minutes"] = np.clip(delay, 0, None)
    
    return df

def train_model():
    """
    Trains the Random Forest model and saves it.
    """
    print("Generating synthetic historical hospital workflow dataset...")
    df = generate_synthetic_data()
    
    # Preprocess
    df_encoded = df.copy()
    df_encoded["surgery_type"] = df_encoded["surgery_type"].map(SURGERY_TYPE_MAP)
    
    X = df_encoded.drop(columns=["delay_minutes"])
    y = df_encoded["delay_minutes"]
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    model = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42)
    model.fit(X_scaled, y)
    
    print(f"Training completed. R2 score on training: {model.score(X_scaled, y):.4f}")
    
    # Save model and scaler
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    print(f"Model and scaler saved to {MODEL_DIR}")

def load_or_train_model():
    """
    Loads model and scaler, training them if they do not exist.
    """
    if not os.path.exists(MODEL_PATH) or not os.path.exists(SCALER_PATH):
        print("Model or scaler not found. Running training now...")
        train_model()
    
    model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    return model, scaler

# Load models statically on import so we are ready
try:
    model, scaler = load_or_train_model()
except Exception as e:
    print(f"Failed to load or train model: {e}. Re-trying training.")
    train_model()
    model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)

def predict_delay(
    surgery_type: str,
    scheduled_hour: int,
    expected_duration: int,
    ot_utilization: float,
    anaesthesia_ready: bool,
    patient_ready_score: float,
    cssd_ready: bool,
    transfer_delay: float,
    previous_workflow_delays: float,
    surgeon_available: bool
) -> dict:
    """
    Predicts delay minutes, risk level, and confidence for a surgery case.
    """
    # Map surgery type to integer
    type_code = SURGERY_TYPE_MAP.get(surgery_type, 0)
    
    # Build feature vector
    features = np.array([[
        type_code,
        scheduled_hour,
        expected_duration,
        ot_utilization,
        1.0 if anaesthesia_ready else 0.0,
        patient_ready_score,
        1.0 if cssd_ready else 0.0,
        transfer_delay,
        previous_workflow_delays,
        1.0 if surgeon_available else 0.0
    ]])
    
    # Scale features
    features_scaled = scaler.transform(features)
    
    # Predict delay in minutes
    predicted_delay = float(model.predict(features_scaled)[0])
    
    # Determine risk level based on predicted delay
    if predicted_delay < 15:
        risk_level = "LOW"
    elif predicted_delay < 30:
        risk_level = "MEDIUM"
    elif predicted_delay < 45:
        risk_level = "HIGH"
    else:
        risk_level = "CRITICAL"
        
    # Calculate confidence based on standard deviation of decision tree predictions (forest ensemble variance)
    # Since RandomForestRegressor has estimators_, we can compute the standard error
    preds = [estimator.predict(features_scaled)[0] for estimator in model.estimators_]
    std_dev = np.std(preds)
    
    # Higher std_dev means lower confidence
    # Confidence is mapped from 50% to 98%
    conf = max(50.0, min(98.0, 100.0 - (std_dev * 1.5)))
    
    return {
        "predicted_delay_minutes": round(predicted_delay, 1),
        "risk_level": risk_level,
        "confidence": round(conf, 1)
    }

if __name__ == "__main__":
    # If run directly, run training
    train_model()
