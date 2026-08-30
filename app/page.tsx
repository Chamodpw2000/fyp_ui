import HomeControls from "./home-controls";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-1 flex-col gap-8 bg-white px-5 py-10 sm:px-8 dark:bg-black">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
            Final Year Project - Group 51
          </p>
          <h1 className="text-2xl font-semibold leading-9 tracking-tight text-black sm:text-3xl dark:text-zinc-50">
            A Blockchain-centered AI agent with Deep Reinforcement Learning to Diminish Multipath
            Routing Attacks in Software-Defined Vehicular Networks
          </h1>
        </header>

        <HomeControls />
      </main>
    </div>
  );
}
