import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "model.joblib")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.joblib")
EVAL_METRICS_PATH = os.path.join(MODEL_DIR, "model_eval.json")

FEATURE_NAMES = [
    "Surgery Type",
    "Scheduled Hour",
    "Expected Duration (min)",
    "OT Utilization (%)",
    "Anaesthesia Ready",
    "Patient Readiness Score",
    "CSSD Pack Ready",
    "Transfer Delay (min)",
    "Previous Workflow Delays (min)",
    "Surgeon Available",
]

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

def _risk_level(delay: float) -> str:
    if delay < 15:
        return "LOW"
    elif delay < 30:
        return "MEDIUM"
    elif delay < 45:
        return "HIGH"
    return "CRITICAL"


def train_model():
    """
    Trains the Random Forest model with an 80/20 train-test split,
    evaluates on the held-out set, and saves all artifacts.
    """
    print("Generating synthetic historical hospital workflow dataset...")
    df = generate_synthetic_data()
    
    # Preprocess
    df_encoded = df.copy()
    df_encoded["surgery_type"] = df_encoded["surgery_type"].map(SURGERY_TYPE_MAP)
    
    X = df_encoded.drop(columns=["delay_minutes"])
    y = df_encoded["delay_minutes"]
    
    # 80/20 train-test split (stratified not needed for regression)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    model = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42)
    model.fit(X_train_scaled, y_train)
    
    # --- Evaluation on held-out test set ---
    y_pred = model.predict(X_test_scaled)

    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    train_r2 = model.score(X_train_scaled, y_train)

    # Risk classification accuracy on the test set
    y_test_risk = [_risk_level(v) for v in y_test]
    y_pred_risk = [_risk_level(v) for v in y_pred]
    risk_correct = sum(a == b for a, b in zip(y_test_risk, y_pred_risk))
    risk_accuracy = round((risk_correct / len(y_test_risk)) * 100, 2)

    # Feature importances
    importances = model.feature_importances_.tolist()
    feature_importance_list = [
        {"feature": name, "importance": round(imp * 100, 2)}
        for name, imp in sorted(
            zip(FEATURE_NAMES, importances), key=lambda x: x[1], reverse=True
        )
    ]

    # Prediction distribution on test set (for histogram)
    risk_distribution = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for r in y_pred_risk:
        risk_distribution[r] += 1

    # Sample predictions (12 samples from test set)
    sample_indices = np.random.RandomState(0).choice(len(X_test), size=min(12, len(X_test)), replace=False)
    samples = []
    for idx in sample_indices:
        actual = float(y_test.iloc[idx])
        predicted = float(y_pred[idx])
        samples.append({
            "actual_delay": round(actual, 1),
            "predicted_delay": round(predicted, 1),
            "actual_risk": _risk_level(actual),
            "predicted_risk": _risk_level(predicted),
            "correct": _risk_level(actual) == _risk_level(predicted),
            "error": round(abs(predicted - actual), 1)
        })

    eval_metrics = {
        "model_type": "RandomForestRegressor",
        "n_estimators": 100,
        "max_depth": 12,
        "training_samples": len(X_train),
        "test_samples": len(X_test),
        "total_samples": len(X),
        "train_r2": round(train_r2, 4),
        "test_r2": round(r2, 4),
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "risk_classification_accuracy": risk_accuracy,
        "feature_importances": feature_importance_list,
        "risk_distribution": [
            {"risk": k, "count": v} for k, v in risk_distribution.items()
        ],
        "sample_predictions": samples,
        "features": FEATURE_NAMES,
        "target": "delay_minutes",
    }

    print(f"Training R2: {train_r2:.4f} | Test R2: {r2:.4f} | MAE: {mae:.2f} min | RMSE: {rmse:.2f} min | Risk Accuracy: {risk_accuracy}%")
    
    # Save model, scaler, and eval metrics
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    with open(EVAL_METRICS_PATH, "w") as f:
        json.dump(eval_metrics, f)
    print(f"Model, scaler, and evaluation metrics saved to {MODEL_DIR}")

    return eval_metrics

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

def get_model_evaluation() -> dict:
    """
    Returns cached evaluation metrics from the last training run.
    Falls back to re-evaluating on a fresh synthetic test set if not cached.
    """
    if os.path.exists(EVAL_METRICS_PATH):
        with open(EVAL_METRICS_PATH, "r") as f:
            return json.load(f)
    # If cache not found, regenerate
    return train_model()


def predict_delay_from_dict(params: dict) -> dict:
    """
    Accepts a dict of input parameters and returns a full prediction result
    including the raw feature vector for explainability.
    """
    surgery_type = params.get("surgery_type", "General")
    scheduled_hour = int(params.get("scheduled_hour", 8))
    expected_duration = int(params.get("expected_duration", 60))
    ot_utilization = float(params.get("ot_utilization", 65.0))
    anaesthesia_ready = bool(params.get("anaesthesia_ready", True))
    patient_ready_score = float(params.get("patient_ready_score", 0.8))
    cssd_ready = bool(params.get("cssd_ready", True))
    transfer_delay = float(params.get("transfer_delay", 0.0))
    previous_workflow_delays = float(params.get("previous_workflow_delays", 0.0))
    surgeon_available = bool(params.get("surgeon_available", True))

    result = predict_delay(
        surgery_type=surgery_type,
        scheduled_hour=scheduled_hour,
        expected_duration=expected_duration,
        ot_utilization=ot_utilization,
        anaesthesia_ready=anaesthesia_ready,
        patient_ready_score=patient_ready_score,
        cssd_ready=cssd_ready,
        transfer_delay=transfer_delay,
        previous_workflow_delays=previous_workflow_delays,
        surgeon_available=surgeon_available,
    )
    result["inputs"] = {
        "surgery_type": surgery_type,
        "scheduled_hour": scheduled_hour,
        "expected_duration": expected_duration,
        "ot_utilization": ot_utilization,
        "anaesthesia_ready": anaesthesia_ready,
        "patient_ready_score": patient_ready_score,
        "cssd_ready": cssd_ready,
        "transfer_delay": transfer_delay,
        "previous_workflow_delays": previous_workflow_delays,
        "surgeon_available": surgeon_available,
    }
    return result


if __name__ == "__main__":
    # If run directly, run training and print evaluation
    metrics = train_model()
    print(json.dumps(metrics, indent=2))
