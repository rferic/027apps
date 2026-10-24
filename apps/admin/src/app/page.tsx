import { APP_NAME } from "@/lib/brand";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <h1>{APP_NAME}</h1>
    </main>
  );
}
