import { createRoot } from "react-dom/client";
import { useState } from "react";
import "./src/index.css";
import DocumentUploader from "./src/components/kyc/DocumentUploader";

function App() {
  const [v, setV] = useState<string | null>(null);
  return (
    <div style={{ padding: 16 }}>
      <DocumentUploader
        spec={{ id: "selfie", label: "Live selfie", description: "d", tips: ["t"], kind: "selfie" }}
        value={v}
        onChange={(u) => setV(u)}
        required
      />
      <p data-testid="err">{v ? "" : "A selfie photo is required"}</p>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
