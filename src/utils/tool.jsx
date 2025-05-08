

export const generateFakeGPSData = (deviceCount = 5) => {
    const now = new Date();
    const gpsDataList = [];
    let iso_string = now.toISOString();
    const [datePart, timePartWithZ] = iso_string.split("T");
    const timePart = timePartWithZ.split(".")[0];
    for (let i = 0; i < deviceCount; i++) {
      const fakeDevice = {
        deviceId: `BoDam${144 + i}`,
        lng: 105.8 + Math.random() * 0.01,
        lat: 21.0 + Math.random() * 0.01,
        dateTime: `${datePart} ${timePart}Z`,
      };
      gpsDataList.push(fakeDevice);
    }

    return gpsDataList;
  };

  