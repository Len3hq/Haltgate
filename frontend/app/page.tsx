import { Header } from "@/components/Header";
import { HaltStatusBanner } from "@/components/HaltStatusBanner";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
        <HaltStatusBanner />
      </main>
    </>
  );
}
