import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Canvas from "@/pages/Canvas";
import Decks from "@/pages/Decks";
import Icons from "@/pages/Icons";
import Rules from "@/pages/Rules";
import Preview from "@/pages/Preview";
import Export from "@/pages/Export";
import ProjectLayout from "@/components/ProjectLayout";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/canvas/:projectId"
          element={
            <ProjectLayout>
              <Canvas />
            </ProjectLayout>
          }
        />
        <Route
          path="/decks/:projectId"
          element={
            <ProjectLayout>
              <Decks />
            </ProjectLayout>
          }
        />
        <Route
          path="/icons/:projectId"
          element={
            <ProjectLayout>
              <Icons />
            </ProjectLayout>
          }
        />
        <Route
          path="/rules/:projectId"
          element={
            <ProjectLayout>
              <Rules />
            </ProjectLayout>
          }
        />
        <Route
          path="/preview/:projectId"
          element={
            <ProjectLayout>
              <Preview />
            </ProjectLayout>
          }
        />
        <Route
          path="/export/:projectId"
          element={
            <ProjectLayout>
              <Export />
            </ProjectLayout>
          }
        />
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  );
}
