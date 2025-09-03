
import { signInWithPopup } from "firebase/auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth, googleProvider } from "@/lib/firebase";

export default function AuthDebug() {
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const testGoogleSignIn = async () => {
    setError(null);
    addLog("Starting Google sign-in test");
    addLog(`Current domain: ${window.location.hostname}`);
    addLog(`Full origin: ${window.location.origin}`);
    
    try {
      addLog("Attempting signInWithPopup");
      const result = await signInWithPopup(auth, googleProvider);
      addLog("Sign-in successful");
      addLog(`User email: ${result.user.email}`);
      addLog(`ID Token available: ${typeof result.user.getIdToken === 'function' ? "Yes" : "No"}`);
    } catch (err: code: string; message: string ) {
      const errorMessage = `Error: ${err.code} - ${err.message}`;
      setError(errorMessage);
      addLog(errorMessage);
      
      if (err.code === "auth/unauthorized-domain") {
        addLog(`This domain (${window.location.hostname}) is not authorized in Firebase console`);
        addLog("You need to add this domain to Firebase Console > Authentication > Settings > Authorized domains");
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-2xl">Google Auth Debugging</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4">
            <Button onClick={testGoogleSignIn}>
              Test Google Sign-In
            </Button>
            
            {error && (
              <div className="p-4 border border-red-500 bg-red-50 text-red-700 rounded">
                {error}
              </div>
            )}
            
            <div className="border p-4 rounded h-64 overflow-auto">
              <h3 className="font-bold mb-2">Debug Logs:</h3>
              {logs.map((log, i) => (
                <div key={i} className="text-sm font-mono mb-1">{log}</div>
              ))}
              {logs.length === 0 && <div className="text-gray-400">No logs yet. Click the test button above.</div>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
