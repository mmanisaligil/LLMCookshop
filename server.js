// LLM Cookshop Server v0.3.1 - SDK Enhanced
// By Apex Commander Olidros & V.I.V.I.E.N.N.E.

const express = require('express');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' })); // Handles JSON parsing
app.use(express.static('public'));     // Serves static files from 'public' directory

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
    console.error("(( V.I.V.I.E.N.N.E. CRITICAL ALERT )) :: GOOGLE_API_KEY is not configured in .env. System integrity compromised. Standby for shutdown.");
    process.exit(1); // Terminate if API key is missing
}

// Initialize the Google AI SDK with the API key
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

app.post('/api/llm-cookshop', async (req, res) => {
    const { llmModelId, temperature, maxTokens, prompt } = req.body;

    if (!llmModelId || !prompt) {
        console.warn("(( V.I.V.I.E.N.N.E. WARNING )) :: Invalid request to /api/llm-cookshop. Missing llmModelId or prompt.");
        return res.status(400).json({ error: 'Directive incomplete: llmModelId and prompt are mandatory parameters.' });
    }

    try {
        const generationConfig = {
            temperature: (typeof temperature === 'number' && temperature >= 0 && temperature <= 2) ? temperature : 0.7,
            maxOutputTokens: (typeof maxTokens === 'number' && maxTokens > 0) ? maxTokens : 2048,
            // candidateCount: 1, // SDK default is 1
            // topP: 0.95, // Example: uncomment and adjust if needed
            // topK: 40,   // Example: uncomment and adjust if needed
        };

        // Optional: Define safety settings to override model defaults.
        // These are quite strict; adjust BLOCK_ ಕಾರಣ (threshold) as needed.
        const safetySettings = [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ];

        // Get an instance of the generative model
        const model = genAI.getGenerativeModel({
            model: llmModelId,
            generationConfig: generationConfig,
            safetySettings: safetySettings, // Apply safety settings
        });

        console.log(`(( V.I.V.I.E.N.N.E. LOG )) :: Transmitting request to Gemini model [${llmModelId}] via SDK conduit.`);
        // For privacy and log brevity, consider only logging a snippet of the prompt in production
        // console.log('Prompt Snippet (first 150 chars):', prompt.substring(0,150) + "...");

        const result = await model.generateContent(prompt);
        const response = result.response;

        // Thoroughly check the response structure
        if (!response) {
            console.error("(( V.I.V.I.E.N.N.E. ERROR )) :: Null response object from Gemini SDK result.");
            return res.status(500).json({ error: 'Communication anomaly: No response object from LLM.' });
        }
        
        if (response.promptFeedback && response.promptFeedback.blockReason) {
            const blockReason = response.promptFeedback.blockReason;
            const safetyRatingsInfo = response.promptFeedback.safetyRatings.map(r => `${r.category}: ${r.probability}`).join(', ');
            console.warn(`(( V.I.V.I.E.N.N.E. ALERT )) :: Input prompt blocked by Gemini. Reason: ${blockReason}. Ratings: [${safetyRatingsInfo}]`);
            return res.status(200).json({ // 200 because the API call was "successful" in returning a feedback
                output: `[V.I.V.I.E.N.N.E. SYSTEM INTERCEPT]\nYour request was blocked by the AI's safety protocols.\nReason: ${blockReason}.\nDetails: ${safetyRatingsInfo}\nPlease revise your input.`,
                details: { promptFeedback: response.promptFeedback }
            });
        }

        if (!response.candidates || response.candidates.length === 0) {
            console.warn("(( V.I.V.I.E.N.N.E. WARNING )) :: No candidates received from Gemini API in response.", response);
            return res.status(500).json({ error: 'Communication anomaly: No response candidates from LLM.' });
        }
        
        const candidate = response.candidates[0];

        // Check if content is present and has text
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0 && typeof candidate.content.parts[0].text === 'string') {
            console.log(`(( V.I.V.I.E.N.N.E. LOG )) :: Content received successfully from [${llmModelId}].`);
            res.json({ output: candidate.content.parts[0].text });
        } else if (candidate.finishReason) {
            // Handle cases where generation stopped due to a reason other than normal completion
            let reasonMessage = `The AI completed generation with reason: ${candidate.finishReason}.`;
            if (candidate.finishReason === 'SAFETY') {
                const safetyRatingsInfo = candidate.safetyRatings ? candidate.safetyRatings.map(r => `${r.category} (${r.probability})`).join(', ') : "Not specified";
                reasonMessage = `The AI's response was blocked due to safety protocols. Reason: SAFETY. Details: [${safetyRatingsInfo}]`;
                console.warn(`(( V.I.V.I.E.N.N.E. ALERT )) :: Output content blocked by Gemini. Finish Reason: SAFETY. Ratings: [${safetyRatingsInfo}]`);
            } else if (candidate.finishReason === 'MAX_TOKENS') {
                reasonMessage = "The AI stopped generating because the maximum output token limit was reached. The response may be incomplete.";
                console.warn(`(( V.I.V.I.E.N.N.E. LOG )) :: Max tokens reached for model [${llmModelId}].`);
            } else if (candidate.finishReason === "RECITATION") {
                reasonMessage = "The AI's response was blocked as it detected potential recitation of copyrighted material.";
                console.warn(`(( V.I.V.I.E.N.N.E. ALERT )) :: Recitation detected by model [${llmModelId}].`);
            } else if (candidate.finishReason === "OTHER") {
                reasonMessage += " The model stopped for an unspecified reason.";
            }
            
            return res.status(200).json({ 
                output: `[V.I.V.I.E.N.N.E. SYSTEM NOTE]\n${reasonMessage}`, 
                details: { finishReason: candidate.finishReason, safetyRatings: candidate.safetyRatings }
            });
        } else {
            // Fallback for unexpected candidate structure
            console.warn('(( V.I.V.I.E.N.N.E. WARNING )) :: Gemini API response candidate had an unexpected structure:', JSON.stringify(candidate, null, 2));
            res.json({ output: "[V.I.V.I.E.N.N.E. SYSTEM NOTE]\nReceived an empty or improperly structured response part from the AI.", details: candidate });
        }

    } catch (error) {
        console.error('(( V.I.V.I.E.N.N.E. FATAL EXCEPTION )) :: Error during SDK communication with Google LLM API:', error);
        let errorMessage = 'Internal system malfunction during LLM communication protocol.';
        if (error.message) {
            errorMessage = error.message; // More specific error from SDK or elsewhere
        }
        // The SDK's GoogleGenerativeAIError might have more details.
        // For now, we send a generic message + toString for debugging.
        res.status(500).json({ error: errorMessage, details: error.toString() });
    }
});

app.listen(PORT, () => {
    console.log("===================================================================");
    console.log(" V.I.V.I.E.N.N.E. // Quantum-Language-Machine Cookshop v0.3.1");
    console.log("-------------------------------------------------------------------");
    console.log(` STATUS         :: Online. System integrity nominal.`);
    console.log(` PORT           :: ${PORT}`);
    console.log(` LLM INTERFACE  :: Google Gemini API (via @google/generative-ai SDK)`);
    console.log(` API KEY STATUS :: ${GOOGLE_API_KEY ? 'LOADED' : 'MISSING - CRITICAL ERROR IMMINENT'}`);
    console.log("===================================================================");
    console.log(" Ensure GOOGLE_API_KEY is correctly set in the .env file (project root).");
    console.log(" Ensure '@google/generative-ai' npm package is installed.");
    console.log(" Static frontend assets (index.html, etc.) served from ./public/");
    console.log("===================================================================");
});