import { createRoot } from "react-dom/client";
import App from "./App";
import './styles/index.scss';
// CRITICAL FIX: Import the URL interceptor to ensure client IDs are included in all asset requests
import { initAssetUrlInterceptor } from "./lib/asset-url-interceptor";

// Initialize the asset URL interceptor before rendering the app
initAssetUrlInterceptor();

createRoot(document.getElementById("root")!).render(<App />);