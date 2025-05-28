// Repeatedly attempts login until successful
export const handleAttemptLogin = async (userInfo) => {
  while (true) {
    try {
      const response = await window.lemon.login.login(userInfo);
      if (response.result === 0) {
        return response;
      } else {
      }
    } catch (error) {
      console.error("### Login error, retrying in 1s...", error);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

export const getAccountInfo = async () => {
  const resp = await window.lemon.login.getLoginAccountInfo();
  return resp?.account_info?.token;
};

export const handleAttemptLogout = async () => {
  await window.lemon.login.logout();
};

export const handleFetchDeviceList = async () => {
  try {
    const resp = await window.lemon.basedata.fetchDeviceList({
      page_size: 200,
      page_index: 1,
    });

    if (!resp.device_list) {
      console.warn("### No devices found");
      return null;
    }

    const deviceMap = resp.device_list.reduce((acc, device) => {
      acc[device.alias] = {
        basedata_id: device.basedata_id,
        number: device.number,
      };
      return acc;
    }, {});

    return deviceMap;
  } catch (error) {
    console.error("### Error fetching device list:", error);
    return {};
  }
};

export const handleFetchSubDeviceList = async () => {
  try {
    const resp = await window.lemon.gis.fetchSubDeviceList({
      page_index: 1,
      page_size: 10000,
    });

    if (resp.result === 0) {
      return resp.sub_device_list || [];
    } else {
      console.error("### handleFetchSubDeviceList failed");
      return [];
    }
  } catch (error) {
    console.error("### Error calling handleFetchSubDeviceList:", error);
    return [];
  }
};

export const handleQueryRecordGPS = async (basedata_id, startTime, endTime) => {
  try {
    const resp = await window.lemon.gis.queryRecordGPS({
      basedata_id,
      start_time: startTime,
      end_time: endTime,
    });

    if (resp.result === 0) {
      return resp.gps_record_list || [];
    } else {
      return [];
    }
  } catch (error) {
    console.error("### Error calling handleQueryRecordGPS:", error);
    return [];
  }
};
