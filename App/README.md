# Learned Media for Mac

Download the repository ZIP, unzip it, open App, and double-click Learned Media.app. The app stores learning data in your normal macOS Application Support folder and never saves the Gemini key.

Open Settings, paste your Gemini key, and press Connect Gemini. The AI Studio link is built into the app. The demo feed works without a key.

Google sign-in is included through Supabase and returns through the app’s learnedmedia:// callback. The dedicated Supabase project is ready; the remaining owner step is to add a Google Cloud OAuth client ID and secret under Authentication > Providers and allow the callback URL learnedmedia://auth/callback.

The included scripts rebuild the app from source:

    ./script/build_app.sh
    ./script/build_universal.sh

The first release is ad-hoc signed because no Developer ID certificate is included. macOS may show a first-launch security warning for downloaded builds; Developer ID signing and notarization remove that warning.
