# Learned Media

## Launch

```bash
cd Website
npm install
cp .env.example .env.local
```

Add your key to `.env.local`:

```env
GEMINI_API_KEY=your_key_here
```

Then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Use

1. Select topics in the checklist
2. Press **Start learning**
3. Use **Learn more** or ask a question on any fact card
4. Switch between **Image + text** and **Text only** in feed customization

The demo feed works without a key. Gemini summaries and questions require `GEMINI_API_KEY`.
