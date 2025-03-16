
import Sidebar from "@/components/layout/sidebar";

export default function DesignBuilder() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-6">Design Builder</h1>
        <div className="grid gap-6">
          {/* Design builder content will go here */}
        </div>
      </main>
    </div>
  );
}
