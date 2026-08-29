import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      {/* 사용자 시스템의 동작 줄이기 설정을 전역으로 존중한다.
          LazyMotion은 실제로 쓰는 기능(등장·호버·전환)만 싣는다 */}
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </LazyMotion>
    </BrowserRouter>
  </StrictMode>
);
