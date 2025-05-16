import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import io from "socket.io-client";
import { userInfo }  from "../utils/constants";
import Paho from "paho-mqtt";
import { generateFakeGPSData, median } from "../utils/tool";
import {
  handleAttemptLogin,
  handleAttemptLogout,
  handleFetchDeviceList,
  handleFetchSubDeviceList,
  handleQueryRecordGPS,
} from "../utils/common";


function StreamCall() {
  const { call_type, call_mode } = useParams();
  const query = new URLSearchParams(useLocation().search);

  const socket = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const intervalGPSRef = useRef(null);
  const mqttClient = useRef(null);
  const subDeviceList = useRef(null);
  const sessionId = useRef(null);

  
  const MQTT_BROKER = "103.129.80.171";
  const MQTT_PORT = "8099";
  const MQTT_USERNAME = "becaiot";
  const MQTT_PASSWORD = "becaiot";
  const MQTT_GPS_TOPIC = "alert-security-gps";
  const MQTT_TOPIC = "alert-security-media";
  const MQTT_TOPIC_RESPONSE = "alert-security-media-response";
  
  const params = {
    hookFlag: query.get("hookFlag"),
    duplexFlag: query.get("duplexFlag"),
    basedata_id: query.get("basedata_id"),
    listen_flag: query.get("listen_flag"),
    call_id: query.get("call_id"),
    session_id: query.get("session_id"),

  };
  const loginStatusCallbackId = useRef(null);
  let answerAckGuid = null;
  let mediaStreamGuid = null;
  let hangupEvtGuid = null;
  let forceHangupEvtGuid = null;
  const callSessionId = useRef(null);
  const basedataId = useRef(null);

  const [statusMap, setStatusMap] = useState("idle");
  const statusMapRef = useRef(statusMap);
  const handleEndCall = async (callInfo) => {
    if (callInfo?.disconnect_reason === 0) {
      await hangupCall(callInfo.call_id);
      teardownCallHandlers();

    }
  };

  const setupCallHandlers = async () => {
    window.lemon.call.addAnswerAckEvt(() => {
      setStatusMap("talking");
      statusMapRef.current = "talking";
      console.log("### 📞 Call answered");
    });
    mediaStreamGuid = window.lemon.call.addMediaStream(
      (callId, stream, type) => {
        if (type === "video_src" && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        } else if (type === "video_dst" && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        } else if (type === "audio_dst" && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
        }
      }
    );

    hangupEvtGuid = window.lemon.call.addHangupEvt(handleEndCall);
    forceHangupEvtGuid = window.lemon.call.addForceHangupEvt(handleEndCall);
  };

  const teardownCallHandlers = () => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    if (hangupEvtGuid) {
      window.lemon.call.removeHangupEvt(hangupEvtGuid);
    }
    if (forceHangupEvtGuid) {
      window.lemon.call.removeForceHangupEvt(forceHangupEvtGuid);
    }
    if (mediaStreamGuid) {
      lemon.call.removeMediaStream(mediaStreamGuid);
    }
  };

  const handleAnswerCall = async () => {
    if (!params.call_id) return console.error("No incoming call");
    try {
      await window.lemon.call.answerCall({
        call_id: params.call_id,
        duplex_flag: params.duplexFlag,
        listen_flag: params.listen_flag,
      });
      console.log("Call answered successfully");
    } catch (error) {
      console.error("Error answering call:", error);
    }
  };

  const hangupCall = async (callId) => {
    if (!callId) return;
    try {
      console.log("### 📞 Ending call with ID:", callId);
      setStatusMap("stopped");
      statusMapRef.current = "stopped";
      callSessionId.current = null;
      await window.lemon.call.hangupCall({ call_id: callId });
      onUnload();
    } catch (error) {
      console.error("Error ending call:", error);
    }
  };

  const handleLoginStatusChange = async (loginStatus) => {
    // sleep 1 second
    if ([0, 2, 3].includes(loginStatus.login_status)) {
      console.log("### 📞 Login status changed:", statusMap, statusMapRef?.current);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (basedataId.current === sessionStorage.getItem("basedata_id") && statusMapRef?.current !== "stopped") {
        await handleAttemptLogin(userInfo);
        await setupCallHandlers();
        setStatusMap("calling");
        statusMapRef.current = "calling";
        setTimeout(() => startVideoCall(0), 1000);
      }
    }
  };
  function startCallSession() {
    if (call_mode === "0") {
        initiateCall();
    } else if (call_mode === "1") {
        handleAnswerCall();
    }
  }
  const setupSocket = () => {
    const SOCKET_URL = "http://192.168.101.3:6173";

    const newSocket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socket.current = newSocket;
  
    newSocket.on("connect", () => console.log("✅ WebSocket Connected"));
  
    newSocket.on("call", async (offer) => {
      console.log("### 📥 Received OFFER:", offer);
      const bdata_id = offer.basedata_id;
      const session_id = offer.session_id;
      console.log("##### 📥 Received OFFER basedata_id:", bdata_id);
      basedataId.current = bdata_id;
      if (bdata_id === sessionStorage.getItem("basedata_id")) {
        startCallSession();
      } else {
        handleAttemptLogout();
      }
    });
  
    newSocket.emit("call", { status: "call", basedata_id: params.basedata_id, session_id: sessionId?.current });
  };
  
  useEffect(() => {
    sessionStorage.setItem("basedata_id", params.basedata_id);
    basedataId.current = params.basedata_id;
    setupSocket();
    startCallSession();
    intervalGPSRef.current = setInterval(() => {
      queryRecordGPS();
    }, 60 * 1000);
    return () => {
      window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId?.current);
    };
  }, []);
  const onUnload = async () => {
    console.log("### Unloading"); 
    window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId?.current);
    console.log("### Iframe or page is unloading", params.session_id); 
    if (socket?.current) {
      socket?.current.emit('call', { status:"idle", basedata_id: null, session_id: params.session_id });   
    }
    console.log("### Unloaded"); 
    statusMapRef.current = "stopped";
    await handleAttemptLogout();

  };

    useEffect(() => {
    
      window.addEventListener("unload", onUnload);
      window.addEventListener("beforeunload", onUnload);

    
      return () => {
        window.removeEventListener("unload", onUnload);
        window.removeEventListener("beforeunload", onUnload);
      };
    }, []);
    

  const initiateCall = async () => {
    setStatusMap("calling");
    statusMapRef.current = "calling";
    await handleAttemptLogin(userInfo);
    await setupCallHandlers();
    setTimeout(() => startVideoCall(params.hookFlag), 1000);
  };

  const startVideoCall = async (hook_flag) => {
    try {
      setStatusMap("waiting");
      statusMapRef.current = "waiting";
      const resp = await window.lemon.call.makeVideoCall({
        basedata_id: params.basedata_id,
        video_frame_size: 3,
        hook_flag: +hook_flag,
      });
      if (resp.result !== 0) {
        console.log("###### Error making call:", resp);
        setStatusMap("stopped");
        statusMapRef.current = "stopped";
        onUnload();
      } else {
        console.log("###### Call initiated successfully:", resp);
        callSessionId.current = resp.call_id;
        loginStatusCallbackId.current = window.lemon.login.addLoginStatusChangeListener(handleLoginStatusChange);
        setStatusMap("talking");  
        statusMapRef.current = "talking";

      }
    } catch (error) {
      console.error("Call initiation failed", error);
      setTimeout(initiateCall, 2000);
    }
  };
  const queryRecordGPS = async () => {
    try {
      let devicesSubGPS = await handleFetchDeviceList();

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
              // if (alias === "BoDam148") {
              //   console.log("#### BoDam148 response:", response[response.length - 1]);
              // }
              // if (alias === "BB29") {
              //   console.log("#### BB29 response:", response[response.length - 1]);
              // }
              const longitudes = response.map(item => item.longitude);
              const latitudes = response.map(item => item.latitude);

              const medianLongitude = median(longitudes);
              const medianLatitude = median(latitudes);

              gpsDataList.push({
                deviceId: alias,
                lng: medianLongitude,
                lat: medianLatitude,
                dateTime: toTime,
              });
            } 
          } catch (err) {
            console.error(`##### ❌ Failed to get GPS for device ${alias}:`, err);
          }
        }
 
      })
      if (gpsDataList.length === 0) {
        console.warn("#### ⚠️ Không có dữ liệu GPS nào được tìm thấy");
        return [];
      }

      mqttClient.current.publish(MQTT_GPS_TOPIC, JSON.stringify(gpsDataList));
      console.log("#### GPS data list:", gpsDataList);
      return gpsDataList;
    } catch (err) {
      console.error("❌ queryRecordGPS failed:", err);
      return [];
    }
  };

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
  return (
    <div className="flex items-center justify-center h-screen bg-black relative w-full">
      {statusMap === "idle" && <h1 className="text-white text-3xl font-bold absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">Connecting...</h1>}
      {statusMap === "calling" && <h1 className="text-white text-3xl font-bold absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">Calling...</h1>}
      {statusMap === "stopped" && <h1 className="text-white text-3xl font-bold absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">Stopped...</h1>}
      {statusMap === "waiting" && <h1 className="text-white text-3xl font-bold absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">Waiting...</h1>}
      {statusMap === "disconnecting" && <h1 className="text-white text-3xl font-bold absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">Disconnecting...</h1>}

      <video ref={remoteVideoRef} crossOrigin="anonymous" autoPlay playsInline className="w-full h-full object-cover" />
      <audio ref={remoteAudioRef} crossOrigin="anonymous" autoPlay />

    </div>
  );
}

export default StreamCall;
