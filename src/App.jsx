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
          path="/sdk/stream/:call_type/:call_mode/"
          element={<StreamCall />}
        />
        <Route path="/sdk" element={<Auto />} />
        <Route path="/demo" element={<DemoSDK />} />
      </Routes>
    </>
  );
}

export default App;
