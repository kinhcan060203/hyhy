

// Handles login attempt with retry logic
export const handleAttemptLogin = async (userInfo) => {
    
    while (true) {
      try {
        const response = await window.lemon.login.login(userInfo);
        if (response.result === 0) {
          console.log("✅ Login successful");
          return response;
        } else {
          console.warn("❌ Login failed, retrying in 1s...");
        }
      } catch (error) {
        console.error("🚫 Login error, retrying in 1s...", error);
      }
  
      // Chờ 1 giây rồi thử lại
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };
  
export const getAccountInfo = async () => {
    const resp = await window.lemon.login.getLoginAccountInfo()
    return resp?.account_info?.token;

}


// Handles logout
export const handleAttemptLogout = async () => {
  await window.lemon.login.logout();
};

// Fetches full device list
export const handleFetchDeviceList = async () => {
  try {
    const resp = await window.lemon.basedata.fetchDeviceList({
      page_size: 200,
      page_index: 1,
    });
    console.log("###### 🚀 handleFetchDeviceList response:", resp) ;
    if (!resp.device_list) {
      console.warn("⚠️ No devices found");
      return null;
    }

    const newDeviceList = resp.device_list.reduce((acc, device) => {
      acc[device.alias] = {
        basedata_id: device.basedata_id,
        number: device.number,
      };
      return acc;
    }, {});

    return newDeviceList;
  } catch (error) {
    console.error("❌ Error fetching device list:", error);
    return {};
  }
};

// Fetches list of sub-devices (e.g. GPS)
export const handleFetchSubDeviceList = async () => {
  try {
    const resp = await window.lemon.gis.fetchSubDeviceList({
      page_index: 1,
      page_size: 10000,
    });

    if (resp.result === 0) {
      return resp.sub_device_list || [];
    } else {
      console.warn("⚠️ handleFetchSubDeviceList failed");
      return [];
    }
  } catch (error) {
    console.error("❌ Error calling handleFetchSubDeviceList:", error);
    return [];
  }
};

export const handleQueryRecordGPS = async (basedata_id, startTime, endTime) => {
  try {
    const resp = await window.lemon.gis.queryRecordGPS({
      basedata_id: basedata_id,
      start_time: startTime,
      end_time: endTime,
    });
    if (resp.result === 0) {
      return resp.gps_record_list || [];
    } else {
      return [];
    }
  } catch (error) {
    console.error("#### ❌ Error calling handleQueryRecordGPS:", error);
    return [];
  }
};
