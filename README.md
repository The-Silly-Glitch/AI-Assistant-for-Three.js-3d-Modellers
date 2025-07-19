# Project Setup Instructions

## 1. Clone the Repository

```bash
git clone https://github.com/The-Silly-Glitch/AI-Assistant-for-Three.js-3d-Modellers.git
cd AI-Assistant-for-Three.js-3d-Modellers
```

## 2. Configure Environment Variables

Open the `.env.local` file and replace the placeholder with your **Gemini API key**:

```env
GEMINI_API_KEY=Placeholder_api_key
```

➡️ Replace `Placeholder_api_key` with your actual Gemini API key.

---

## 3. Update Hugging Face Token

Navigate to `services/geminiService.ts` and find the following line:

```ts
Authorization": `Bearer ${HUGGING_FACE_TOKEN}
```

➡️ Replace `"HUGGING_FACE_TOKEN"` with your actual Hugging Face token (make sure it stays within **double quotes**).

---

## ✅ You're all set!

Now you can start the project with:

```bash
npm install
```

and then

```bash
npm run dev
```
