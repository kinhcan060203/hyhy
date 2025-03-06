import { useRef, useState, useEffect } from "react";
import "./App.css";
import DemoSDK from "./components/DemoSDK";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auto from "./components/Auto";
import StreamCall from "./components/StreamCall";
function App() {
  return (
    <>
     
      <Routes>
        <Route
          path="/stream/:call_mode/:call_type/:hookFlag/:duplexFlag/:basedata_id"
          element={<StreamCall />}
        />
        <Route path="/auto" element={<Auto />} />
        <Route path="/demo" element={<DemoSDK />} />
      </Routes>
    </>
  );
}

export default App;
