export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, convo_id } = req.body;

  try {
    // --- 1️⃣ Call OpenAI ---
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages
      })
    });

    const data = await openaiRes.json();
    const reply = data.choices?.[0]?.message?.content || "[No response]";
    const turn = messages.length;

    // --- 2️⃣ Setup Supabase details ---
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const headers = {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`,
      "Prefer": "return=minimal"
    };

    // --- 3️⃣ Helper function to log messages ---
  
    async function logMessage(role, message, turnNum) {
      const botName = "Jiwoo"; 
    
      await fetch(`${supabaseUrl}/rest/v1/logs`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          convo_id,
          turn: turnNum,
          role,
          message,
          bot_name: botName  // ✅ new field added
        })
      });
    }

    // --- 4️⃣ Log the latest user message (the second-to-last in the array) ---
    const userMessage = messages.at(-1)?.content || "unknown";
    await logMessage("user", userMessage, turn);

    // --- 5️⃣ Log the assistant reply ---
    await logMessage("assistant", reply, turn + 1);

    // --- 6️⃣ Return response to frontend ---
    res.status(200).json({ reply });

  } catch (err) {
    console.error("Error during OpenAI or Supabase call:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
}
