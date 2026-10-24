import { APP_NAME } from "@/lib/brand";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-card border border-border bg-surface p-8">
        <h1 className="text-3xl font-extrabold">{APP_NAME}</h1>
        <p className="mt-2 text-muted-foreground">
          Todo al día, bien hecho.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="rounded-full bg-primary px-5 py-2.5 font-bold text-primary-foreground"
          >
            Añadir gasto
          </button>
          <button
            type="button"
            className="rounded-full border border-destructive bg-transparent px-5 py-2.5 font-bold text-destructive"
          >
            Eliminar
          </button>
        </div>
      </section>
    </main>
  );
}
