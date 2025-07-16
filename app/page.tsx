export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Simple Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="text-xl font-semibold">Steady Wins Apps.</div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            We Make Apps
            <br />
            That Just Work
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Simple, beautiful mobile apps designed to make your daily life easier. 
            No bloat, no complexity, just functionality.
          </p>
        </div>
      </section>

      {/* Apps Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Our Apps</h2>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Egg Timer App */}
            <div className="bg-white dark:bg-black rounded-lg p-8 shadow-sm border">
              <div className="text-6xl mb-4">🥚</div>
              <h3 className="text-2xl font-semibold mb-2">Egg Timer</h3>
              <div className="inline-block px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm mb-4">
                Available Now
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The perfect timer for cooking eggs exactly how you like them. 
                Simple interface, reliable timing, perfect results every time.
              </p>
              <div className="flex gap-4">
                <a
                  href="#"
                  className="inline-flex items-center px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                >
                  App Store
                </a>
                <a
                  href="#"
                  className="inline-flex items-center px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                >
                  Google Play
                </a>
              </div>
            </div>

            {/* White Noise App */}
            <div className="bg-white dark:bg-black rounded-lg p-8 shadow-sm border">
              <div className="text-6xl mb-4">🌊</div>
              <h3 className="text-2xl font-semibold mb-2">White Noise</h3>
              <div className="inline-block px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-sm mb-4">
                Coming Soon
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Soothing sounds to help you sleep, focus, or relax. 
                High-quality audio, simple controls, no distractions.
              </p>
              <div className="text-gray-500 dark:text-gray-500">
                Expected launch: Q2 2024
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4 text-center">
          <div className="mb-4">
            <p className="text-gray-600 dark:text-gray-400">
              © 2025 Steady Wins Technologies Corporation. All rights reserved.
            </p>
          </div>
          <div className="flex justify-center gap-6 text-sm">
            <a href="#" className="hover:underline">Contact</a>
            <a href="#" className="hover:underline">Privacy</a>
            <a href="#" className="hover:underline">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}