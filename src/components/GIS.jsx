import React, { useState, useCallback, useEffect } from "react";
function InfoDevices() {
  const [deviceId, setDeviceId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [gpsReport, setGpsReport] = useState(null);
  const [listenerId, setListenerId] = useState(null);
  const [interval_time, setIntervalTime] = useState(5);

  const handleGPSReport = (gpsReportInfo) => {
    let gps_list = gpsReportInfo.gps_list;
    let uniqueDevices = {};
    gps_list = gps_list.filter((gps) => {
      if (uniqueDevices[gps.device_number]) {
        return false;
      }
      uniqueDevices[gps.device_number] = true;
      return true;
    });
    console.log(gps_list);
    setGpsReport(gps_list);
  };
  const addListener = () => {
    const id = window.lemon.gis.addGPSReportListener(handleGPSReport);
    setListenerId(id);
  };

  const removeListener = () => {
    if (listenerId) {
      window.lemon.gis.removeGPSReportListener(listenerId);
      setListenerId(null);
      setGpsReport(null);
    }
  };

  useEffect(() => {
    return () => {
      if (listenerId) {
        window.lemon.gis.removeGPSReportListener(listenerId);
      }
    };
  }, [listenerId]);

  const fastGpsStart = useCallback(async () => {
    try {
      const resp = await window.lemon.gis
        .fastGpsStart({
          basedata_id: deviceId,
        })
        .then((resp) => {
          setupSubcribeInit({ interval_time, deviceId });
        });
      alert(`fastGpsStart ok`);
    } catch (error) {
      alert(`fastGpsStart faileed`);
    }
  });

  const fastGpsEnd = useCallback(async () => {
    try {
      const resp = await window.lemon.gis.fastGpsEnd({
        basedata_id: deviceId,
      });
      console.log("@@@", resp);
      alert(`fastGpsEnd ok`);
    } catch (error) {
      alert(`fastGpsEnd faileed`);
    }
  });

  const queryRecordGPS = useCallback(async () => {
    try {
      let date = new Date(startTime + " UTC"); // Force parsing as UTC
      let startT = date.toISOString();

      let endT = new Date(endTime + " UTC"); // Force parsing as UTC
      endT = date.toISOString();

      const resp = await window.lemon.gis.queryRecordGPS({
        basedata_id: deviceId,
        start_time: startT,
        end_time: endT,
      });
      console.log("@@@@@", resp);
      alert(`queryRecordGPS ok`);
    } catch (error) {
      alert(`queryRecordGPS failed`);
    }
  });

  const setupSubcribeInit = useCallback(
    async ({ deviceId, interval_time = 5 }) => {
      try {
        const resp = await window.lemon.gis.startSubscribeGps({
          subscriber_list: [
            { basedata_id: deviceId, interval_time: interval_time },
          ],
        });
        console.log("@@@", resp);
      } catch (error) {
        alert(`failed`);
      }
    }
  );

  return (
    <>
      <h1 className="text-3xl">
        Info Devices (Register, Unregister, Get Info, Query Record)
      </h1>
      <div>
        <div>
          Basedata ID:
          <input
            type="text"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="text-right"
          />
        </div>
        <div>
          Start Time (UTC):
          <input
            type="text"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="text-right"
          />
        </div>
        <div>
          Interval time GPS:
          <input
            type="text"
            value={interval_time}
            onChange={(e) => setIntervalTime(e.target.value)}
            className="text-right"
          />
        </div>

        <div>
          End Time (UTC):
          <input
            type="text"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="text-right"
          />
        </div>
      </div>

      <button onClick={fastGpsStart}>Start Subscribe GPS</button>
      <button onClick={fastGpsEnd}>Stop Subscribe GPS</button>

      <button onClick={queryRecordGPS}>Query Record GPS</button>
      <button onClick={addListener}>Get GPS Info</button>
      <button onClick={removeListener}>Stop Get GPS Info</button>

      <div>
        {gpsReport && (
          <div>
            <h3>GPS Data Realtime:</h3>
            <ul>
              {gpsReport.map((gps, index) => (
                <li key={index}>
                  {gps.device_alias} ({gps.device_number}): {gps.latitude},{" "}
                  {gps.longitude}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

function OtherFunction() {
  const [deviceId, setDeviceId] = useState("");

  const cancelDeviceAllGpsSub = useCallback(async () => {
    try {
      const resp = await window.lemon.gis.cancelDeviceAllGpsSub({
        cancel_subscribe_list: [{ basedata_id: deviceId }],
      });
      alert(`cancelDeviceAllGpsSub OK`);
    } catch (error) {
      alert(`cancelDeviceAllGpsSub failed`);
    }
  }, []);

  const cancelDispatcherAllGpsSub = useCallback(async () => {
    try {
      const resp = await window.lemon.gis.cancelDispatcherAllGpsSub({
        cancel_subscribe_list: [{ basedata_id: deviceId }],
      });
      alert(`cancelDispatcherAllGpsSub OK`);
    } catch (error) {
      alert(`cancelDispatcherAllGpsSub failed`);
    }
  }, []);

  return (
    <>
      <h1 className="text-3xl mt-20">Other functions</h1>
      <div>
        <label>Basedata ID:</label>
        <input
          type="text"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
        />
      </div>

      <button onClick={cancelDeviceAllGpsSub}>cancelDeviceAllGpsSub</button>

      <button onClick={cancelDispatcherAllGpsSub}>
        cancelDispatcherAllGpsSub
      </button>
    </>
  );
}

function GetSubDeviceList() {
  const pageIndex = 0;
  const pageSize = 10;
  const [subDeviceList, setSubDeviceList] = useState([]);

  const fetchSubDeviceList = useCallback(async () => {
    try {
      const resp = await window.lemon.gis.fetchSubDeviceList({
        page_index: pageIndex,
        page_size: pageSize,
      });
      if (resp.result === 0) {
        setSubDeviceList(resp.sub_device_list);
      } else {
        alert(`fetchSubDeviceList failed`);
      }
    } catch (error) {
      console.error("Error calling fetchSubDeviceList:", error);
      alert(`fetchSubDeviceList failed`);
    }
  }, []);

  const syncSubscribeList = useCallback(async () => {
    try {
      const resp = await window.lemon.gis.syncSubscribeList();
      if (resp.result === 0) {
        fetchSubDeviceList();
      } else {
        alert(`syncSubscribeList failed`);
      }
    } catch (error) {
      console.error("Error calling syncSubscribeList:", error);
      alert(`syncSubscribeList failed`);
    }
  }, []);
  return (
    <>
      <h1 className="text-3xl mt-20 ">fetchSubDeviceList</h1>
      <div>
        <button onClick={fetchSubDeviceList}>fetchSubDeviceList</button>
        <button onClick={syncSubscribeList}>syncSubscribeList</button>
      </div>
      
      {subDeviceList.length > 0 && (
        <>
          <ul>
            {subDeviceList.map((device) => (
              <li key={device.basedata_id}>
                {device.alias} ({device.number}) - {device.basedata_id}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function GIS() {
  return (
    <>
      <InfoDevices />
      <GetSubDeviceList />
      {/* <OtherFunction /> */}
    </>
  );
}

export default GIS;
