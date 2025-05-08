import { useRef, useState, useEffect } from "react";
import io from "socket.io-client";
import Paho from "paho-mqtt";
import { format, parseISO } from "date-fns";
import {
  handleAttemptLogin,
  handleAttemptLogout,
  handleFetchDeviceList,
  handleFetchSubDeviceList,
  handleQueryRecordGPS,
} from "../utils/common";
import { generateFakeGPSData } from "../utils/tool";

function AutoLogin() {
  const userInfo = {
    username: "becamex",
    password: "vn123456",
    realm: "puc.com",
    webpucUrl: "https://45.118.137.185:16888",
    pwdNeedEncrypt: false,
  };

  const [embeddedCallId, setEmbeddedCallId] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  const intervalGPSRef = useRef(null);
  const socketRef = useRef(null);
  const mqttClient = useRef(null);
  const mqttClientGPS = useRef(null);
  const deviceListInfo = useRef({});
  const subDeviceList = useRef([]);
  const actionStatus = useRef("idle");

  const MQTT_BROKER = "103.129.80.171";
  const MQTT_PORT = "8099";
  const MQTT_USERNAME = "becaiot";
  const MQTT_PASSWORD = "becaiot";
  const MQTT_GPS_TOPIC = "alert-security-gps";
  const MQTT_TOPIC = "alert-security-media";
  const MQTT_TOPIC_RESPONSE = "alert-security-media-response";

  const hookFlag = 0;
  const duplexFlag = 1;
  const call_type = "video";

  let incomingEvtGuid = null;
  let answerAckGuid = null;
  let hangupEvtGuid = null;
  let forceHangupEvtGuid = null;

  const handleIncomingCall = async (incomingInfo) => {
    if ([0, 2].includes(incomingInfo.attribute.call_mode)) {
      setIncomingCall(incomingInfo);
    }
  };

  const handleLoginStatusChange = (loginStatus) => {
    if ([0, 2, 3].includes(loginStatus.login_status)) {
      if (actionStatus.current === "idle") {
        handleAttemptLogin(userInfo);
      }
    }
  };

  const handleEndCall = async () => {
    setEmbeddedCallId(null);
    setIncomingCall(null);
  };
  function teardownCallHandlers() {
    if (hangupEvtGuid) {
      window.lemon.call.removeHangupEvt(hangupEvtGuid);
    }
    if (forceHangupEvtGuid) {
      window.lemon.call.removeForceHangupEvt(forceHangupEvtGuid);
    }

    if (incomingEvtGuid) {
      window.lemon.call.removeIncomingEvt(incomingEvtGuid);
    }
    if (answerAckGuid) {
      window.lemon.call.removeAnswerAckEvt(answerAckGuid);
    }
  }
  function setupWebSocket() {
    const SOCKET_URL = "http://192.168.101.3:6173";
    const STREAM_BASE_URL = "http://192.168.101.3:8173/stream";

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    // 🔌 Khi kết nối thành công
    socket.on("connect", () => {
      console.log("✅ WebSocket Connected");
      // Gửi trạng thái ban đầu để sync
      socket.emit("call", {
        status: "idle",
        basedata_id: null,
      });
    });

    // ☎️ Khi nhận cuộc gọi đến
    socket.on("call.offer", async (offer) => {
      try {
        console.log("📞 Received call.offer:", offer);
        const { deviceId } = offer;
        const device = deviceListInfo[deviceId];

        if (!device || !device.basedata_id) {
          socket.emit("call.answer", {
            url: "",
            statusCode: 404,
            msg: "Device not found or missing basedata_id",
          });
          return;
        }

        // Các thông số stream
        const url = `${STREAM_BASE_URL}/${call_type}/0?hookFlag=${hookFlag}&duplexFlag=${duplexFlag}&basedata_id=${device.basedata_id}`;

        socket.emit("call.answer", {
          url,
          statusCode: 200,
          msg: "success",
        });

        console.log("✅ Sent call.answer with URL:", url);
      } catch (err) {
        console.error("❌ Error handling call.offer:", err);
        socket.emit("call.answer", {
          url: "",
          statusCode: 500,
          msg: "Internal error",
        });
      }
    });

    // 📶 Khi trạng thái cuộc gọi thay đổi
    socket.on("call", async ({ status }) => {
      console.log("🔄 Received call status:", status);
      if (status === "call") {
        actionStatus.current = "call";
        await handleAttemptLogout(); // Dừng session hiện tại để nhận cuộc gọi
      } else if (status === "idle") {
        actionStatus.current = "idle";
        await handleAttemptLogin(userInfo); // Tự động login lại khi rảnh
      }
    });
  }

  const fakeRecordGPS = async () => {
    let gpsDataList = generateFakeGPSData(5);
    mqttClientGPS.publish(MQTT_GPS_TOPIC, JSON.stringify(gpsDataList));
    return gpsDataList;
  };

  const queryRecordGPS = async () => {
    try {
      // Lấy danh sách thiết bị con
      let devicesSubGPS = await handleFetchDeviceList();

      // Dùng cache nếu đã có sẵn
      if (devicesSubGPS && Object.keys(devicesSubGPS).length > 0) {
        subDeviceList.current = devicesSubGPS;
      } else if (subDeviceList.current && Object.keys(subDeviceList.current).length > 0) {
        devicesSubGPS = subDeviceList.current;
      } else {
        console.warn("⚠️ Không có thiết bị con để truy vấn GPS");
        return [];
      }

      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      // start_time: oneMinuteAgo.toISOString(),
      // end_time: now.toISOString(),
      const fromTime = oneMinuteAgo.toISOString();
      const toTime = now.toISOString();
      if (Object.keys(devicesSubGPS).length === 0) return [];

      let gpsDataList = [];
      Object.keys(devicesSubGPS).forEach(async (alias) => {
        const device = devicesSubGPS[alias];
        let basedata_id = device.basedata_id;
        if (basedata_id){
          try {
            const response = await handleQueryRecordGPS(
              basedata_id,
              fromTime,
              toTime
            );
            if (response?.length > 0) {
              const { longitude, latitude, gps_datetime } = response[0];
              gpsDataList.push({
                deviceId: alias,
                lng: longitude,
                lat: latitude,
                dateTime: gps_datetime,
              });
            } 
          } catch (err) {
            console.error(`##### ❌ Failed to get GPS for device ${alias}:`, err);
          }
        }
 
      })

      console.log("#### 📡 mqttClientGPS publish:", gpsDataList);
      mqttClient.current.publish(MQTT_GPS_TOPIC, JSON.stringify(gpsDataList));

      return gpsDataList;
    } catch (err) {
      console.error("❌ queryRecordGPS failed:", err);
      return [];
    }
  };

  useEffect(() => {

    incomingEvtGuid = window.lemon.call.addIncomingEvt(handleIncomingCall);
    answerAckGuid = window.lemon.call.addAnswerAckEvt(() =>
      setEmbeddedCallId(null)
    );
    hangupEvtGuid = window.lemon.call.addHangupEvt(handleEndCall);
    forceHangupEvtGuid = window.lemon.call.addForceHangupEvt(handleEndCall);
    const loginStatusCallbackId =
      window.lemon.login.addLoginStatusChangeListener(handleLoginStatusChange);

    handleAttemptLogin(userInfo);

    setupWebSocket();
    intervalGPSRef.current = setInterval(() => {
      queryRecordGPS();
    }, 60 * 1000);
    return () => {
      clearInterval(intervalGPSRef.current);
      window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId);
      teardownCallHandlers();
      handleAttemptLogout();
    };
  }, []);

  useEffect(() => {

    const clientId = "client-" + Math.random();
    const mqtt_client = new Paho.Client(
      `ws://${MQTT_BROKER}:${MQTT_PORT}/ws`,
      clientId
    );
    mqttClient.current = mqtt_client;

    mqtt_client.onConnectionLost = (responseObject) => {
      console.warn("📡 MQTT Connection lost:", responseObject.errorMessage);
    };

    mqtt_client.onMessageArrived = async (message) => {
      try {
        console.log("#### 📩 MQTT message received:", message.payloadString);

        if (message.destinationName === MQTT_TOPIC) {
          const payload = JSON.parse(message.payloadString);
          const alias = payload.DeviceId;
          const formated_alias = alias; // You can format here if needed

          let devices_info = await handleFetchDeviceList();

          if (devices_info && Object.keys(devices_info).length > 0) {
            deviceListInfo.current = devices_info;

          } else if (deviceListInfo.current && Object.keys(deviceListInfo.current).length > 0) {
            devices_info = deviceListInfo.current;
          } else {
            console.warn("#### ⚠️ No device info available");
            return;
          }

          const basedata_id = devices_info[formated_alias]?.basedata_id;

          const responsePayload = basedata_id
            ? {
                DeviceId: alias,
                url: `http://192.168.101.3:8173/stream/${call_type}/0?hookFlag=${hookFlag}&duplexFlag=${duplexFlag}&basedata_id=${basedata_id}`,
                statusCode: 200,
                msg: "success",
              }
            : {
                DeviceId: alias,
                url: "",
                statusCode: 404,
                msg: "basedata_id not found",
              };

          console.log("#### 📤 MQTT response:", responsePayload);
          mqtt_client.publish(
            MQTT_TOPIC_RESPONSE,
            JSON.stringify(responsePayload)
          );
        }
      } catch (err) {
        console.error("❌ Error handling MQTT message:", err);
      }
    };

    mqtt_client.connect({
      onSuccess: () => {
        console.log("✅ MQTT Connected:", clientId);
        mqtt_client.subscribe(MQTT_TOPIC);
      },
      onFailure: (error) => {
        console.error("❌ MQTT Connection failed:", error.errorMessage);
      },
      userName: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      reconnect: true,
      keepAliveInterval: 10,
    });

    return () => {
      console.log("🔌 Disconnecting MQTT...");
      mqtt_client.disconnect();
    };
  }, []);

  window.onbeforeunload = () => {
    window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId);
    window.lemon.call.removeIncomingEvt(incomingEvtGuid);
    window.lemon.call.removeAnswerAckEvt(answerAckGuid);
    handleAttemptLogout();
  };

  useEffect(() => {
    const onBasedataIdChange = (event) => {
      if (event.key !== "basedata_id") return;

      const newValue = event.newValue;
      console.log("🛠️ basedata_id changed:", newValue);

      if (!newValue) {
        console.log("🔁 basedata_id removed — reattempting login");
        handleAttemptLogin(userInfo);
      } else {
        console.log("🔒 basedata_id set — logging out");
        handleAttemptLogout();
      }
    };

    window.addEventListener("storage", onBasedataIdChange);

    return () => {
      window.removeEventListener("storage", onBasedataIdChange);
    };
  }, []);

  const handleAnswerCall = async () => {
    if (!incomingCall) {
      console.warn("🚫 No incoming call to answer");
      return;
    }

    const { duplex_flag, listen_flag } = incomingCall.attribute || {};
    const { caller_alias, call_id: callId } = incomingCall;

    console.log("📞 Answering call:", callId);
    console.log("📥 Incoming call data:", incomingCall);

    if (!callId || !caller_alias) {
      console.error("❌ Missing callId or caller_alias");
      return;
    }

    try {
      const streamUrl = `http://192.168.101.3:8173/stream/video/1?duplex_flag=${duplex_flag}&listen_flag=${listen_flag}&call_id=${callId}&caller_alias=${caller_alias}`;
      setEmbeddedCallId(streamUrl);
      console.log("✅ Call stream URL set:", streamUrl);
    } catch (error) {
      console.error("🔥 Error setting up call stream:", error);
    }
  };

  return (
    <>
      <h1>Auto Login</h1>
      {incomingCall && (
        <div>
          <p>Cuộc gọi đến từ: {incomingCall.caller_number}</p>
          <input type="text" value={embeddedCallId} />
          <button onClick={() => handleAnswerCall()}>Trả lời</button>
          {/* <button onClick={async () => await handleHangup(currentCallId)}>
      Tắt cuộc gọi
    </button> */}
        </div>
      )}
    </>
  );
}

export default AutoLogin;
