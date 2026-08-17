// ── HUFFAZWORLD ANDROID BACK BUTTON ──

(function () {
    // Only run inside the Capacitor Android app
    if (!window.Capacitor || !window.Capacitor.Plugins) {
        console.log("HuffazWorld: Capacitor App plugin not available.");
        return;
    }

    const App = window.Capacitor.Plugins.App;

    if (!App) {
        console.log("HuffazWorld: App plugin not available.");
        return;
    }

    App.addListener("backButton", ({ canGoBack }) => {
        console.log("HuffazWorld Back Button:", { canGoBack });

        if (canGoBack) {
            // Return to the previous HuffazWorld page
            window.history.back();
        } else {
            // No previous page — allow the Android app to exit
            App.exitApp();
        }
    });

    console.log("HuffazWorld: Android back button handler loaded.");
})();