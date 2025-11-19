export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, convo_id } = req.body;

  
  function extractClassification(reply) {
    const marker = "[CLASSIFICATION]";
    const idx = reply.indexOf(marker);

    if (idx === -1) {
      return { cleanReply: reply, leverage: null, object: null };
    }

    const cleanReply = reply.substring(0, idx).trim();
    const jsonText = reply.substring(idx + marker.length).trim();

    try {
      const parsed = JSON.parse(jsonText);
      return {
        cleanReply,
        leverage: parsed.leverage || null,
        object: parsed.object || null
      };
    } catch (e) {
      console.error("Failed to parse CLASSIFICATION JSON:", e);
      return { cleanReply, leverage: null, object: null };
    }
  }

  try {
    // --- 1️⃣ Call OpenAI ---
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        messages
      })
    });

    const data = await openaiRes.json();
    const fullReply = data.choices?.[0]?.message?.content || "[No response]";
    const turn = messages.length;

    
    const { cleanReply, leverage, object } = extractClassification(fullReply);

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
    async function logMessage(role, message, turnNum, leverageVal = null, objectVal = null) {
      const botName = "Noah";

      await fetch(`${supabaseUrl}/rest/v1/logs`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          convo_id,
          turn: turnNum,
          role,
          message,
          bot_name: botName,
          leverage: leverageVal,  
          object: objectVal        
        })
      });
    }

    // --- 4️⃣ Log latest user message ---
    const userMessage = messages.at(-1)?.content || "unknown";
    await logMessage("user", userMessage, turn);

    // --- 5️⃣ Log assistant reply WITH classifications ---
    await logMessage("assistant", cleanReply, turn + 1, leverage, object);

    // --- 6️⃣ Return clean assistant reply (not the JSON block) ---
    res.status(200).json({
      reply: cleanReply,
      leverage,
      object
    });

  } catch (err) {
    console.error("Error during OpenAI or Supabase call:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
}
