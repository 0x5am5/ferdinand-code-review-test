
import Sidebar from "@/components/layout/sidebar";

export default function DesignBuilder() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold">Design Builder</h1>
      </main>
    </div>
  );
}
