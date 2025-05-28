import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { median } from "../utils/tool";
import {
  handleAttemptLogin,
  handleAttemptLogout,
  handleFetchDeviceList,
  handleQueryRecordGPS,
} from "../utils/common";
import {USER_INFO, MQTT_CONFIG_DEV, MQTT_CONFIG_PROD, CALL_CONFIG_DEFAULT, WS_ENDPOINT} from "../utils/constants"
import {connectSocket} from "../utils/function";

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

  const mqttClientDev = useRef(null);
  const mqttClientProd = useRef(null);

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
      if (basedataId.current === sessionStorage.getItem("basedata_id") && statusMapRef?.current !== "stopped" && statusMapRef?.current !== "disconnected") {
        await handleAttemptLogin(USER_INFO);
        await setupCallHandlers();
        setStatusMap("calling");
        statusMapRef.current = "calling";
        setTimeout(() => startVideoCall(0), 1000);
      }
    }
  };
  async function startCallSession() {
    if (call_mode === "0") {
        await initiateCall();
    } else if (call_mode === "1") {
        await handleAnswerCall();
    }
  }
const setupSocket = () => {
  const newSocket = new WebSocket(WS_ENDPOINT);
  socket.current = newSocket;

  newSocket.onopen = () => {
    const callData = {
      type: "call.event",
      data: {
        status: "call",
        basedata_id: params.basedata_id,
        session_id: sessionId?.current,
      },
    };
    console.log("#### WebSocket Connected", callData);
    newSocket.send(JSON.stringify(callData));
  };

  newSocket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "call.event") {
        const offer = data.data;
        console.log("### 📥 Received OFFER:", offer);
        const bdata_id = offer.basedata_id;
        const session_id = offer.session_id;

        basedataId.current = bdata_id;
        console.log("### 📥 session_id === params.session_id:", session_id === params.session_id);
        if (bdata_id === sessionStorage.getItem("basedata_id") && (session_id === params.session_id)) {
          await startCallSession();
        } else {
            window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId.current);
            // await sleep 1 second
            if (remoteVideoRef?.current) {
                remoteVideoRef.current.srcObject = null;
            }
            statusMapRef.current = "disconnected";
            setStatusMap("disconnected");
            console.log("### 📥 Ignoring message for different basedata_id or session_id");

        }
      }
    } catch (error) {
      console.error("❌ Error parsing message:", error);
    }
  };

  newSocket.onclose = () => {
    console.log("🔌 WebSocket Disconnected");
  };

  newSocket.onerror = (error) => {
    console.error("❌ WebSocket error:", error);
  };
};

  
  useEffect(() => {
    sessionStorage.setItem("basedata_id", params.basedata_id);
    basedataId.current = params.basedata_id;
    setupSocket();
    startCallSession();
    intervalGPSRef.current = setInterval(() => {
      queryRecordGPS();
    }, 30 * 1000);
    return () => {
      window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId?.current);
    };
  }, []);
  const onUnload = async () => {
    console.log("### Unloading", statusMapRef.current); 
    window.lemon.login.removeLoginStatusChangeListener(loginStatusCallbackId?.current);
    console.log("### Iframe or page is unloading", params.session_id); 
    if (statusMapRef.current === "disconnected") {
      console.log("### Already disconnected, no need to close WebSocket");
      return;
    }
    if (socket.current) {
      console.log("### Closing WebSocket connection");
      socket.current?.send(
        JSON.stringify({
          type: "call.event",
          data: {
            status: "idle",
            basedata_id: null,
            session_id: params.session_id,
          }
        }
      )
    );
    }
      
    console.log("### Unloaded"); 

    // await handleAttemptLogout();
    

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
    await handleAttemptLogin(USER_INFO);
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
      console.log("###### Response from makeVideoCall:", resp);
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
        console.warn("#### ⚠️ Không có thiết bị con để truy vấn GPS");
        return [];
      }
      console.log("#### 📡 devicesSubGPS:", devicesSubGPS);

      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 30 * 1000);
 
      const fromTime = oneMinuteAgo.toISOString();
      const toTime = now.toISOString();
      if (Object.keys(devicesSubGPS).length === 0) return [];

      let gpsDataList = [];

      for (const alias of Object.keys(devicesSubGPS)) {
        const device = devicesSubGPS[alias];
        let basedata_id = device.basedata_id;
        if (basedata_id) {
          try {
            // await new Promise(resolve => setTimeout(resolve, 10));
            const response = await handleQueryRecordGPS(
              basedata_id,
              fromTime,
              toTime
            );
            if (response?.length > 0) {
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
      }
      
      if (gpsDataList.length === 0) {
        console.warn("#### ⚠️ Không có dữ liệu GPS nào được tìm thấy");
        return [];
      }

      mqttClientProd.current?.publish(MQTT_CONFIG_PROD.MQTT_GPS_TOPIC, JSON.stringify(gpsDataList));
      mqttClientDev.current?.publish(MQTT_CONFIG_DEV.MQTT_GPS_TOPIC, JSON.stringify(gpsDataList));
      console.log("#### 📡 GPS data:", gpsDataList);
      return gpsDataList;
    } catch (err) {
      console.error("❌ queryRecordGPS failed:", err);
      return [];
    }
  };

  useEffect(() => {
  
    const clientId = `${Math.random()}`;
    sessionId.current = clientId;
    
    const mqtt_client_dev = connectSocket(
      clientId,
      MQTT_CONFIG_DEV.MQTT_BROKER,
      MQTT_CONFIG_DEV.MQTT_USERNAME,
      MQTT_CONFIG_DEV.MQTT_PASSWORD,
      MQTT_CONFIG_DEV.MQTT_TOPIC
    );

    const mqtt_client_prod = connectSocket(
      clientId,
      MQTT_CONFIG_PROD.MQTT_BROKER,
      MQTT_CONFIG_PROD.MQTT_USERNAME,
      MQTT_CONFIG_PROD.MQTT_PASSWORD,
      MQTT_CONFIG_PROD.MQTT_TOPIC
    );
    
    mqttClientDev.current = mqtt_client_dev;
    mqttClientProd.current = mqtt_client_prod;

      return () => {
        console.log("🔌 Disconnected MQTT...");
        mqttClientDev.current?.close();
        mqttClientProd.current?.close();
      };
    }, []);
  return (
    <div className="flex items-center justify-center h-screen bg-black relative w-full">
      {statusMap === "idle" && <h1 className="text-white text-3xl font-bold absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">Connecting...</h1>}
      {statusMap === "calling" && <h1 className="text-white text-3xl font-bold absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">Calling...</h1>}
      {statusMap === "stopped" && <h1 className="text-white text-3xl font-bold absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">Stopped...</h1>}
      {statusMap === "waiting" && <h1 className="text-white text-3xl font-bold absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">Waiting...</h1>}
      {statusMap === "disconnected" && <h1 className="text-white text-3xl font-bold absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">Disconnected...</h1>}

      <video ref={remoteVideoRef} crossOrigin="anonymous" autoPlay playsInline className="w-full h-full object-cover" />
      <audio ref={remoteAudioRef} crossOrigin="anonymous" autoPlay />

    </div>
  );
}

export default StreamCall;
