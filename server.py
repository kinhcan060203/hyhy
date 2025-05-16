from flask import Flask, request
from flask_socketio import SocketIO, emit
import random

app = Flask(__name__)
app.config["SECRET_KEY"] = "secret!"
socketio = SocketIO(app, cors_allowed_origins="*")

clients = set()

masters = {}


@socketio.on("connect")
def handle_connect():
    clients.add(request.sid)
    print(f"🟢 Client {request.sid} đã kết nối!")
    emit("server_message", {"message": "Bạn đã kết nối đến signaling server."})


@socketio.on("add_master")
def handle_add_master(data):
    master_id = data["master_id"]
    masters[master_id] = request.sid
    print(f"🧑‍💼 Master {master_id} (SID: {request.sid}) đã được thêm vào danh sách")


@socketio.on("disconnect")
def handle_disconnect():
    clients.discard(request.sid)
    # Remove master if disconnected
    if request.sid in masters.values():
        print("## masters", masters)
        for master_id, sid in list(masters.items()):
            if sid == request.sid:
                print(f"🔴 Master {master_id} đã ngắt kết nối")
                masters.pop(master_id)
        # Random one master and send message to this
        if masters:
            random_master_id = random.choice(list(masters.keys()))
            random_master_sid = masters[random_master_id]
            print(
                f"🔴 Gửi thông báo đến master {random_master_id} (SID: {random_master_sid})"
            )
            emit(
                "restart_master",
                {"message": f"Master {random_master_id} đã ngắt kết nối."},
                room=random_master_sid,
            )
        else:
            print("🔴 Không còn master nào để thông báo.")
    print(f"🔴 Client {request.sid} đã ngắt kết nối")


@socketio.on("disconnect_master")
def handle_disconnect_master():
    if request.sid in masters.values():
        print("## masters", masters)
        for master_id, sid in list(masters.items()):
            if sid == request.sid:
                print(f"🔴 Master {master_id} đã ngắt kết nối")
                del masters[master_id]
        # Random one master and send message to this
        if masters:
            random_master_id = random.choice(list(masters.keys()))
            random_master_sid = masters[random_master_id]
            emit(
                "restart_master",
                {"message": f"Master {random_master_id} đã ngắt kết nối."},
                room=random_master_sid,
            )
        else:
            print("🔴 Không còn master nào để thông báo.")


@socketio.on("offer")
def handle_offer(data):
    print(f"📩 Nhận OFFER từ {request.sid}: {data}")
    emit("offer", data, broadcast=True, include_self=False)  # Gửi đến các client khác


@socketio.on("call")
def handle_answer(data):
    print(f"📩 Nhận call từ {request.sid}: {data}")
    emit("call", data, broadcast=True, include_self=False)  # Gửi đến các client khác


@socketio.on("call.offer")
def handle_request_call(data):
    print(f"📩 Nhận request call từ {request.sid}: {data}")
    emit(
        "call.offer", data, broadcast=True, include_self=False
    )  # Gửi đến các client khác


@socketio.on("call.answer")
def handle_answer_call(data):
    print(f"📩 Nhận answer call từ {request.sid}: {data}")
    emit("call.answer", data, broadcast=True, include_self=False)


# http://45.118.136.10:8006/Device/Gps
@app.route("/")
def index():
    return "🔥 WebRTC Signaling Server đang chạy!"


if __name__ == "__main__":
    import eventlet
    import eventlet.wsgi

    socketio.run(app, host="0.0.0.0", port=6173, debug=True)
