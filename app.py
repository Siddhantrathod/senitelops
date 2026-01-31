from flask import Flask, jsonify, request

app = Flask(__name__)

# Sample data
users = [
    {"id": 1, "name": "Alice", "email": "alice@example.com"},
    {"id": 2, "name": "Bob", "email": "bob@example.com"},
]

# Endpoint 1: Home/Welcome
@app.route('/', methods=['GET'])
def home():
    return jsonify({
        "message": "Welcome to Flask API",
        "version": "1.0",
        "endpoints": [
            "GET /",
            "GET /api/users",
            "GET /api/users/<id>",
            "POST /api/users"
        ]
    }), 200

# Endpoint 2: Get all users
@app.route('/api/users', methods=['GET'])
def get_users():
    return jsonify({
        "status": "success",
        "data": users
    }), 200

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"}), 200

# Endpoint 3: Get user by ID
@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    user = next((u for u in users if u["id"] == user_id), None)
    if user:
        return jsonify({
            "status": "success",
            "data": user
        }), 200
    return jsonify({
        "status": "error",
        "message": "User not found"
    }), 404

# Endpoint 4: Create a new user
@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.get_json()
    
    if not data or not data.get("name") or not data.get("email"):
        return jsonify({
            "status": "error",
            "message": "Name and email are required"
        }), 400
    
    new_user = {
        "id": max(u["id"] for u in users) + 1 if users else 1,
        "name": data["name"],
        "email": data["email"]
    }
    users.append(new_user)
    
    return jsonify({
        "status": "success",
        "message": "User created",
        "data": new_user
    }), 201

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
