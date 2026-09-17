const axios = require("axios");
const { getGroqConfig } = require("../integrations/config");

// retrieve() থেকে পাওয়া প্রোডাক্টগুলোকে LLM এর জন্য readable context text এ রূপান্তর করে
function buildContext(products) {
  return products
    .map(
      (p) =>
        `Product: ${p.name}\nCategory: ${p.category || "N/A"}\nBrand: ${p.brand || "N/A"}\nPrice: ${p.price ?? 0} BDT\nStock: ${p.stock ?? 0} (${p.availabilityStatus || "In Stock"})\nDescription: ${p.description || ""}`,
    )
    .join("\n\n");
}

// retrieve() থেকে পাওয়া প্রোডাক্ট context দিয়ে Groq (ফ্রি, OpenAI-compatible API) কে প্রশ্নের
// উত্তর জেনারেট করতে বলে — এটাই RAG এর "generation" অংশ। শুধু দেওয়া প্রোডাক্ট তথ্য থেকে উত্তর
// দিতে বলা হয়েছে, যাতে LLM নিজে থেকে প্রোডাক্ট/দাম বানিয়ে না বলে (hallucination আটকানোর জন্য)
async function generateAnswer(userQuestion, retrievedProducts) {
  const { apiKey, model, temperature } = await getGroqConfig();
  if (!apiKey) {
    throw new Error("AI assistant is not configured");
  }

  const context = retrievedProducts.length
    ? buildContext(retrievedProducts)
    : "No matching products found in the store.";

  const systemPrompt = `You are a helpful shopping assistant for our e-commerce store.
Answer ONLY using the product information provided below.
If the answer is not in the provided products, politely say you don't have that information.
Do not invent products, prices, or details.

Available products:
${context}`;

  try {
    const { data } = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userQuestion },
        ],
        temperature,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 30000,
      },
    );

    return data.choices[0].message.content;
  } catch (error) {
    console.error(
      "❌ Groq generateAnswer error:",
      error.response?.data || error.message,
    );
    throw error;
  }
}

module.exports = { generateAnswer };
